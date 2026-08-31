import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calcularDistanciaMetros } from "@/lib/geo"
import { calcularAnalisis, encontrarJornadaParaFichada } from "@/lib/jornadas"
import { rateLimitQR } from "@/lib/rate-limit"
import { hoyARG, inicioDiaARG } from "@/lib/utils"

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

  const ahora = new Date()

  // 4. Jornadas activas del colaborador (análisis, cobertura y límite de turnos)
  const jornadasActivas = await prisma.colaboradorJornada.findMany({
    where: {
      colaborador_id: colaborador.id,
      OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: ahora } }],
    },
    include: { jornada: true },
  })

  // 4b. Verificar fichadas de hoy
  const inicioDia = inicioDiaARG(hoyARG())
  const fichadasHoy = await prisma.fichada.findMany({
    where: { colaborador_id: colaborador.id, timestamp: { gte: inicioDia }, es_valida: true },
    select: { tipo: true, punto_fichaje_id: true },
    orderBy: { timestamp: "asc" },
  })

  const esFichajeLibre = punto.empresa.fichaje_libre

  const puntosAsignados = new Set(jornadasActivas.map((j) => j.jornada.punto_fichaje_id))
  const limiteTurnos = Math.max(1, puntosAsignados.size)
  const entradasHoy = fichadasHoy.filter((f) => f.tipo === "ENTRADA").length
  const fichadasEnPunto = fichadasHoy.filter((f) => f.punto_fichaje_id === punto.id)
  const entradaEnPunto = fichadasEnPunto.some((f) => f.tipo === "ENTRADA")
  const salidaEnPunto = fichadasEnPunto.some((f) => f.tipo === "SALIDA")

  // next_tipo: qué puede fichar a continuación (null = turnos completos)
  // Clean Paz: alternar por punto, cada punto con su propia entrada→salida.
  // Resto: 1 entrada + 1 salida por día (comportamiento actual).
  let next_tipo: "ENTRADA" | "SALIDA" | null
  if (esFichajeLibre) {
    if (!entradaEnPunto && entradasHoy < limiteTurnos) {
      next_tipo = "ENTRADA"
    } else if (entradaEnPunto && !salidaEnPunto) {
      next_tipo = "SALIDA"
    } else {
      next_tipo = null
    }
  } else {
    const tieneEntrada = fichadasHoy.some((f) => f.tipo === "ENTRADA")
    const tieneSalida = fichadasHoy.some((f) => f.tipo === "SALIDA")
    next_tipo = !tieneEntrada ? "ENTRADA" : !tieneSalida ? "SALIDA" : null
  }

  // 4c. Modo solo identificar: devolver colaborador + qué puede fichar
  if (solo_identificar) {
    return NextResponse.json({
      ok: true,
      colaborador: { id: colaborador.id, nombre: colaborador.nombre, apellido: colaborador.apellido },
      next_tipo,
    })
  }

  // 5. Validar que el tipo pedido esté permitido
  const tipoFichada = tipo ?? next_tipo
  if (!tipoFichada) {
    return NextResponse.json({
      error: esFichajeLibre ? "Ya completaste todos tus turnos de hoy" : "Ya registraste entrada y salida hoy",
    }, { status: 400 })
  }

  if (esFichajeLibre) {
    if (tipoFichada === "ENTRADA" && entradaEnPunto) {
      return NextResponse.json({ error: "Ya registraste tu entrada en este punto hoy" }, { status: 400 })
    }
    if (tipoFichada === "ENTRADA" && entradasHoy >= limiteTurnos) {
      return NextResponse.json({ error: "Alcanzaste tu límite de turnos de hoy" }, { status: 400 })
    }
    if (tipoFichada === "SALIDA" && !entradaEnPunto) {
      return NextResponse.json({ error: "Primero debés registrar tu entrada en este punto" }, { status: 400 })
    }
    if (tipoFichada === "SALIDA" && salidaEnPunto) {
      return NextResponse.json({ error: "Ya registraste tu salida en este punto hoy" }, { status: 400 })
    }
  } else {
    const tieneEntrada = fichadasHoy.some((f) => f.tipo === "ENTRADA")
    const tieneSalida = fichadasHoy.some((f) => f.tipo === "SALIDA")
    if (tipoFichada === "ENTRADA" && tieneEntrada) {
      return NextResponse.json({ error: "Ya registraste tu entrada hoy" }, { status: 400 })
    }
    if (tipoFichada === "SALIDA" && tieneSalida) {
      return NextResponse.json({ error: "Ya registraste tu salida hoy" }, { status: 400 })
    }
    if (tipoFichada === "SALIDA" && !tieneEntrada) {
      return NextResponse.json({ error: "Primero debés registrar tu entrada" }, { status: 400 })
    }
  }

  // 6. Calcular análisis — soporta múltiples jornadas activas
  const jornadaActiva = encontrarJornadaParaFichada(jornadasActivas.map((j) => j.jornada), ahora)
  const analisis = calcularAnalisis(ahora, tipoFichada, jornadaActiva)

  // 6b. Detectar cobertura: el punto escaneado no es el punto asignado en la jornada
  const jornadaEnPuntoEscaneado = jornadasActivas.find((j) => j.jornada.punto_fichaje_id === punto.id)
  const esCobertura = jornadaEnPuntoEscaneado === undefined

  // 7. Registrar fichada
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
      es_cobertura: esCobertura,
    },
  })

  // 8. Auto-registrar novedad P/PT al fichar ENTRADA (si no hay novedad o la que hay es AU del cron)
  if (tipoFichada === "ENTRADA") {
    const tipoNovedad = analisis === "LLEGADA_TARDE" ? "PT" : "P"
    const fechaNovedad = new Date(hoyARG() + "T12:00:00.000Z")
    const novedadExistente = await prisma.novedad.findUnique({
      where: { colaborador_id_fecha: { colaborador_id: colaborador.id, fecha: fechaNovedad } },
      select: { tipo: true },
    })
    if (!novedadExistente || novedadExistente.tipo === "AU") {
      await prisma.novedad.upsert({
        where: { colaborador_id_fecha: { colaborador_id: colaborador.id, fecha: fechaNovedad } },
        create: { empresa_id: punto.empresa_id, colaborador_id: colaborador.id, fecha: fechaNovedad, tipo: tipoNovedad },
        update: { tipo: tipoNovedad },
      })
    }
  }

  // 9. Notificar anomalías
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
    fichada: { tipo: tipoFichada, hora, analisis, es_cobertura: esCobertura },
    colaborador: {
      id: colaborador.id,
      nombre: colaborador.nombre,
      apellido: colaborador.apellido,
    },
    punto: { nombre: punto.nombre },
  })
}
