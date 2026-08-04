import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { hoyARG } from "@/lib/utils"

export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const dias = Math.min(Math.max(Number(searchParams.get("dias") ?? "7"), 1), 30)

  // Rango: últimos N días en ARG
  const hoy = hoyARG()
  const desdeDate = new Date(hoy + "T12:00:00.000Z")
  desdeDate.setDate(desdeDate.getDate() - (dias - 1))

  const hastaDate = new Date(hoy + "T12:00:00.000Z")

  const ejecuciones = await prisma.ejecucionProcedimiento.findMany({
    where: {
      empresa_id: session.user.empresaId,
      fecha: { gte: desdeDate, lte: hastaDate },
    },
    select: {
      id: true,
      fecha: true,
      estado: true,
      procedimiento: { select: { nombre: true } },
      turno: { select: { nombre: true, hora_inicio: true, hora_fin: true } },
      tareas: {
        select: {
          estado: true,
          tarea: { select: { es_critica: true } },
        },
      },
    },
    orderBy: { fecha: "asc" },
  })

  // Agrupar por fecha
  const porFecha = new Map<string, typeof ejecuciones>()
  for (const ep of ejecuciones) {
    const key = ep.fecha.toISOString().slice(0, 10)
    const existing = porFecha.get(key) ?? []
    existing.push(ep)
    porFecha.set(key, existing)
  }

  // Generar array de días en el rango
  const dias_array: {
    fecha: string
    total: number
    completados: number
    en_curso: number
    pendientes: number
    tareas_total: number
    tareas_completadas: number
    tareas_criticas_no_completadas: number
    compliance_pct: number
  }[] = []

  const cursor = new Date(desdeDate)
  while (cursor <= hastaDate) {
    const key = cursor.toISOString().slice(0, 10)
    const eps = porFecha.get(key) ?? []

    const total = eps.length
    const completados = eps.filter((e) => e.estado === "COMPLETADO").length
    const en_curso = eps.filter((e) => e.estado === "EN_CURSO").length
    const pendientes = eps.filter((e) => e.estado === "PENDIENTE").length

    const todasTareas = eps.flatMap((e) => e.tareas)
    const tareas_total = todasTareas.length
    const tareas_completadas = todasTareas.filter((t) => t.estado === "COMPLETADA" || t.estado === "OMITIDA").length
    const tareas_criticas_no_completadas = todasTareas.filter(
      (t) => t.tarea.es_critica && t.estado !== "COMPLETADA" && t.estado !== "OMITIDA"
    ).length

    const compliance_pct = tareas_total > 0
      ? Math.round((tareas_completadas / tareas_total) * 100)
      : total === 0 ? 0 : 100

    dias_array.push({
      fecha: key,
      total,
      completados,
      en_curso,
      pendientes,
      tareas_total,
      tareas_completadas,
      tareas_criticas_no_completadas,
      compliance_pct,
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return NextResponse.json({ dias: dias_array })
}
