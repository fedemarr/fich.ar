import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { prisma } from "@/lib/prisma"
import { rateLimitWA } from "@/lib/rate-limit"
import { getEstadoBot, setEstadoBot, delEstadoBot, type EstadoBotWA } from "@/lib/redis"
import {
  enviarTexto,
  enviarBotones,
  solicitarUbicacion,
  identificarColaborador,
  identificarPorDNI,
} from "@/lib/whatsapp"
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
  const signature = req.headers.get("x-hub-signature-256") ?? ""
  const body = await req.text()
  const expected =
    "sha256=" +
    createHmac("sha256", process.env.META_APP_SECRET ?? "").update(body).digest("hex")

  if (signature !== expected) {
    console.error("[WA webhook] Firma inválida")
    return new Response("Forbidden", { status: 403 })
  }

  // Rate limiting por número de origen (parseamos antes de procesar)
  let fromNumber = "unknown"
  try {
    const parsed = JSON.parse(body) as WAPayload
    fromNumber = parsed.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ?? "unknown"
  } catch {
    // si falla el parse, limitamos por IP genérica
  }
  const { success } = await rateLimitWA.limit(fromNumber)
  if (!success) return new Response("Too Many Requests", { status: 429 })

  let payload: WAPayload
  try {
    payload = JSON.parse(body) as WAPayload
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    await procesarWebhook(payload)
  } catch (e) {
    console.error("[WA] Error procesando:", e)
  }

  return NextResponse.json({ status: "ok" })
}

