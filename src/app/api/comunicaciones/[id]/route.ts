import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  texto: z.string().min(1).optional(),
  fecha_inicio: z.string().optional(),
  fecha_fin: z.string().optional(),
  activa: z.boolean().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const existing = await prisma.comunicacion.findFirst({
    where: { id, empresa_id: session.user.empresaId, deleted_at: null },
  })
  if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  const { fecha_inicio, fecha_fin, ...rest } = parsed.data
  const comunicacion = await prisma.comunicacion.update({
    where: { id },
    data: {
      ...rest,
      ...(fecha_inicio ? { fecha_inicio: new Date(fecha_inicio) } : {}),
      ...(fecha_fin ? { fecha_fin: new Date(fecha_fin) } : {}),
    },
  })

  return NextResponse.json(comunicacion)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  const existing = await prisma.comunicacion.findFirst({
    where: { id, empresa_id: session.user.empresaId, deleted_at: null },
  })
  if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  await prisma.comunicacion.update({
    where: { id },
    data: { deleted_at: new Date() },
  })

  return NextResponse.json({ ok: true })
}
