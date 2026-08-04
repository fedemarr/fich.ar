import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hoyARG } from "@/lib/utils"

// Endpoint público — autenticado via qr_token (mismo que fichar/qr)
// Devuelve las ejecuciones de tareas de hoy para el punto del QR
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const qrToken = searchParams.get("token")
  const fechaParam = searchParams.get("fecha") ?? hoyARG()

  if (!qrToken) return NextResponse.json({ error: "Token requerido" }, { status: 400 })

  const punto = await prisma.puntoFichaje.findFirst({
    where: { qr_token: qrToken, activo: true },
    select: { id: true, nombre: true, empresa_id: true, empresa: { select: { modulo_operaciones: true } } },
  })
  if (!punto) return NextResponse.json({ error: "QR inválido" }, { status: 404 })
  if (!punto.empresa.modulo_operaciones) return NextResponse.json({ error: "Módulo no activo" }, { status: 403 })

  const fechaDate = new Date(fechaParam + "T12:00:00.000Z")

  // Traer ejecuciones con tareas de este punto (o sin punto específico)
  const ejecuciones = await prisma.ejecucionProcedimiento.findMany({
    where: {
      empresa_id: punto.empresa_id,
      fecha: fechaDate,
    },
    include: {
      procedimiento: { select: { nombre: true } },
      turno: { select: { nombre: true, hora_inicio: true, hora_fin: true } },
      tareas: {
        where: {
          tarea: {
            OR: [
              { punto_fichaje_id: punto.id },
              { punto_fichaje_id: null },
            ],
          },
        },
        include: {
          tarea: {
            select: {
              id: true,
              nombre: true,
              descripcion: true,
              orden: true,
              es_critica: true,
              es_omitible: true,
              foto_min: true,
              foto_max: true,
              foto_instruccion: true,
              requiere_comentario: true,
              checklist_items: true,
              tiempo_estimado_min: true,
            },
          },
          colaborador: { select: { id: true, nombre: true, apellido: true } },
          fotos: { select: { id: true, estado_subida: true } },
        },
        orderBy: { tarea: { orden: "asc" } },
      },
    },
    orderBy: { turno: { hora_inicio: "asc" } },
  })

  // Filtrar ejecuciones que tengan al menos una tarea relevante
  const filtradas = ejecuciones.filter((e) => e.tareas.length > 0)

  return NextResponse.json({
    ejecuciones: filtradas,
    punto: { id: punto.id, nombre: punto.nombre },
    empresa_id: punto.empresa_id,
    fecha: fechaParam,
  })
}