async function procesarWebhook(payload: WAPayload) {
  const entry = payload.entry?.[0]
  const value = entry?.changes?.[0]?.value
  if (!value) return

  for (const msg of value.messages ?? []) {
    const from = msg.from
    const waId = msg.id

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

// Argentina: WA envía 549XXXXXXXXXX pero la API espera 54XXXXXXXXXX
function toEnvio(from: string): string {
  if (/^549\d{10}$/.test(from)) return "54" + from.slice(3)
  return from
}

async function manejarMensaje(from: string, msg: WAMessage) {
  const to = toEnvio(from)
  const estado = await getEstadoBot(from)

  // ── Flujo con sesión activa ──────────────────────────────────────────────────

  if (estado) {
    // Paso: esperando que el empleado ingrese su DNI
    if (estado.paso === "esperando_dni") {
      const texto = extractTexto(msg).trim()
      if (!texto || isNaN(Number(texto.replace(/\./g, "")))) {
        await enviarTexto({ to, body: "Por favor ingresá solo tu número de DNI (sin puntos ni letras)." })
        return
      }

      const colaborador = await identificarPorDNI(texto, estado.empresa_id)
      if (!colaborador) {
        await enviarTexto({
          to,
          body: "❌ No encontramos tu DNI en el sistema. Contactá a tu supervisor.",
        })
        await delEstadoBot(from)
        return
      }

      // Guardar celular para que la próxima vez lo reconozca directamente
      const celularNormalizado = "+" + from
      await prisma.colaborador.update({
        where: { id: colaborador.id },
        data: { celular: celularNormalizado },
      })

      const punto = await prisma.puntoFichaje.findUnique({ where: { id: estado.punto_id } })
      const nombrePunto = punto?.nombre ?? "tu lugar de trabajo"

      await setEstadoBot(from, {
        ...estado,
        paso: "esperando_accion",
        colaborador_id: colaborador.id,
        timestamp: Date.now(),
      })

      await avisarPuntoIncorrecto(to, colaborador.id, estado.punto_id, nombrePunto, estado.empresa_id)
      await enviarBotones({
        to,
        body: `✅ ¡Hola ${colaborador.nombre}! ¿Qué registrás en *${nombrePunto}*?`,
        buttons: [
          { id: "ENTRADA", title: "Entrada ✅" },
          { id: "SALIDA", title: "Salida 🚪" },
        ],
      })
      return
    }

    // Paso: empleado elige entrada o salida
    if (estado.paso === "esperando_accion") {
      const reply = msg.interactive?.button_reply?.id
      if (reply === "ENTRADA" || reply === "SALIDA") {
        await setEstadoBot(from, {
          ...estado,
          paso: "esperando_ubicacion",
          tipo_fichada: reply,
          timestamp: Date.now(),
        })
        await solicitarUbicacion(to)
      } else {
        await enviarTexto({ to, body: "Por favor seleccioná *Entrada* o *Salida* usando los botones." })
      }
      return
    }

    // Paso: empleado envía su ubicación
    if (estado.paso === "esperando_ubicacion") {
      if (msg.type === "location" && msg.location && estado.colaborador_id) {
        await procesarFichada(
          from,
          to,
          estado.empresa_id,
          estado.colaborador_id,
          estado.punto_id,
          estado.tipo_fichada!,
          msg.location.latitude,
          msg.location.longitude
        )
        await delEstadoBot(from)
      } else {
        await enviarTexto({
          to,
          body: "📍 Necesito tu ubicación. Usá el botón de ubicación para compartirla.",
        })
      }
      return
    }
  }

  // ── Sin sesión: esperamos un token QR ───────────────────────────────────────

  const texto = extractTexto(msg).trim()
  const tokenMatch = texto.match(/FICHAR\s+(\S+)/i)
  const token = tokenMatch?.[1]

  console.log("[WA_FLOW] from:", from, "| tipo:", msg.type, "| texto:", texto.slice(0, 80), "| token:", token ?? "NO_TOKEN")

  if (!token) {
    await enviarTexto({
      to,
      body: "¡Hola! Para registrar tu fichaje escaneá el código QR de tu lugar de trabajo.",
    })
    return
  }

  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: token },
    include: { empresa: true },
  })

  if (!punto || !punto.activo) {
    await enviarTexto({ to, body: "El código QR no es válido o está desactivado." })
    return
  }

  // Intentar identificar por celular
  const colaborador = await identificarColaborador(from, punto.empresa_id)

  if (colaborador) {
    await setEstadoBot(from, {
      paso: "esperando_accion",
      qr_token: token,
      punto_id: punto.id,
      empresa_id: punto.empresa_id,
      colaborador_id: colaborador.id,
      timestamp: Date.now(),
    })
    await avisarPuntoIncorrecto(to, colaborador.id, punto.id, punto.nombre, punto.empresa_id)
    await enviarBotones({
      to,
      body: `¡Hola ${colaborador.nombre}! ¿Qué registrás en *${punto.nombre}*?`,
      buttons: [
        { id: "ENTRADA", title: "Entrada ✅" },
        { id: "SALIDA", title: "Salida 🚪" },
      ],
    })
  } else {
    // No identificado por celular → pedir DNI
    await setEstadoBot(from, {
      paso: "esperando_dni",
      qr_token: token,
      punto_id: punto.id,
      empresa_id: punto.empresa_id,
      timestamp: Date.now(),
    })
    await enviarTexto({
      to,
      body: `¡Hola! Estás en *${punto.nombre}*.\n\nNo encontramos tu número registrado. Por favor ingresá tu *número de DNI* para identificarte:`,
    })
  }
}

async function avisarPuntoIncorrecto(
  to: string,
  colaboradorId: string,
  puntoId: string,
  nombrePunto: string,
  empresaId: string
) {
  const ahora = new Date()
  const mes = ahora.getMonth() + 1
  const anio = ahora.getFullYear()

  const proyeccion = await prisma.proyeccionMensual.findUnique({
    where: { empresa_id_mes_anio: { empresa_id: empresaId, mes, anio } },
    select: { id: true },
  })
  if (!proyeccion) return

  const asignacion = await prisma.asignacionMensual.findFirst({
    where: { proyeccion_id: proyeccion.id, colaborador_id: colaboradorId, punto_fichaje_id: puntoId },
    select: { id: true },
  })

  if (!asignacion) {
    await enviarTexto({
      to,
      body: `⚠️ Atención: según la planilla de ${ahora.toLocaleString("es-AR", { month: "long" })}, no figurás asignado/a a *${nombrePunto}*. Verificá que estás escaneando el QR correcto o consultá con tu supervisor.`,
    })
  }
}

