import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calcularDistanciaMetros } from "@/lib/geo"
import { calcularAnalisis, encontrarJornadaParaFichada } from "@/lib/jornadas"
import { rateLimitQR } from "@/lib/rate-limit"
import { hoyARG } from "@/lib/utils"
import { buscarTurnoAbierto } from "@/lib/turno-abierto"
import { clasesDelDia, nombreProfe } from "@/lib/clases"

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
    clase_id?: string
  }

  const { qr_token, colaborador_id, dni, tipo, latitud, longitud, solo_identificar, clase_id } = body

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

  // 4c. Fichaje por clase (gimnasios): los profes eligen la clase que dan.
  // Los empleados con turno fijo (sin ninguna clase asignada) siguen fichando su jornada como siempre.
  const modoClase = punto.empresa.fichaje_por_clase
  const abiertoAca = turnoAbierto !== null && turnoAbierto.punto_fichaje_id === punto.id
  const claseAbierta = modoClase && abiertoAca && turnoAbierto?.jornada_id
    ? await prisma.jornada.findFirst({
        where: { id: turnoAbierto?.jornada_id ?? "", empresa_id: punto.empresa_id },
        select: { id: true, nombre: true, hora_inicio: true, hora_fin: true, tolerancia_min: true },
      })
    : null

  // 4d. Modo solo identificar: devolver colaborador + qué puede fichar
  if (solo_identificar) {
    const esEmpleadoConTurno = jornadasActivas.length > 0 && jornadasActivas.every((j) => !j.jornada.es_clase)
    const clasesHoy = modoClase && !esEmpleadoConTurno
      ? await clasesDelDia(punto.empresa_id, hoyARG(), ahora, { puntoId: punto.id })
      : []
    return NextResponse.json({
      ok: true,
      colaborador: { id: colaborador.id, nombre: colaborador.nombre, apellido: colaborador.apellido },
      next_tipo,
      turno_abierto_en: puntoTurnoAbierto?.nombre ?? null,
      clase_abierta: claseAbierta?.nombre ?? null,
      clases: clasesHoy.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        hora_inicio: c.hora_inicio,
        hora_fin: c.hora_fin,
        titular: c.titulares.map(nombreProfe).join(", ") || null,
        es_mia: c.titulares.some((t) => t.id === colaborador.id),
        dictada_por: c.dictados[0]?.profe ?? null,
      })),
    })
  }

  // 5. Validar que el tipo pedido esté permitido
  const tipoFichada = tipo ?? next_tipo

  // 5a. Clase elegida por el profe: tiene que ser una clase activa de este punto
  let clase: { id: string; nombre: string; hora_inicio: string; hora_fin: string; tolerancia_min: number } | null = null
  let reemplazoDe: { id: string; nombre: string } | null = null
  if (clase_id && tipoFichada === "ENTRADA") {
    if (!modoClase) {
      return NextResponse.json({ error: "Esta empresa no ficha por clase" }, { status: 400 })
    }
    const claseDb = await prisma.jornada.findFirst({
      where: { id: clase_id, empresa_id: punto.empresa_id, punto_fichaje_id: punto.id, es_clase: true, activo: true },
      include: {
        colaboradores: {
          where: {
            OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: ahora } }],
            colaborador: { estado: "ACTIVO", deleted_at: null },
          },
          include: { colaborador: { select: { id: true, nombre: true, apellido: true } } },
        },
      },
    })
    if (!claseDb) {
      return NextResponse.json({ error: "Clase no encontrada en este punto" }, { status: 400 })
    }
    clase = claseDb
    // Si la da alguien que no es titular, queda registrado como reemplazo del titular
    const titulares = claseDb.colaboradores.map((cj) => cj.colaborador)
    if (titulares.length > 0 && !titulares.some((t) => t.id === colaborador.id)) {
      reemplazoDe = { id: titulares[0].id, nombre: nombreProfe(titulares[0]) }
    }
  }

  // Un profe que termina una clase y empieza la siguiente en el mismo punto: la anterior se cierra sola
  const encadenaClase = clase !== null && abiertoAca
  if (tipoFichada === "ENTRADA" && abiertoAca && !encadenaClase) {
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
  const puntoACerrar = puntoTurnoAbierto ?? (encadenaClase ? { id: punto.id, nombre: punto.nombre } : null)
  if (tipoFichada === "ENTRADA" && turnoAbierto && puntoACerrar) {
    const claseAnterior = turnoAbierto.jornada_id
      ? await prisma.jornada.findFirst({ where: { id: turnoAbierto.jornada_id, empresa_id: punto.empresa_id } })
      : null
    const jornadaAnterior = claseAnterior ?? jornadasActivas.find((j) => j.jornada.punto_fichaje_id === puntoACerrar.id)?.jornada
    // 1s antes de la nueva entrada para que el orden quede salida → entrada
    const horaCierre = new Date(ahora.getTime() - 1000)
    await prisma.fichada.create({
      data: {
        empresa_id: punto.empresa_id,
        colaborador_id: colaborador.id,
        punto_fichaje_id: puntoACerrar.id,
        jornada_id: turnoAbierto.jornada_id,
        tipo: "SALIDA",
        metodo: "QR_WEB",
        timestamp: horaCierre,
        analisis: calcularAnalisis(horaCierre, "SALIDA", jornadaAnterior),
        es_valida: true,
        nota_manual: encadenaClase ? "Cierre automático al empezar otra clase" : "Cierre automático al fichar en nuevo servicio",
      },
    })
    cierreAutomatico = {
      punto: claseAnterior ? `${claseAnterior.nombre} (${puntoACerrar.nombre})` : puntoACerrar.nombre,
      hora: horaCierre.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }),
    }
  }

  // 6. Calcular análisis — soporta múltiples jornadas activas
  // En modo clase se compara contra el horario de la clase (la elegida o la que se está cerrando)
  const claseFichada = clase ?? (tipoFichada === "SALIDA" ? claseAbierta : null)
  const jornadaActiva = claseFichada ?? encontrarJornadaParaFichada(jornadasActivas.map((j) => j.jornada), ahora)
  const analisis = calcularAnalisis(ahora, tipoFichada, jornadaActiva)

  // 6b. Detectar cobertura: el punto escaneado no es el punto asignado en la jornada.
  // En una clase, la cobertura es el reemplazo de otro profe.
  const jornadaEnPuntoEscaneado = jornadasActivas.find((j) => j.jornada.punto_fichaje_id === punto.id)
  const esCobertura = claseFichada ? reemplazoDe !== null : jornadaEnPuntoEscaneado === undefined

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
      jornada_id: claseFichada?.id ?? null,
      reemplazo_de_id: reemplazoDe?.id ?? null,
    },
  })

  // 7b. Reemplazo de clase: avisar al club quién dio la clase en lugar del titular
  if (clase && reemplazoDe) {
    await prisma.notificacion.create({
      data: {
        empresa_id: punto.empresa_id,
        colaborador_id: colaborador.id,
        tipo: "SISTEMA",
        titulo: "Reemplazo de clase",
        descripcion: `${nombreProfe(colaborador)} da ${clase.nombre} (${clase.hora_inicio}) en lugar de ${reemplazoDe.nombre}`,
        metadata: { fichada_id: fichada.id, jornada_id: clase.id, reemplazo_de_id: reemplazoDe.id },
      },
    })
  }

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
    fichada: {
      tipo: tipoFichada,
      hora,
      analisis,
      es_cobertura: esCobertura,
      clase: claseFichada?.nombre ?? null,
      reemplazo_de: reemplazoDe?.nombre ?? null,
    },
    cierre_automatico: cierreAutomatico,
    colaborador: {
      id: colaborador.id,
      nombre: colaborador.nombre,
      apellido: colaborador.apellido,
    },
    punto: { nombre: punto.nombre },
  })
}
