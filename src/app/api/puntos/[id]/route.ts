import { NextResponse } from "next/server"
import { verificarAcceso } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { tags, invalidateTag } from "@/lib/queries"

const schema = z.object({
  nombre: z.string().min(1).optional(),
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
  radio_metros: z.number().min(50).max(2000).optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await verificarAcceso("EDITAR_PUNTO")
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const punto = await prisma.puntoFichaje.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: parsed.data,
  })

  if (punto.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  invalidateTag(tags.puntos(session.user.empresaId))
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await verificarAcceso("ELIMINAR_PUNTO")
  if (error) return error

  const { id } = await params

  await prisma.puntoFichaje.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: { activo: false },
  })

  invalidateTag(tags.puntos(session.user.empresaId))
  return NextResponse.json({ ok: true })
}
