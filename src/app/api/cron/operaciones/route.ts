import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hoyARG } from "@/lib/utils"

const DIAS: (keyof {
  lunes: boolean; martes: boolean; miercoles: boolean; jueves: boolean
  viernes: boolean; sabado: boolean; domingo: boolean
})[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]

// Vercel Cron — 06:00 UTC = 03:00 ARG (antes de cualquier turno mañana)
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const hoyStr = hoyARG()
  const fechaDate = new Date(hoyStr + "T12:00:00.000Z") // mediodía UTC = mediodía ARG sin drift
  const dowIndex = new Date(hoyStr + "T12:00:00Z").getUTCDay() // 0=domingo
  const diaKey = DIAS[dowIndex]

  const empresas = await prisma.empresa.findMany({
    where: { activa: true, deleted_at: null, modulo_operaciones: true },
    select: { id: true },
  })

  let totalGeneradas = 0
  let totalOmitidas = 0

  for (const empresa of empresas) {
    const procedimientos = await prisma.procedimiento.findMany({
      where: {
        empresa_id: empresa.id,
        activo: true,
        [diaKey]: true,
      },
      include: {
        tareas: {
          where: { activo: true },
          orderBy: { orden: "asc" },
        },
      },
    })

    for (const proc of procedimientos) {
      // Idempotente: si ya existe para esta fecha, saltar
      const existente = await prisma.ejecucionProcedimiento.findUnique({
        where: { procedimiento_id_fecha: { procedimiento_id: proc.id, fecha: fechaDate } },
      })
      if (existente) { totalOmitidas++; continue }

      // Crear ejecución + ejecuciones de cada tarea en una transacción
      await prisma.$transaction(async (tx) => {
        const ejecucion = await tx.ejecucionProcedimiento.create({
          data: {
            empresa_id: empresa.id,
            procedimiento_id: proc.id,
            turno_id: proc.turno_id,
            fecha: fechaDate,
            estado: "PENDIENTE",
          },
        })

        if (proc.tareas.length > 0) {
          await tx.ejecucionTarea.createMany({
            data: proc.tareas.map((t) => ({
              empresa_id: empresa.id,
              ejecucion_procedimiento_id: ejecucion.id,
              tarea_id: t.id,
              estado: "PENDIENTE",
            })),
          })
        }

        return ejecucion
      })

      totalGeneradas++
    }
  }

  // Alertas de ayer: ejecuciones con tareas críticas sin completar
  const ayerDate = new Date(fechaDate)
  ayerDate.setDate(ayerDate.getDate() - 1)

  let alertasGeneradas = 0
  for (const empresa of empresas) {
    const ejecucionesAyer = await prisma.ejecucionProcedimiento.findMany({
      where: { empresa_id: empresa.id, fecha: ayerDate, estado: { not: "COMPLETADO" } },
      include: {
        procedimiento: { select: { nombre: true } },
        tareas: {
          where: { tarea: { es_critica: true }, estado: { notIn: ["COMPLETADA", "OMITIDA"] } },
          select: { id: true, tarea: { select: { nombre: true } } },
        },
      },
    })

    const conCriticas = ejecucionesAyer.filter((e) => e.tareas.length > 0)
    if (conCriticas.length === 0) continue

    const nombres = conCriticas
      .map((e) => `${e.procedimiento.nombre}: ${e.tareas.map((t) => t.tarea.nombre).join(", ")}`)
      .join(" | ")

    await prisma.notificacion.create({
      data: {
        empresa_id: empresa.id,
        tipo: "SISTEMA",
        titulo: `Tareas críticas sin completar ayer (${conCriticas.length} procedimiento${conCriticas.length !== 1 ? "s" : ""})`,
        descripcion: nombres,
        estado: "NO_LEIDA",
      },
    })
    alertasGeneradas++
  }

  return NextResponse.json({ ok: true, fecha: hoyStr, generadas: totalGeneradas, omitidas: totalOmitidas, alertas: alertasGeneradas })
}
