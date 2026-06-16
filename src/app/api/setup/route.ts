import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const { email, password, nombre } = body as { email: string; password: string; nombre: string }

  if (!email || !password || !nombre) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 })
  }

  const empresa = await prisma.empresa.findFirst({ orderBy: { created_at: "asc" } })
  if (!empresa) return NextResponse.json({ error: "No hay empresas en la DB" }, { status: 500 })

  const existe = await prisma.usuario.findUnique({ where: { email } })
  if (existe) {
    const updated = await prisma.usuario.update({
      where: { email },
      data: { rol: "SUPER_ADMIN", activo: true, deleted_at: null },
    })
    return NextResponse.json({ ok: true, accion: "actualizado", rol: updated.rol })
  }

  const hash = await bcrypt.hash(password, 12)
  const usuario = await prisma.usuario.create({
    data: { empresa_id: empresa.id, nombre, email, password: hash, rol: "SUPER_ADMIN" },
  })

  return NextResponse.json({ ok: true, accion: "creado", rol: usuario.rol })
}
