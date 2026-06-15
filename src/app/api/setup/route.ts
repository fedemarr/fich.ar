import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Endpoint de uso único para crear el usuario SUPER_ADMIN
// Protegido con CRON_SECRET — eliminar después de usar
export async function POST(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const { email, password, nombre } = body as { email: string; password: string; nombre: string }

  if (!email || !password || !nombre) {
    return NextResponse.json({ error: "Faltan campos: email, password, nombre" }, { status: 400 })
  }

  // Buscar cualquier empresa (SUPER_ADMIN puede ver todas)
  const empresa = await prisma.empresa.findFirst({ orderBy: { created_at: "asc" } })
  if (!empresa) return NextResponse.json({ error: "No hay empresas en la DB" }, { status: 500 })

  const existe = await prisma.usuario.findUnique({ where: { email } })
  if (existe) {
    // Si ya existe, actualizar a SUPER_ADMIN
    const updated = await prisma.usuario.update({
      where: { email },
      data: { rol: "SUPER_ADMIN", activo: true, deleted_at: null },
    })
    return NextResponse.json({ ok: true, accion: "actualizado", id: updated.id, rol: updated.rol })
  }

  const hash = await bcrypt.hash(password, 12)
  const usuario = await prisma.usuario.create({
    data: {
      empresa_id: empresa.id,
      nombre,
      email,
      password: hash,
      rol: "SUPER_ADMIN",
    },
  })

  return NextResponse.json({ ok: true, accion: "creado", id: usuario.id, rol: usuario.rol })
}
