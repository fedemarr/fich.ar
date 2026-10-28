import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { tags, invalidateTag } from "@/lib/queries"
import { jornadasSeSolapan } from "@/lib/jornadas"

const patchSchema = z.object({
  nombre: z.string().min(1),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/),
  tolerancia_min: z.number().min(0).max(60),
  es_clase: z.boolean().optional(),
  lunes_presencial: z.boolean(),
  martes_presencial: z.boolean(),
  miercoles_presencial: z.boolean(),
  jueves_presencial: z.boolean(),
  viernes_presencial: z.boolean(),
  sabado_presencial: z.boolean(),
  domingo_presencial: z.boolean(),
  lunes_virtual: z.boolean(),
  martes_virtual: z.boolean(),
  miercoles_virtual: z.boolean(),
  jueves_virtual: z.boolean(),
  viernes_virtual: z.boolean(),
  sabado_virtual: z.boolean(),
  domingo_virtual: z.boolean(),
})

const asignacionVigente = () => ({ OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: new Date() } }] })

// PATCH — editar horario, días y nombre del turno
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const jornada = await prisma.jornada.findFirst({
    where: { id, empresa_id: session.user.empresaId, activo: true },
    include: { empresa: { select: { fichaje_por_clase: true } } },
  })
  if (!jornada) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const data = parsed.data
  if (data.es_clase && !jornada.empresa.fichaje_por_clase) {
    return NextResponse.json({ error: "Esta empresa no ficha por clase" }, { status: 400 })
  }

  // Con el nuevo horario, ningún colaborador del turno puede quedar superpuesto con otro turno suyo
  const asignados = await prisma.colaboradorJornada.findMany({
    where: { jornada_id: id, ...asignacionVigente() },
    select: { colaborador_id: true, colaborador: { select: { nombre: true, apellido: true } } },
  })
  if (asignados.length > 0) {
    const otras = await prisma.colaboradorJornada.findMany({
      where: {
        colaborador_id: { in: asignados.map((a) => a.colaborador_id) },
        jornada_id: { not: id },
        jornada: { activo: true },
        ...asignacionVigente(),
      },
      include: { jornada: { include: { punto_fichaje: { select: { nombre: true } } } } },
    })
    for (const otra of otras) {
      if (jornadasSeSolapan(data, otra.jornada)) {
        const colab = asignados.find((a) => a.colaborador_id === otra.colaborador_id)?.colaborador
        const quien = colab ? `${colab.nombre} ${colab.apellido}` : "Un colaborador"
        return NextResponse.json(
          {
            error: `${quien} quedaría superpuesto con "${otra.jornada.nombre}" (${otra.jornada.hora_inicio}–${otra.jornada.hora_fin}) en ${otra.jornada.punto_fichaje.nombre}.`,
          },
          { status: 400 }
        )
      }
    }
  }

  const actualizada = await prisma.jornada.update({
    where: { id },
    data: { ...data, es_clase: data.es_clase ?? jornada.es_clase },
  })

  invalidateTag(tags.jornadas(session.user.empresaId))
  invalidateTag(tags.puntos(session.user.empresaId))
  return NextResponse.json(actualizada)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  // Verify jornada belongs to empresa via punto
  const jornada = await prisma.jornada.findFirst({
    where: { id },
    include: { punto_fichaje: true },
  })

  if (!jornada || jornada.punto_fichaje.empresa_id !== session.user.empresaId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  // Al eliminar el turno se cierran también sus asignaciones, para que no
  // bloqueen (por superposición) asignar a esas personas a otro turno
  await prisma.$transaction([
    prisma.jornada.update({
      where: { id },
      data: { activo: false },
    }),
    prisma.colaboradorJornada.updateMany({
      where: { jornada_id: id, ...asignacionVigente() },
      data: { fecha_hasta: new Date() },
    }),
  ])

  invalidateTag(tags.jornadas(jornada.punto_fichaje.empresa_id))
  invalidateTag(tags.puntos(jornada.punto_fichaje.empresa_id))
  return NextResponse.json({ ok: true })
}
