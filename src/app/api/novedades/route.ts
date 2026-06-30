import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { TipoNovedad } from "@/generated/prisma/client"
import { verificarAcceso } from "@/lib/auth-helpers"
import { registrarAudit } from "@/lib/audit"

const TIPOS_NOVEDAD = ["P", "PT", "ST", "AU", "VAC", "EN", "FR", "FE", "HDO", "C", "DES", "VIR"] as const

const schema = z.object({
  colaborador_id: z.string().min(1),
  fecha: z.string().min(1),
  tipo: z.enum(TIPOS_NOVEDAD),
  observacion: z.string().optional(),
  aprobada: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_NOVEDAD")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const colaborador = await prisma.colaborador.findFirst({
    where: { id: parsed.data.colaborador_id, empresa_id: session.user.empresaId },
  })
  if (!colaborador) return NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 })

  const fecha = new Date(parsed.data.fecha + "T12:00:00.000Z")

  const novedad = await prisma.novedad.create({
    data: {
      empresa_id: session.user.empresaId,
      colaborador_id: parsed.data.colaborador_id,
      fecha,
      tipo: parsed.data.tipo as TipoNovedad,
      observacion: parsed.data.observacion ?? null,
      aprobada: parsed.data.aprobada ?? false,
    },
    include: { colaborador: true },
  })

  await registrarAudit({
    empresa_id: session.user.empresaId,
    usuario_id: session.user.id,
    rol: session.user.rol,
    accion: "CREAR_NOVEDAD",
    entidad: "novedad",
    entidad_id: novedad.id,
    detalle: { tipo: parsed.data.tipo, fecha: parsed.data.fecha },
  })

  return NextResponse.json(novedad, { status: 201 })
}

export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_NOVEDADES")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")

  const novedades = await prisma.novedad.findMany({
    where: {
      empresa_id: session.user.empresaId,
      ...(desde && hasta
        ? { fecha: { gte: new Date(desde + "T00:00:00"), lte: new Date(hasta + "T23:59:59") } }
        : {}),
    },
    include: { colaborador: true },
    orderBy: { fecha: "desc" },
  })

  return NextResponse.json(novedades)
}
