import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const checklistItemSchema = z.object({ texto: z.string().min(1), orden: z.number().int() })

const crearSchema = z.object({
  nombre: z.string().min(1).max(150),
  descripcion: z.string().max(500).optional(),
  orden: z.number().int().min(0),
  punto_fichaje_id: z.string().uuid().optional().nullable(),
  es_critica: z.boolean().default(false),
  es_omitible: z.boolean().default(true),
  tiempo_estimado_min: z.number().int().positive().optional().nullable(),
  foto_min: z.number().int().min(0).default(0),
  foto_max: z.number().int().min(0).default(0),
  foto_instruccion: z.string().max(300).optional().nullable(),
  requiere_comentario: z.boolean().default(false),
  checklist_items: z.array(checklistItemSchema).optional().nullable(),
})

const reorderSchema = z.object({
  orden: z.array(z.object({ id: z.string().uuid(), orden: z.number().int() })),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { id } = await params

  const proc = await prisma.procedimiento.findFirst({
    where: { id, empresa_id: session.user.empresaId },
  })
  if (!proc) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const tareas = await prisma.tarea.findMany({
    where: { procedimiento_id: id, activo: true },
    include: { punto_fichaje: { select: { id: true, nombre: true } } },
    orderBy: { orden: "asc" },
  })

  return NextResponse.json({ tareas })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO", "operaciones")
  if (error) return error

  const { id } = await params

  const proc = await prisma.procedimiento.findFirst({
    where: { id, empresa_id: session.user.empresaId },
  })
  if (!proc) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await req.json()

  // Manejo especial: reordenar tareas
  if (body._action === "reorder") {
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

    await prisma.$transaction(
      parsed.data.orden.map(({ id: tareaId, orden }) =>
        prisma.tarea.updateMany({
          where: { id: tareaId, procedimiento_id: id },
          data: { orden },
        })
      )
    )
    return NextResponse.json({ ok: true })
  }

  // Crear tarea
  const parsed = crearSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { checklist_items, ...rest } = parsed.data
  const tarea = await prisma.tarea.create({
    data: {
      ...rest,
      procedimiento_id: id,
      checklist_items: checklist_items ? JSON.parse(JSON.stringify(checklist_items)) : null,
    },
    include: { punto_fichaje: { select: { id: true, nombre: true } } },
  })

  return NextResponse.json({ tarea }, { status: 201 })
}
