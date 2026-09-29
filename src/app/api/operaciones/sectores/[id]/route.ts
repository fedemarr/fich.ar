import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  nombre: z.string().min(1).max(150).optional(),
  ficha_id: z.string().uuid().nullable().optional(),
  activo: z.boolean().optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { id } = await params
  const sector = await prisma.sector.findFirst({
    where: { id, empresa_id: session.user.empresaId },
    include: {
      sede: true,
      ficha: true,
    },
  })
  if (!sector) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json({ sector })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO", "operaciones")
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const result = await prisma.sector.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: parsed.data,
  })
  if (result.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO", "operaciones")
  if (error) return error

  const { id } = await params
  const result = await prisma.sector.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: { activo: false },
  })
  if (result.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
