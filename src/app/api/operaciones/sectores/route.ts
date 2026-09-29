import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  sede_id: z.string().uuid(),
  ficha_id: z.string().uuid().optional(),
  nombre: z.string().min(1).max(150),
})

export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const sede_id = searchParams.get("sede_id")

  const sectores = await prisma.sector.findMany({
    where: {
      empresa_id: session.user.empresaId,
      activo: true,
      ...(sede_id ? { sede_id } : {}),
    },
    include: {
      sede: { select: { id: true, nombre: true } },
      ficha: { select: { id: true, tipo: true } },
      _count: { select: { rutinas: true, verificaciones: true, reclamos: true } },
    },
    orderBy: [{ sede: { nombre: "asc" } }, { nombre: "asc" }],
  })

  return NextResponse.json({ sectores })
}

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO", "operaciones")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const sede = await prisma.sede.findFirst({
    where: { id: parsed.data.sede_id, empresa_id: session.user.empresaId },
  })
  if (!sede) return NextResponse.json({ error: "Sede no encontrada" }, { status: 404 })

  const sector = await prisma.sector.create({
    data: { ...parsed.data, empresa_id: session.user.empresaId },
  })

  return NextResponse.json({ sector }, { status: 201 })
}
