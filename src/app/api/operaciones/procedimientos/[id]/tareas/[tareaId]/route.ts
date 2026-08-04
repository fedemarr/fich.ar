import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const checklistItemSchema = z.object({ texto: z.string().min(1), orden: z.number().int() })

const schema = z.object({
  nombre: z.string().min(1).max(150).optional(),
  descripcion: z.string().max(500).optional().nullable(),
  criterio_verificacion: z.string().max(500).optional().nullable(),
  orden: z.number().int().min(0).optional(),
  punto_fichaje_id: z.string().uuid().optional().nullable(),
  es_critica: z.boolean().optional(),
  es_omitible: z.boolean().optional(),
  tiempo_estimado_min: z.number().int().positive().optional().nullable(),
  foto_min: z.number().int().min(0).optional(),
  foto_max: z.number().int().min(0).optional(),
  foto_instruccion: z.string().max(300).optional().nullable(),
  requiere_comentario: z.boolean().optional(),
  checklist_items: z.array(checklistItemSchema).optional().nullable(),
  activo: z.boolean().optional(),
  estado: z.string().optional(),
  colaborador_id: z.string().uuid().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; tareaId: string }> }
) {
  const { error, session } = await verificarAcceso("EDITAR_PUNTO", "operaciones")
  if (error) return error

  const { id, tareaId } = await params

  const proc = await prisma.procedimiento.findFirst({
    where: { id, empresa_id: session.user.empresaId },
  })
  if (!proc) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { checklist_items, ...rest } = parsed.data
  const tarea = await prisma.tarea.updateMany({
    where: { id: tareaId, procedimiento_id: id },
    data: {
      ...rest,
      ...(checklist_items !== undefined
        ? { checklist_items: checklist_items ? JSON.parse(JSON.stringify(checklist_items)) : null }
        : {}),
    },
  })

  if (tarea.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; tareaId: string }> }
) {
  const { error, session } = await verificarAcceso("ELIMINAR_PUNTO", "operaciones")
  if (error) return error

  const { id, tareaId } = await params

  const proc = await prisma.procedimiento.findFirst({
    where: { id, empresa_id: session.user.empresaId },
  })
  if (!proc) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.tarea.updateMany({
    where: { id: tareaId, procedimiento_id: id },
    data: { activo: false },
  })

  return NextResponse.json({ ok: true })
}
