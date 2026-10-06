import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"
import { esDiaLaboral, esFranco } from "@/lib/jornadas"
import { armarServicios } from "@/lib/movimientos"
import { ETIQUETAS_NOVEDAD } from "@/types"

const TZ = "America/Argentina/Buenos_Aires"

function horaARGTexto(d: Date | null): string | null {
  return d ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("VER_COLABORADORES")
  if (error) return error

  const { id } = await params
  const empresaId = session.user.empresaId
  const fechaParam = new URL(req.url).searchParams.get("fecha")
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoyARG()

  const colaborador = await prisma.colaborador.findFirst({
    where: { id, empresa_id: empresaId },
    select: { id: true, nombre: true, apellido: true },
  })
  if (!colaborador) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const inicio = inicioDiaARG(fecha)
  const fin = finDiaARG(fecha)
  const ahora = new Date()

  const [fichadas, asignaciones, novedad, descansos] = await Promise.all([
    prisma.fichada.findMany({
      where: { colaborador_id: id, empresa_id: empresaId, es_valida: true, timestamp: { gte: inicio, lte: fin } },
      orderBy: { timestamp: "asc" },
      select: {
        tipo: true, timestamp: true, analisis: true, es_cobertura: true, metodo: true, nota_manual: true,
        punto_fichaje: { select: { id: true, nombre: true } },
      },
    }),
    prisma.colaboradorJornada.findMany({
      where: {
        colaborador_id: id,
        fecha_desde: { lte: fin },
        OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: inicio } }],
        jornada: { activo: true, empresa_id: empresaId },
      },
      select: { dias_franco: true, jornada: true },
    }),
    prisma.novedad.findFirst({
      where: { colaborador_id: id, empresa_id: empresaId, fecha: new Date(fecha + "T12:00:00.000Z") },
      select: { tipo: true, observacion: true },
    }),
    prisma.descanso.findMany({
      where: { colaborador_id: id, empresa_id: empresaId, inicio: { gte: inicio, lte: fin } },
      orderBy: { inicio: "asc" },
      select: { inicio: true, fin: true },
    }),
  ])

  const servicios = armarServicios(
    fichadas.map((f) => ({
      tipo: f.tipo,
      timestamp: f.timestamp,
      punto_id: f.punto_fichaje?.id ?? null,
      punto_nombre: f.punto_fichaje?.nombre ?? "Sin punto",
      analisis: f.analisis,
      es_cobertura: f.es_cobertura,
      metodo: f.metodo,
      nota_manual: f.nota_manual,
    })),
    ahora
  )

  // Servicios que le tocaban ese día según sus turnos y en los que no fichó
  const puntosFichados = new Set(servicios.map((s) => s.punto_id))
  const puntoIds = [...new Set(asignaciones.map((a) => a.jornada.punto_fichaje_id))]
  const puntos = await prisma.puntoFichaje.findMany({
    where: { id: { in: puntoIds }, empresa_id: empresaId },
    select: { id: true, nombre: true },
  })
  const nombrePunto = new Map(puntos.map((p) => [p.id, p.nombre]))

  const esHoy = fecha === hoyARG()
  const minutosAhoraARG = (() => {
    const [h, m] = ahora.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).split(":").map(Number)
    return h * 60 + m
  })()

  const sinFichar = asignaciones
    .filter((a) => esDiaLaboral(a.jornada as unknown as Parameters<typeof esDiaLaboral>[0], inicio))
    .filter((a) => !puntosFichados.has(a.jornada.punto_fichaje_id))
    .map((a) => {
      const [h, m] = a.jornada.hora_inicio.split(":").map(Number)
      const empiezaMin = h * 60 + m + a.jornada.tolerancia_min
      const estado = esFranco(a.dias_franco, inicio)
        ? "FRANCO"
        : esHoy && minutosAhoraARG < empiezaMin
          ? "PENDIENTE"
          : fecha > hoyARG() ? "PENDIENTE" : "NO_FICHO"
      return {
        punto: nombrePunto.get(a.jornada.punto_fichaje_id) ?? a.jornada.nombre,
        turno: a.jornada.nombre,
        horario: `${a.jornada.hora_inicio}–${a.jornada.hora_fin}`,
        estado,
      }
    })

  return NextResponse.json({
    fecha,
    es_hoy: esHoy,
    colaborador: { nombre: colaborador.nombre, apellido: colaborador.apellido },
    servicios: servicios.map((s) => ({
      punto: s.punto,
      entrada: horaARGTexto(s.entrada),
      salida: horaARGTexto(s.salida),
      estado: s.estado,
      duracion_min: s.duracion_min,
      cobertura: s.cobertura,
      tarde: s.tarde,
      salida_anticipada: s.salida_anticipada,
      cierre_automatico: s.cierre_automatico,
      manual: s.manual,
    })),
    sin_fichar: sinFichar,
    novedad: novedad ? { tipo: novedad.tipo, etiqueta: ETIQUETAS_NOVEDAD[novedad.tipo], observacion: novedad.observacion } : null,
    descansos: descansos.map((d) => ({
      inicio: horaARGTexto(d.inicio),
      fin: horaARGTexto(d.fin),
      duracion_min: d.fin ? Math.round((d.fin.getTime() - d.inicio.getTime()) / 60000) : null,
    })),
  })
}
