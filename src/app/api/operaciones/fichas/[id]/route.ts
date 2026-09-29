import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  tipo: z.string().min(1).max(100).optional(),
  puntos_revision: z.array(z.string().min(1)).min(1).optional(),
  instruccion_foto: z.string().optional(),
  foto_ok_url: z.string().optional(),
  foto_mal_url: z.string().optional(),
  fallas_graves: z.array(z.string()).optional(),
  fallas_leves: z.array(z.string()).optional(),
  controles_presenciales: z.array(z.string()).min(1).optional(),
  umbral_aprobacion: z.number().int().min(0).max(100).optional(),
  activo: z.boolean().optional(),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO", "operaciones")
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const ficha = await prisma.fichaSector.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: parsed.data,
  })
  if (ficha.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO", "operaciones")
  if (error) return error

  const { id } = await params
  const ficha = await prisma.fichaSector.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: { activo: false },
  })
  if (ficha.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
