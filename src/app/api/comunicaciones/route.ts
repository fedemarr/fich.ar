import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { verificarAcceso } from "@/lib/auth-helpers"
import { registrarAudit } from "@/lib/audit"

const schema = z.object({
  texto: z.string().min(1),
  fecha_inicio: z.string().min(1),
  fecha_fin: z.string().min(1),
  activa: z.boolean().optional().default(true),
})

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_COMUNICACION")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const comunicacion = await prisma.comunicacion.create({
    data: {
      empresa_id: session.user.empresaId,
      texto: parsed.data.texto,
      fecha_inicio: new Date(parsed.data.fecha_inicio),
      fecha_fin: new Date(parsed.data.fecha_fin),
      activa: parsed.data.activa ?? true,
    },
  })

  await registrarAudit({
    empresa_id: session.user.empresaId,
    usuario_id: session.user.id,
    rol: session.user.rol,
    accion: "CREAR_COMUNICACION",
    entidad: "comunicacion",
    entidad_id: comunicacion.id,
    detalle: { texto: parsed.data.texto.slice(0, 80) },
  })

  return NextResponse.json(comunicacion, { status: 201 })
}

export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_COMUNICACIONES")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const soloActivas = searchParams.get("activas") === "true"

  const comunicaciones = await prisma.comunicacion.findMany({
    where: {
      empresa_id: session.user.empresaId,
      deleted_at: null,
      ...(soloActivas ? { activa: true, fecha_fin: { gte: new Date() } } : {}),
    },
    orderBy: { fecha_inicio: "desc" },
  })

  return NextResponse.json(comunicaciones)
}
