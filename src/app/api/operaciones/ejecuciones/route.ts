import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { hoyARG } from "@/lib/utils"

export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const fechaParam = searchParams.get("fecha") ?? hoyARG()

  const fechaDate = new Date(fechaParam + "T12:00:00.000Z")

  const ejecuciones = await prisma.ejecucionProcedimiento.findMany({
    where: {
      empresa_id: session.user.empresaId,
      fecha: fechaDate,
    },
    include: {
      procedimiento: { select: { id: true, nombre: true } },
      turno: { select: { id: true, nombre: true, hora_inicio: true, hora_fin: true } },
      tareas: {
        include: {
          tarea: {
            select: {
              id: true, nombre: true, orden: true, es_critica: true, es_omitible: true,
              foto_min: true, foto_max: true, foto_instruccion: true,
              requiere_comentario: true, checklist_items: true, tiempo_estimado_min: true,
              punto_fichaje: { select: { id: true, nombre: true, latitud: true, longitud: true, radio_metros: true } },
            },
          },
          colaborador: { select: { id: true, nombre: true, apellido: true } },
          fotos: {
            select: { id: true, key: true, estado_subida: true, created_at: true, imagen_url: true, verificacion_ia: true },
            orderBy: { created_at: "asc" },
          },
        },
        orderBy: { tarea: { orden: "asc" } },
      },
    },
    orderBy: { turno: { hora_inicio: "asc" } },
  })

  return NextResponse.json({ ejecuciones, fecha: fechaParam })
}
