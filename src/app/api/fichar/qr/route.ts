import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calcularDistanciaMetros } from "@/lib/geo"
import { calcularAnalisis, encontrarJornadaParaFichada } from "@/lib/jornadas"
import { rateLimitQR } from "@/lib/rate-limit"
import { hoyARG } from "@/lib/utils"
import { buscarTurnoAbierto } from "@/lib/turno-abierto"

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
  // 2b. Si el colaborador tiene rol supervisor → flujo supervisión, sin fichaje
  if (colaborador?.es_supervisor) {
    const distSup = calcularDistanciaMetros(latitud, longitud, punto.latitud, punto.longitud)
    if (distSup > punto.radio_metros) {
      return NextResponse.json(
        {
          error: "Ubicación fuera de rango",
          distancia: Math.round(distSup),
          radio: punto.radio_metros,
          punto_lat: punto.latitud,
          punto_lon: punto.longitud,
          usuario_lat: latitud,
          usuario_lon: longitud,
        },
        { status: 400 }
      )
    }
    return NextResponse.json({
      ok: true,
      es_supervisor: true,
      supervisor_tipo: "colaborador",
      supervisor_id: colaborador.id,
      supervisor_nombre: `${colaborador.nombre} ${colaborador.apellido}`,
      punto_nombre: punto.nombre,
    })
  }

  // 2c. Si no encontró colaborador y hay DNI, buscar supervisor (Usuario legacy) con ese DNI asignado a este punto
  if (!colaborador && dni) {
    const dniLimpio = dni.replace(/\./g, "").trim()
    const usuarioSupervisor = await prisma.usuario.findFirst({
      where: {
        identificacion: dniLimpio,
        empresa_id: punto.empresa_id,
        rol: "SUPERVISOR",
        activo: true,
        deleted_at: null,
        puntos_asignados: { some: { punto_fichaje_id: punto.id } },
      },
      select: { id: true, nombre: true },
    })
    if (usuarioSupervisor) {
      // Validar GPS también para supervisores
      const distSup = calcularDistanciaMetros(latitud, longitud, punto.latitud, punto.longitud)
      if (distSup > punto.radio_metros) {
        return NextResponse.json(
          {
            error: "Ubicación fuera de rango",
            distancia: Math.round(distSup),
            radio: punto.radio_metros,
            punto_lat: punto.latitud,
            punto_lon: punto.longitud,
            usuario_lat: latitud,
            usuario_lon: longitud,
          },
          { status: 400 }
        )
      }
      return NextResponse.json({
        ok: true,
        es_supervisor: true,
        supervisor_tipo: "usuario",
        supervisor_id: usuarioSupervisor.id,
        supervisor_nombre: usuarioSupervisor.nombre,
        punto_nombre: punto.nombre,
      })
    }
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

  // 4b. Turnos encadenados (todas las empresas, incluida Clean Paz con fichaje libre):
  // al cerrar un turno con la salida se habilita una nueva entrada, sin límite por día y en cualquier punto
  // (coberturas y flotantes sin turno fijo incluidos).
  const turnoAbierto = await buscarTurnoAbierto(colaborador.id, punto.empresa_id, ahora)
  // Entrada abierta en otro punto = se olvidó la salida: se ficha entrada acá y el anterior se cierra solo
  const next_tipo: "ENTRADA" | "SALIDA" =
    turnoAbierto && turnoAbierto.punto_fichaje_id === punto.id ? "SALIDA" : "ENTRADA"

  const puntoTurnoAbierto =
    turnoAbierto?.punto_fichaje_id && turnoAbierto.punto_fichaje_id !== punto.id
      ? await prisma.puntoFichaje.findUnique({ where: { id: turnoAbierto.punto_fichaje_id }, select: { id: true, nombre: true } })
      : null

  // 4c. Modo solo identificar: devolver colaborador + qué puede fichar
  if (solo_identificar) {
    return NextResponse.json({
      ok: true,
      colaborador: { id: colaborador.id, nombre: colaborador.nombre, apellido: colaborador.apellido },
      next_tipo,
      turno_abierto_en: puntoTurnoAbierto?.nombre ?? null,
    })
  }

  // 5. Validar que el tipo pedido esté permitido
  const tipoFichada = tipo ?? next_tipo
  const abiertoAca = turnoAbierto !== null && turnoAbierto.punto_fichaje_id === punto.id
  if (tipoFichada === "ENTRADA" && abiertoAca) {
    return NextResponse.json({ error: "Ya tenés una entrada abierta en este punto. Registrá tu salida." }, { status: 400 })
  }
  if (tipoFichada === "SALIDA" && !turnoAbierto) {
    return NextResponse.json({ error: "No tenés una entrada abierta. Registrá primero tu entrada." }, { status: 400 })
  }
  if (tipoFichada === "SALIDA" && !abiertoAca) {
    return NextResponse.json({
      error: `Tu entrada abierta es en ${puntoTurnoAbierto?.nombre ?? "otro punto"}. Registrá la salida en ese punto.`,
    }, { status: 400 })
  }

  // 5b. Entrada en un servicio nuevo con otro turno sin cerrar: se cierra el anterior automáticamente
  let cierreAutomatico: { punto: string; hora: string } | null = null
  if (tipoFichada === "ENTRADA" && turnoAbierto && puntoTurnoAbierto) {
    const jornadaAnterior = jornadasActivas.find((j) => j.jornada.punto_fichaje_id === puntoTurnoAbierto.id)?.jornada
    // 1s antes de la nueva entrada para que el orden quede salida → entrada
    const horaCierre = new Date(ahora.getTime() - 1000)
    await prisma.fichada.create({
      data: {
        empresa_id: punto.empresa_id,
        colaborador_id: colaborador.id,
        punto_fichaje_id: puntoTurnoAbierto.id,
        tipo: "SALIDA",
        metodo: "QR_WEB",
        timestamp: horaCierre,
        analisis: calcularAnalisis(horaCierre, "SALIDA", jornadaAnterior),
        es_valida: true,
        nota_manual: "Cierre automático al fichar en nuevo servicio",
      },
    })
    cierreAutomatico = {
      punto: puntoTurnoAbierto.nombre,
      hora: horaCierre.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }),
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
    cierre_automatico: cierreAutomatico,
    colaborador: {
      id: colaborador.id,
      nombre: colaborador.nombre,
      apellido: colaborador.apellido,
    },
    punto: { nombre: punto.nombre },
  })
}
