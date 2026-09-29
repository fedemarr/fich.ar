import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  tipo: z.string().min(1).max(100),
  puntos_revision: z.array(z.string().min(1)).min(1),
  instruccion_foto: z.string().optional(),
  foto_ok_url: z.string().optional(),
  foto_mal_url: z.string().optional(),
  fallas_graves: z.array(z.string()).optional(),
  fallas_leves: z.array(z.string()).optional(),
  controles_presenciales: z.array(z.string()).min(1),
  umbral_aprobacion: z.number().int().min(0).max(100).default(80),
})

export async function GET() {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const fichas = await prisma.fichaSector.findMany({
    where: { empresa_id: session.user.empresaId, activo: true },
    include: { _count: { select: { sectores: true } } },
    orderBy: { tipo: "asc" },
  })

  return NextResponse.json({ fichas })
}

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO", "operaciones")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const ficha = await prisma.fichaSector.create({
    data: { ...parsed.data, empresa_id: session.user.empresaId },
  })

  return NextResponse.json({ ficha }, { status: 201 })
}
