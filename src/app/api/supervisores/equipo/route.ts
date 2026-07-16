import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const isSupervisor = session.user.rol === "SUPERVISOR"
  const empresaId = session.user.empresaId
  const puntosIds = isSupervisor ? session.user.puntosIds : null

  // Colaboradores activos asignados a los puntos del supervisor (via jornada activa)
  const colaboradores = await prisma.colaborador.findMany({
    where: {
      empresa_id: empresaId,
      estado: "ACTIVO",
      deleted_at: null,
      ...(puntosIds
        ? {
            jornadas: {
              some: {
                jornada: { punto_fichaje_id: { in: puntosIds } },
                OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date() } }],
              },
            },
          }
        : {}),
    },
    include: {
      jornadas: {
        where: { OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date() } }] },
        include: {
          jornada: {
            select: {
              nombre: true,
              punto_fichaje_id: true,
              punto_fichaje: { select: { nombre: true } },
            },
          },
        },
        take: 1,
      },
    },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  })

  const hoy = hoyARG()
  const hoyInicio = inicioDiaARG(hoy)
  const hoyFin = finDiaARG(hoy)

  // Fichadas de hoy
  const fichadasHoy = await prisma.fichada.findMany({
    where: {
      empresa_id: empresaId,
      colaborador_id: { in: colaboradores.map((c) => c.id) },
      timestamp: { gte: hoyInicio, lte: hoyFin },
    },
    orderBy: { timestamp: "asc" },
  })

  // Novedades de hoy — @db.Date se guarda como 00:00 UTC, no ARG midnight
  const fechaHoyUTC = new Date(hoy + "T00:00:00.000Z")
  const finHoyUTC   = new Date(hoy + "T23:59:59.999Z")
  const novedadesHoy = await prisma.novedad.findMany({
    where: {
      empresa_id: empresaId,
      colaborador_id: { in: colaboradores.map((c) => c.id) },
      fecha: { gte: fechaHoyUTC, lte: finHoyUTC },
    },
  })

  // Descansos activos hoy (fin = null)
  const descansosActivos = await prisma.descanso.findMany({
    where: {
      empresa_id: empresaId,
      colaborador_id: { in: colaboradores.map((c) => c.id) },
      inicio: { gte: hoyInicio, lte: hoyFin },
      fin: null,
    },
    select: { colaborador_id: true, inicio: true },
  })

  const resultado = colaboradores.map((c) => {
    const fichadas = fichadasHoy.filter((f) => f.colaborador_id === c.id)
    const entrada = fichadas.find((f) => f.tipo === "ENTRADA")
    const salida = fichadas.find((f) => f.tipo === "SALIDA")
    const novedad = novedadesHoy.find((n) => n.colaborador_id === c.id)
    const jornadaActiva = c.jornadas[0]
    const enDescanso = descansosActivos.some((d) => d.colaborador_id === c.id)

    let estado: "presente" | "ausente" | "novedad" | "sin_registro" = "sin_registro"
    if (novedad) estado = "novedad"
    else if (entrada) estado = "presente"
    else estado = "ausente"

    return {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      sector: c.sector,
      jornada: jornadaActiva?.jornada.nombre ?? null,
      punto: jornadaActiva?.jornada.punto_fichaje.nombre ?? null,
      estado,
      enDescanso,
      entrada: entrada
        ? entrada.timestamp.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Argentina/Buenos_Aires",
          })
        : null,
      salida: salida
        ? salida.timestamp.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Argentina/Buenos_Aires",
          })
        : null,
      analisisEntrada: entrada?.analisis ?? null,
      novedad: novedad ? { tipo: novedad.tipo, observacion: novedad.observacion } : null,
    }
  })

  return NextResponse.json(resultado)
}
