import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"
import type { RolUsuario } from "@/generated/prisma/client"

const schema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  rol: z.enum(["ADMIN", "MANAGER"]),
})

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const usuarios = await prisma.usuario.findMany({
    where: {
      empresa_id: session.user.empresaId,
      deleted_at: null,
      rol: { not: "SUPER_ADMIN" },
    },
    select: { id: true, nombre: true, email: true, rol: true, activo: true, created_at: true },
    orderBy: { nombre: "asc" },
  })

  return NextResponse.json(usuarios)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.rol === "SUPERVISOR") return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const existe = await prisma.usuario.findUnique({ where: { email: parsed.data.email } })
  if (existe) return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 })

  const hash = await bcrypt.hash(parsed.data.password, 12)
  const usuario = await prisma.usuario.create({
    data: {
      empresa_id: session.user.empresaId,
      nombre: parsed.data.nombre,
      email: parsed.data.email,
      password: hash,
      rol: parsed.data.rol as RolUsuario,
    },
  })

  return NextResponse.json({ id: usuario.id }, { status: 201 })
}