async function procesarFichada(
  from: string,
  to: string,
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

  if (!esValida) {
    await enviarTexto({
      to,
      body: `❌ Tu ubicación está a *${Math.round(distancia)}m* del punto de fichaje.\nMáximo permitido: ${punto.radio_metros}m.\n\nSi creés que es un error, contactá a tu supervisor.`,
    })
    await prisma.notificacion.create({
      data: {
        empresa_id: empresaId,
        colaborador_id: colaboradorId,
        tipo: "FALLA_FICHADA",
        titulo: "Intento de fichada fuera de rango",
        descripcion: `${Math.round(distancia)}m del punto ${punto.nombre}`,
      },
    })
    return
  }

  const ahora = new Date()

  // Cruzar con proyección mensual del mes actual
  const mes = ahora.getMonth() + 1
  const anio = ahora.getFullYear()
  const dia = ahora.getDate()
  const diaKey = `dia_${String(dia).padStart(2, "0")}` as
    | "dia_01" | "dia_02" | "dia_03" | "dia_04" | "dia_05" | "dia_06" | "dia_07"
    | "dia_08" | "dia_09" | "dia_10" | "dia_11" | "dia_12" | "dia_13" | "dia_14"
    | "dia_15" | "dia_16" | "dia_17" | "dia_18" | "dia_19" | "dia_20" | "dia_21"
    | "dia_22" | "dia_23" | "dia_24" | "dia_25" | "dia_26" | "dia_27" | "dia_28"
    | "dia_29" | "dia_30" | "dia_31"

  const proyeccion = await prisma.proyeccionMensual.findUnique({
    where: { empresa_id_mes_anio: { empresa_id: empresaId, mes, anio } },
    select: { id: true },
  })

  let avisoFranco = false
  if (proyeccion) {
    const asignacion = await prisma.asignacionMensual.findFirst({
      where: {
        proyeccion_id: proyeccion.id,
        colaborador_id: colaboradorId,
        punto_fichaje_id: puntoId,
      },
      select: { [diaKey]: true },
    })

    if (asignacion) {
      const horasHoy = asignacion[diaKey] as number | null
      if (horasHoy === 0) {
        avisoFranco = true
      }
    }
  }

  // Obtener jornada activa para calcular análisis de puntualidad
  const jornadaActiva = await prisma.colaboradorJornada.findFirst({
    where: { colaborador_id: colaboradorId, fecha_hasta: null },
    include: { jornada: true },
  })

  const analisis = calcularAnalisis(ahora, tipo, jornadaActiva?.jornada)

  await prisma.fichada.create({
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
      es_valida: true,
    },
  })

  await prisma.webhookWA.updateMany({
    where: { from_number: from, procesado: false },
    data: { procesado: true },
  })

  const hora = ahora.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  })
  const emoji = tipo === "ENTRADA" ? "✅" : "🚪"
  const tipoTexto = tipo === "ENTRADA" ? "Entrada" : "Salida"
  const analisisTexto: Record<string, string> = {
    LLEGADA_EN_TIEMPO: "",
    LLEGADA_TARDE: "⏰ Llegada tarde",
    SALIDA_EN_TIEMPO: "",
    SALIDA_ANTICIPADA: "⚠️ Salida anticipada",
    SIN_SALIDA: "",
    FUERA_DE_RANGO: "",
  }

  let respuesta = `${emoji} *${tipoTexto}* registrada a las ${hora}\n📍 ${punto.nombre}`
  if (analisisTexto[analisis]) respuesta += `\n${analisisTexto[analisis]}`
  if (avisoFranco) respuesta += `\n\n📅 Nota: hoy tenés franco registrado en la planilla. Consultá con tu supervisor.`

  await enviarTexto({ to, body: respuesta })

  if (analisis === "LLEGADA_TARDE" || analisis === "SALIDA_ANTICIPADA") {
    await prisma.notificacion.create({
      data: {
        empresa_id: empresaId,
        colaborador_id: colaboradorId,
        tipo: "FALLA_FICHADA",
        titulo: analisis === "LLEGADA_TARDE" ? "Llegada tarde" : "Salida anticipada",
        descripcion: `Fichada en ${punto.nombre} — ${hora}`,
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
