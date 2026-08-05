import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hoyARG } from "@/lib/utils"

const DIAS: Record<number, string> = {
  0: "domingo", 1: "lunes", 2: "martes", 3: "miercoles",
  4: "jueves", 5: "viernes", 6: "sabado",
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const { searchParams } = new URL(req.url)
  const fechaParam = searchParams.get("fecha") ?? hoyARG()

  const punto = await prisma.puntoFichaje.findFirst({
    where: { operaciones_token: token, activo: true },
    select: {
      id: true,
      nombre: true,
      empresa_id: true,
      empresa: { select: { nombre: true, logo_url: true, slug: true, modulo_operaciones: true } },
    },
  })

  if (!punto) return NextResponse.json({ error: "QR inválido" }, { status: 404 })
  if (!punto.empresa.modulo_operaciones) {
    return NextResponse.json({ error: "Módulo de operaciones no activo" }, { status: 403 })
  }

  const fechaDate = new Date(fechaParam + "T12:00:00.000Z")
  const diaKey = DIAS[new Date(fechaParam + "T12:00:00Z").getUTCDay()]

  // Solo procedimientos asignados a ESTE punto
  const whereProc = {
    empresa_id: punto.empresa_id,
    punto_fichaje_id: punto.id,
    activo: true,
  }

  // Si no hay ejecuciones para hoy de este punto, generarlas on-demand
  const existentes = await prisma.ejecucionProcedimiento.count({
    where: {
      empresa_id: punto.empresa_id,
      fecha: fechaDate,
      procedimiento: { punto_fichaje_id: punto.id },
    },
  })

  if (existentes === 0) {
    const procedimientos = await prisma.procedimiento.findMany({
      where: { ...whereProc, [diaKey]: true },
      include: { tareas: { where: { activo: true }, orderBy: { orden: "asc" } } },
    })

    for (const proc of procedimientos) {
      const yaExiste = await prisma.ejecucionProcedimiento.findUnique({
        where: { procedimiento_id_fecha: { procedimiento_id: proc.id, fecha: fechaDate } },
      })
      if (yaExiste) continue

      await prisma.$transaction(async (tx) => {
        const ejecucion = await tx.ejecucionProcedimiento.create({
          data: {
            empresa_id: punto.empresa_id,
            procedimiento_id: proc.id,
            turno_id: proc.turno_id,
            fecha: fechaDate,
            estado: "PENDIENTE",
          },
        })
        if (proc.tareas.length > 0) {
          await tx.ejecucionTarea.createMany({
            data: proc.tareas.map((t) => ({
              empresa_id: punto.empresa_id,
              ejecucion_procedimiento_id: ejecucion.id,
              tarea_id: t.id,
              estado: "PENDIENTE",
            })),
          })
        }
      })
    }
  }

  const ejecuciones = await prisma.ejecucionProcedimiento.findMany({
    where: {
      empresa_id: punto.empresa_id,
      fecha: fechaDate,
      procedimiento: { punto_fichaje_id: punto.id },
    },
    include: {
      procedimiento: { select: { nombre: true } },
      turno: { select: { nombre: true, hora_inicio: true, hora_fin: true } },
      tareas: {
        include: {
          tarea: {
            select: {
              id: true,
              nombre: true,
              descripcion: true,
              orden: true,
              foto_min: true,
              foto_max: true,
              foto_instruccion: true,
              requiere_comentario: true,
              checklist_items: true,
              tiempo_estimado_min: true,
              criterio_verificacion: true,
            },
          },
          colaborador: { select: { id: true, nombre: true, apellido: true } },
          fotos: { select: { id: true, estado_subida: true, verificacion_ia: true } },
        },
        orderBy: { tarea: { orden: "asc" } },
      },
    },
    orderBy: { turno: { hora_inicio: "asc" } },
  })

  const filtradas = ejecuciones.filter((e) => e.tareas.length > 0)

  return NextResponse.json({
    punto: { id: punto.id, nombre: punto.nombre },
    empresa: { nombre: punto.empresa.nombre, logo_url: punto.empresa.logo_url },
    ejecuciones: filtradas,
    fecha: fechaParam,
  })
}
