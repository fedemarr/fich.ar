import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  activo: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("EDITAR_PUNTO")
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const turno = await prisma.turno.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: parsed.data,
  })

  if (turno.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("ELIMINAR_PUNTO")
  if (error) return error

  const { id } = await params
  await prisma.turno.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: { activo: false },
  })

  return NextResponse.json({ ok: true })
}
