import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { prisma } from "@/lib/prisma"
import { getEstadoBot, setEstadoBot, delEstadoBot } from "@/lib/redis"
import { enviarTexto, enviarBotones, solicitarUbicacion } from "@/lib/whatsapp"
import { calcularAnalisis } from "@/lib/jornadas"
import { calcularDistanciaMetros } from "@/lib/geo"

// GET — Meta webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.META_WA_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

// POST — incoming messages
export async function POST(req: Request) {
  // HMAC verification
  const signature = req.headers.get("x-hub-signature-256") ?? ""
  const body = await req.text()
  const expected = "sha256=" + createHmac("sha256", process.env.META_APP_SECRET ?? "").update(body).digest("hex")

  if (signature !== expected) {
    console.error("[WA webhook] Firma inválida")
    return new Response("Forbidden", { status: 403 })
  }

  let payload: WAPayload
  try {
    payload = JSON.parse(body) as WAPayload
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Process async (respond 200 immediately to Meta)
  void procesarWebhook(payload).catch((e) => console.error("[WA] Error procesando:", e))

  return NextResponse.json({ status: "ok" })
}

async function procesarWebhook(payload: WAPayload) {
  const entry = payload.entry?.[0]
  const changes = entry?.changes?.[0]
  const value = changes?.value
  if (!value) return

  // Guardar en DB
  for (const msg of value.messages ?? []) {
    const from = msg.from
    const waId = msg.id

    // Evitar duplicados
    const ya = await prisma.webhookWA.findUnique({ where: { wa_message_id: waId } })
    if (ya) continue

    await prisma.webhookWA.create({
      data: {
        from_number: from,
        body: extractTexto(msg),
        latitud: msg.location?.latitude ?? null,
        longitud: msg.location?.longitude ?? null,
        wa_message_id: waId,
      },
    })

    await manejarMensaje(from, msg)
  }
}

async function manejarMensaje(from: string, msg: WAMessage) {
  const estado = await getEstadoBot(from)

  // Si tiene estado activo, continuar el flujo
  if (estado) {
    if (estado.step === "waiting_tipo") {
      const reply = msg.interactive?.button_reply?.id
      if (reply === "ENTRADA" || reply === "SALIDA") {
        await setEstadoBot(from, { ...estado, step: "waiting_location", tipo: reply })
        await solicitarUbicacion(from)
      } else {
        await enviarTexto({ to: from, body: "Por favor seleccioná una opción: *Entrada* o *Salida*." })
      }
      return
    }

    if (estado.step === "waiting_location") {
      if (msg.type === "location" && msg.location) {
        await procesarFichada(from, estado.empresa_id, estado.colaborador_id, estado.punto_id, estado.tipo!, msg.location.latitude, msg.location.longitude)
        await delEstadoBot(from)
      } else {
        await enviarTexto({ to: from, body: "Necesito que compartas tu ubicación actual para registrar el fichaje. Usá el botón de ubicación." })
      }
      return
    }
  }

  // Sin estado: buscar si el mensaje contiene un token QR
  const texto = extractTexto(msg).trim()
  const tokenMatch = texto.match(/[0-9a-f-]{36}/i)
  const token = tokenMatch?.[0]

  if (!token) {
    await enviarTexto({
      to: from,
      body: "¡Hola! Para registrar tu fichaje escaneá el código QR de tu lugar de trabajo.",
    })
    return
  }

  // Buscar punto por token
  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: token },
    include: { empresa: true },
  })

  if (!punto || !punto.activo) {
    await enviarTexto({ to: from, body: "El código QR no es válido o está desactivado." })
    return
  }

  // Buscar colaborador por celular
  const celularNormalizado = "+" + from.replace(/\D/g, "")
  const colaborador = await prisma.colaborador.findFirst({
    where: {
      empresa_id: punto.empresa_id,
      celular: celularNormalizado,
      deleted_at: null,
    },
  })

  if (!colaborador) {
    await enviarTexto({
      to: from,
      body: "Tu número no está registrado en el sistema. Contactá a RRHH.",
    })
    return
  }

  // Iniciar flujo
  await setEstadoBot(from, {
    step: "waiting_tipo",
    qr_token: token,
    punto_id: punto.id,
    empresa_id: punto.empresa_id,
    colaborador_id: colaborador.id,
  })

  await enviarBotones({
    to: from,
    body: `¡Hola ${colaborador.nombre}! ¿Qué registrás en *${punto.nombre}*?`,
    buttons: [
      { id: "ENTRADA", title: "Entrada ✅" },
      { id: "SALIDA", title: "Salida 🚪" },
    ],
  })
}

