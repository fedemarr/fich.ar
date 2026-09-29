import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  nombre: z.string().min(1).max(100),
})

export async function GET() {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const sedes = await prisma.sede.findMany({
    where: { empresa_id: session.user.empresaId, activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  })

  return NextResponse.json({ sedes })
}

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const sede = await prisma.sede.create({
    data: {
      empresa_id: session.user.empresaId,
      nombre: parsed.data.nombre,
    },
    select: { id: true, nombre: true },
  })

  return NextResponse.json({ sede }, { status: 201 })
}
