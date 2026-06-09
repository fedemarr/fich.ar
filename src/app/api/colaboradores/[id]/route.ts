import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  celular: z.string().min(10),
  email: z.string().email().optional().or(z.literal("")),
  legajo: z.string().optional(),
  sector: z.string().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO", "DESACTIVADO"]),
  jornada_id: z.string().optional(),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const empresaId = session.user.empresaId
  const { jornada_id, email, legajo, sector, ...rest } = parsed.data

  const colaborador = await prisma.colaborador.findFirst({
    where: { id, empresa_id: empresaId, deleted_at: null },
  })
  if (!colaborador) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.colaborador.update({
    where: { id },
    data: {
      ...rest,
      email: email || null,
      legajo: legajo || null,
      sector: sector || null,
    },
  })

  if (jornada_id) {
    await prisma.colaboradorJornada.updateMany({
      where: { colaborador_id: id, fecha_hasta: null },
      data: { fecha_hasta: new Date() },
    })
    await prisma.colaboradorJornada.create({
      data: { colaborador_id: id, jornada_id, fecha_desde: new Date() },
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const empresaId = session.user.empresaId

  const colaborador = await prisma.colaborador.findFirst({
    where: { id, empresa_id: empresaId, deleted_at: null },
  })
  if (!colaborador) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.colaborador.update({
    where: { id },
    data: { deleted_at: new Date(), estado: "DESACTIVADO" },
  })

  return NextResponse.json({ ok: true })
}