async function procesarFichada(
  from: string,
  empresaId: string,
  colaboradorId: string,
  puntoId: string,
  tipo: "ENTRADA" | "SALIDA",
  latReal: number,
  lonReal: number
) {
  const punto = await prisma.puntoFichaje.findUnique({ where: { id: puntoId } })
  if (!punto) return

  const distancia = calcularDistanciaMetros(latReal, lonReal, punto.latitud, punto.longitud)
  const esValida = distancia <= punto.radio_metros

  // Obtener jornada activa del colaborador
  const jornadaActiva = await prisma.colaboradorJornada.findFirst({
    where: { colaborador_id: colaboradorId, fecha_hasta: null },
    include: { jornada: true },
  })

  const ahora = new Date()
  const analisis = calcularAnalisis(ahora, tipo, jornadaActiva?.jornada)

  const fichada = await prisma.fichada.create({
    data: {
      empresa_id: empresaId,
      colaborador_id: colaboradorId,
      punto_fichaje_id: puntoId,
      tipo,
      metodo: "QR_WHATSAPP",
      timestamp: ahora,
      latitud_real: latReal,
      longitud_real: lonReal,
      distancia_metros: Math.round(distancia),
      analisis,
      es_valida: esValida,
    },
  })

  await prisma.webhookWA.updateMany({
    where: { from_number: from, procesado: false },
    data: { procesado: true },
  })

  if (!esValida) {
    await enviarTexto({
      to: from,
      body: `⚠️ Tu ubicación está a ${Math.round(distancia)}m del punto (máx. ${punto.radio_metros}m). La fichada fue registrada pero marcada como *fuera de rango*. Informá a RRHH si es un error.`,
    })
    return
  }

  const hora = ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })
  const emoji = tipo === "ENTRADA" ? "✅" : "🚪"
  const tipoTexto = tipo === "ENTRADA" ? "Entrada" : "Salida"
  const analisisTexto = {
    LLEGADA_EN_TIEMPO: "En tiempo",
    LLEGADA_TARDE: "⏰ Llegada tarde",
    SALIDA_EN_TIEMPO: "En tiempo",
    SALIDA_ANTICIPADA: "⚠️ Salida anticipada",
    SIN_SALIDA: "",
    FUERA_DE_RANGO: "Fuera de rango",
  }[analisis] ?? ""

  await enviarTexto({
    to: from,
    body: `${emoji} *${tipoTexto}* registrada a las ${hora}\n📍 ${punto.nombre}\n${analisisTexto ? `📊 ${analisisTexto}` : ""}`.trim(),
  })

  // Notificacion si llegada tarde o salida anticipada
  if (analisis === "LLEGADA_TARDE" || analisis === "SALIDA_ANTICIPADA") {
    await prisma.notificacion.create({
      data: {
        empresa_id: empresaId,
        colaborador_id: colaboradorId,
        tipo: "FALLA_FICHADA",
        titulo: analisis === "LLEGADA_TARDE" ? "Llegada tarde" : "Salida anticipada",
        descripcion: `Fichada ${fichada.id} — ${hora}`,
      },
    })
  }
}

function extractTexto(msg: WAMessage): string {
  return msg.text?.body ?? msg.interactive?.button_reply?.title ?? ""
}

// Types
interface WAPayload {
  entry?: {
    changes?: {
      value?: {
        messages?: WAMessage[]
      }
    }[]
  }[]
}

interface WAMessage {
  id: string
  from: string
  type: string
  text?: { body: string }
  interactive?: { button_reply?: { id: string; title: string } }
  location?: { latitude: number; longitude: number }
}
