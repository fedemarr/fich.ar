import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { invalidateTag, tags } from "@/lib/queries"
import { jornadasSeSolapan, type JornadaConFlags } from "@/lib/jornadas"

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

  // Verificar que no esté ya asignado a esta jornada
  const yaEnEstaJornada = await prisma.colaboradorJornada.findFirst({
    where: {
      colaborador_id,
      jornada_id: jornadaId,
      OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date() } }],
    },
  })
  if (yaEnEstaJornada) return NextResponse.json({ error: "El colaborador ya está en este turno" }, { status: 409 })

  // Obtener todas sus jornadas activas en CUALQUIER punto para validar solapamiento
  const asignacionesActivas = await prisma.colaboradorJornada.findMany({
    where: {
      colaborador_id,
      jornada_id: { not: jornadaId },
      OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date() } }],
    },
    include: {
      jornada: {
        include: { punto_fichaje: { select: { nombre: true } } },
      },
    },
  })

  // Detectar solapamiento con cada jornada existente
  for (const asig of asignacionesActivas) {
    if (jornadasSeSolapan(jornada as JornadaConFlags, asig.jornada as JornadaConFlags)) {
      const punto = asig.jornada.punto_fichaje?.nombre ?? ""
      return NextResponse.json(
        {
          error: `El horario se superpone con "${asig.jornada.nombre}" (${asig.jornada.hora_inicio}–${asig.jornada.hora_fin})${punto ? ` en ${punto}` : ""}. Revisá los días y horarios antes de asignar.`,
          conflicto: {
            nombre: asig.jornada.nombre,
            hora_inicio: asig.jornada.hora_inicio,
            hora_fin: asig.jornada.hora_fin,
            punto,
          },
        },
        { status: 400 }
      )
    }
  }

  // Todo ok — crear la asignación (sin cerrar las demás)
  const asignacion = await prisma.colaboradorJornada.create({
    data: { colaborador_id, jornada_id: jornadaId },
  })

  invalidateTag(tags.puntos(session.user.empresaId))
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

  invalidateTag(tags.puntos(session.user.empresaId))
  return NextResponse.json({ ok: true })
}
