import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { normalizarCelular } from "@/lib/utils"
import { verificarAcceso } from "@/lib/auth-helpers"
import { registrarAudit } from "@/lib/audit"
import { tags, invalidateTag } from "@/lib/queries"

const schema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  celular: z.string().min(10),
  identificacion: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  legajo: z.string().optional(),
  sector: z.string().optional(),
  domicilio: z.string().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO", "DESACTIVADO"]),
  jornada_id: z.string().optional(),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("EDITAR_COLABORADOR")
  if (error) return error

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const empresaId = session.user.empresaId
  const { jornada_id, email, legajo, sector, domicilio, identificacion, ...rest } = parsed.data

  const colaborador = await prisma.colaborador.findFirst({
    where: { id, empresa_id: empresaId, deleted_at: null },
  })
  if (!colaborador) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.colaborador.update({
    where: { id },
    data: {
      ...rest,
      celular: normalizarCelular(rest.celular),
      email: email || null,
      legajo: legajo || null,
      sector: sector || null,
      domicilio: domicilio || null,
      identificacion: identificacion || null,
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

  await registrarAudit({
    empresa_id: empresaId,
    usuario_id: session.user.id,
    rol: session.user.rol,
    accion: "EDITAR_COLABORADOR",
    entidad: "colaborador",
    entidad_id: id,
    detalle: { nombre: rest.nombre, apellido: rest.apellido },
  })

  invalidateTag(tags.colaboradores(empresaId))
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("DESACTIVAR_COLABORADOR")
  if (error) return error

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

  await registrarAudit({
    empresa_id: empresaId,
    usuario_id: session.user.id,
    rol: session.user.rol,
    accion: "DESACTIVAR_COLABORADOR",
    entidad: "colaborador",
    entidad_id: id,
    detalle: { nombre: colaborador.nombre, apellido: colaborador.apellido },
  })

  invalidateTag(tags.colaboradores(empresaId))
  return NextResponse.json({ ok: true })
}
