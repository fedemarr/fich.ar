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
  email: z.string().email().optional().or(z.literal("")),
  legajo: z.string().optional(),
  sector: z.string().optional(),
  domicilio: z.string().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO", "DESACTIVADO"]).default("ACTIVO"),
  jornada_id: z.string().optional(),
})

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_COLABORADOR")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { jornada_id, email, legajo, sector, domicilio, ...rest } = parsed.data
  const empresaId = session.user.empresaId

  const colaborador = await prisma.colaborador.create({
    data: {
      ...rest,
      celular: normalizarCelular(rest.celular),
      email: email || null,
      legajo: legajo || null,
      sector: sector || null,
      domicilio: domicilio || null,
      empresa_id: empresaId,
    },
  })

  if (jornada_id) {
    await prisma.colaboradorJornada.create({
      data: { colaborador_id: colaborador.id, jornada_id, fecha_desde: new Date() },
    })
  }

  await registrarAudit({
    empresa_id: empresaId,
    usuario_id: session.user.id,
    rol: session.user.rol,
    accion: "CREAR_COLABORADOR",
    entidad: "colaborador",
    entidad_id: colaborador.id,
    detalle: { nombre: colaborador.nombre, apellido: colaborador.apellido, legajo },
  })

  invalidateTag(tags.colaboradores(empresaId))
  return NextResponse.json(colaborador, { status: 201 })
}
