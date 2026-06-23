import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"
import type { RolUsuario } from "@/generated/prisma/client"

const editSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  rol: z.enum(["ADMIN", "MANAGER"]),
  password: z.string().min(6).optional().or(z.literal("")),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { password, ...rest } = parsed.data

  const existing = await prisma.usuario.findFirst({
    where: { id, empresa_id: session.user.empresaId, deleted_at: null },
  })
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.usuario.update({
    where: { id },
    data: {
      nombre: rest.nombre,
      email: rest.email,
      rol: rest.rol as RolUsuario,
      ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  if (id === session.user.id) {
    return NextResponse.json({ error: "No podés eliminarte a vos mismo" }, { status: 400 })
  }

  await prisma.usuario.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: { deleted_at: new Date(), activo: false },
  })

  return NextResponse.json({ ok: true })
}
