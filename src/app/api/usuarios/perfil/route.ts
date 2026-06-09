import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
})

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const emailUsado = await prisma.usuario.findFirst({
    where: { email: parsed.data.email, id: { not: session.user.id } },
  })
  if (emailUsado) return NextResponse.json({ error: "El email ya está en uso" }, { status: 409 })

  await prisma.usuario.update({
    where: { id: session.user.id },
    data: { nombre: parsed.data.nombre, email: parsed.data.email },
  })

  return NextResponse.json({ ok: true })
}
