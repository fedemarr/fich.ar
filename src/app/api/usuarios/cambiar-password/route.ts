import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"

const schema = z.object({
  password_actual: z.string().min(1),
  password_nuevo: z.string().min(6),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id } })
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  const ok = await bcrypt.compare(parsed.data.password_actual, usuario.password)
  if (!ok) return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 400 })

  const hash = await bcrypt.hash(parsed.data.password_nuevo, 12)
  await prisma.usuario.update({ where: { id: session.user.id }, data: { password: hash } })

  return NextResponse.json({ ok: true })
}
