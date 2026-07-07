import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"

interface Params { params: Promise<{ id: string }> }

// POST — agregar colaborador a la jornada
export async function POST(req: Request, { params }: Params) {
  const { error, session } = await verificarAcceso("EDITAR_PUNTO")
  if (error) return error

  const { id: jornadaId } = await params
  const { colaborador_id } = await req.json() as { colaborador_id?: string }
  if (!colaborador_id) return NextResponse.json({ error: "colaborador_id requerido" }, { status: 400 })

  // Verificar que la jornada pertenece a la empresa
  const jornada = await prisma.jornada.findFirst({
    where: { id: jornadaId, empresa_id: session.user.empresaId },
  })
  if (!jornada) return NextResponse.json({ error: "Jornada no encontrada" }, { status: 404 })

  // Verificar que el colaborador pertenece a la empresa
  const colaborador = await prisma.colaborador.findFirst({
    where: { id: colaborador_id, empresa_id: session.user.empresaId, estado: "ACTIVO", deleted_at: null },
  })
  if (!colaborador) return NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 })

  // Si ya tiene una asignación activa en esta jornada, no duplicar
  const existe = await prisma.colaboradorJornada.findFirst({
    where: {
      colaborador_id,
      jornada_id: jornadaId,
      OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date() } }],
    },
  })
  if (existe) return NextResponse.json({ error: "El colaborador ya está en este turno" }, { status: 409 })

  // Cerrar cualquier otra jornada activa del mismo colaborador (un colaborador = un turno activo)
  await prisma.colaboradorJornada.updateMany({
    where: {
      colaborador_id,
      OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date() } }],
    },
    data: { fecha_hasta: new Date() },
  })

  const asignacion = await prisma.colaboradorJornada.create({
    data: { colaborador_id, jornada_id: jornadaId },
  })

  return NextResponse.json(asignacion, { status: 201 })
}

// DELETE — quitar colaborador de la jornada
export async function DELETE(req: Request, { params }: Params) {
  const { error, session } = await verificarAcceso("EDITAR_PUNTO")
  if (error) return error

  const { id: jornadaId } = await params
  const { colaborador_id } = await req.json() as { colaborador_id?: string }
  if (!colaborador_id) return NextResponse.json({ error: "colaborador_id requerido" }, { status: 400 })

  // Verificar que la jornada pertenece a la empresa
  const jornada = await prisma.jornada.findFirst({
    where: { id: jornadaId, empresa_id: session.user.empresaId },
  })
  if (!jornada) return NextResponse.json({ error: "Jornada no encontrada" }, { status: 404 })

  await prisma.colaboradorJornada.updateMany({
    where: {
      colaborador_id,
      jornada_id: jornadaId,
      OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date() } }],
    },
    data: { fecha_hasta: new Date() },
  })

  return NextResponse.json({ ok: true })
}
