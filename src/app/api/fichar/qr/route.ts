import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calcularDistanciaMetros } from "@/lib/geo"
import { calcularAnalisis } from "@/lib/jornadas"
import { rateLimitQR } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { success } = await rateLimitQR.limit(ip)
  if (!success) return new Response("Too Many Requests", { status: 429 })

  const body = await req.json() as {
    qr_token: string
    colaborador_id?: string
    dni?: string
    tipo?: "ENTRADA" | "SALIDA"
    latitud: number
    longitud: number
    solo_identificar?: boolean
  }

  const { qr_token, colaborador_id, dni, tipo, latitud, longitud, solo_identificar } = body

  if (!qr_token || latitud == null || longitud == null) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
  }

  // 1. Buscar punto
  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token },
    include: { empresa: true },
  })
  if (!punto || !punto.activo) {
    return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 })
  }

  // 2. Identificar colaborador
  let colaborador = null
  if (colaborador_id) {
    colaborador = await prisma.colaborador.findFirst({
      where: { id: colaborador_id, empresa_id: punto.empresa_id, estado: "ACTIVO", deleted_at: null },
    })
  }
  if (!colaborador && dni) {
    const dniLimpio = dni.replace(/\./g, "").trim()
    colaborador = await prisma.colaborador.findFirst({
      where: { identificacion: dniLimpio, empresa_id: punto.empresa_id, estado: "ACTIVO", deleted_at: null },
    })
  }
  if (!colaborador) {
    return NextResponse.json({ error: "Colaborador no encontrado", needsDni: true }, { status: 404 })
  }

  // 3. Validar GPS
  const distancia = calcularDistanciaMetros(latitud, longitud, punto.latitud, punto.longitud)
  if (distancia > punto.radio_metros) {
    return NextResponse.json(
      {
        error: "Ubicación fuera de rango",
        distancia: Math.round(distancia),
        radio: punto.radio_metros,
        punto_lat: punto.latitud,
        punto_lon: punto.longitud,
        usuario_lat: latitud,
        usuario_lon: longitud,
      },
      { status: 400 }
    )
  }

  // 3b. Modo solo identificar: validar GPS + devolver colaborador sin registrar fichada
  if (solo_identificar) {
    return NextResponse.json({
      ok: true,
      colaborador: { id: colaborador.id, nombre: colaborador.nombre, apellido: colaborador.apellido },
    })
  }

  // 4. Determinar tipo si no viene
  let tipoFichada = tipo
  if (!tipoFichada) {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const ultima = await prisma.fichada.findFirst({
      where: { colaborador_id: colaborador.id, timestamp: { gte: hoy } },
      orderBy: { timestamp: "desc" },
    })
    tipoFichada = !ultima || ultima.tipo === "SALIDA" ? "ENTRADA" : "SALIDA"
  }

  // 5. Calcular análisis
  const jornadaActiva = await prisma.colaboradorJornada.findFirst({
    where: { colaborador_id: colaborador.id, fecha_hasta: null },
    include: { jornada: true },
  })
  const analisis = calcularAnalisis(new Date(), tipoFichada, jornadaActiva?.jornada)

  // 6. Registrar fichada
  const fichada = await prisma.fichada.create({
    data: {
      empresa_id: punto.empresa_id,
      colaborador_id: colaborador.id,
      punto_fichaje_id: punto.id,
      tipo: tipoFichada,
      metodo: "QR_WEB",
      latitud_real: latitud,
      longitud_real: longitud,
      distancia_metros: Math.round(distancia),
      analisis,
      es_valida: true,
    },
  })

  // 7. Notificar anomalías
  if (analisis === "LLEGADA_TARDE" || analisis === "SALIDA_ANTICIPADA") {
    await prisma.notificacion.create({
      data: {
        empresa_id: punto.empresa_id,
        colaborador_id: colaborador.id,
        tipo: "FALLA_FICHADA",
        titulo: analisis === "LLEGADA_TARDE" ? "Llegada tarde" : "Salida anticipada",
        descripcion: `Fichada web en ${punto.nombre}`,
        metadata: { fichada_id: fichada.id, analisis },
      },
    })
  }

  const hora = new Date(fichada.timestamp).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  })

  return NextResponse.json({
    ok: true,
    fichada: { tipo: tipoFichada, hora, analisis },
    colaborador: {
      id: colaborador.id,
      nombre: colaborador.nombre,
      apellido: colaborador.apellido,
    },
    punto: { nombre: punto.nombre },
  })
}
