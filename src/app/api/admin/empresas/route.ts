import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"
import bcrypt from "bcryptjs"

export async function GET() {
  const { error } = await verificarAcceso("VER_TODAS_EMPRESAS")
  if (error) return error

  const empresas = await prisma.empresa.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: "asc" },
    include: {
      _count: {
        select: {
          colaboradores: { where: { estado: "ACTIVO", deleted_at: null } },
          usuarios: { where: { activo: true, deleted_at: null } },
        },
      },
    },
  })

  return NextResponse.json({ empresas })
}

const crearSchema = z.object({
  nombre: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  emailAdmin: z.string().email().optional(),
  passwordAdmin: z.string().min(6).optional(),
})

export async function POST(req: Request) {
  const { error } = await verificarAcceso("VER_TODAS_EMPRESAS")
  if (error) return error

  const body = await req.json()
  const parsed = crearSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 })
  }

  const { nombre, slug, emailAdmin, passwordAdmin } = parsed.data

  const existe = await prisma.empresa.findUnique({ where: { slug } })
  if (existe) return NextResponse.json({ error: "El slug ya está en uso" }, { status: 409 })

  const empresa = await prisma.empresa.create({ data: { nombre, slug } })

  if (emailAdmin && passwordAdmin) {
    const hash = await bcrypt.hash(passwordAdmin, 12)
    await prisma.usuario.create({
      data: {
        empresa_id: empresa.id,
        nombre: "Admin",
        email: emailAdmin,
        password: hash,
        rol: "ADMIN",
      },
    })
  }

  return NextResponse.json({ empresa }, { status: 201 })
}
