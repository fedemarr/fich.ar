import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { TipoNovedad } from "@/generated/prisma/client"

const TIPOS_NOVEDAD = ["P","PT","ST","AU","VAC","EN","FR","FE","HDO","C","DES","VIR"] as const

const schema = z.object({
  fecha: z.string().optional(),
  tipo: z.enum(TIPOS_NOVEDAD).optional(),
  observacion: z.string().optional(),
  aprobada: z.boolean().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const existing = await prisma.novedad.findFirst({
    where: { id, empresa_id: session.user.empresaId },
  })
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { fecha, tipo, ...rest } = parsed.data
  const novedad = await prisma.novedad.update({
    where: { id },
    data: {
      ...rest,
      ...(fecha ? { fecha: new Date(fecha + "T12:00:00.000Z") } : {}),
      ...(tipo ? { tipo: tipo as TipoNovedad } : {}),
    },
    include: { colaborador: true },
  })

  return NextResponse.json(novedad)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  const existing = await prisma.novedad.findFirst({
    where: { id, empresa_id: session.user.empresaId },
  })
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.novedad.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
