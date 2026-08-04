import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  turno_id: z.string().uuid().optional(),
  nombre: z.string().min(1).max(150).optional(),
  descripcion: z.string().max(500).optional().nullable(),
  lunes: z.boolean().optional(),
  martes: z.boolean().optional(),
  miercoles: z.boolean().optional(),
  jueves: z.boolean().optional(),
  viernes: z.boolean().optional(),
  sabado: z.boolean().optional(),
  domingo: z.boolean().optional(),
  activo: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { id } = await params
  const procedimiento = await prisma.procedimiento.findFirst({
    where: { id, empresa_id: session.user.empresaId },
    include: {
      turno: true,
      tareas: {
        where: { activo: true },
        orderBy: { orden: "asc" },
      },
    },
  })

  if (!procedimiento) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json({ procedimiento })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("EDITAR_PUNTO", "operaciones")
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const result = await prisma.procedimiento.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: parsed.data,
  })

  if (result.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("ELIMINAR_PUNTO", "operaciones")
  if (error) return error

  const { id } = await params
  await prisma.procedimiento.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: { activo: false },
  })

  return NextResponse.json({ ok: true })
}
