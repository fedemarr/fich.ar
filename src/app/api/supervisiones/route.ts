import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  qr_token: z.string(),
  supervisor_id: z.string().uuid(),
  estado: z.enum(["ok", "novedad"]),
  checklist_json: z.object({
    limpieza: z.boolean(),
    insumos: z.boolean(),
    personal: z.boolean(),
  }),
  observaciones: z.string().max(1000).optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: parsed.data.qr_token },
    select: { id: true, empresa_id: true, activo: true },
  })
  if (!punto || !punto.activo) return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 })

  // Verificar que el supervisor pertenece a esta empresa y está asignado a este punto
  const asignacion = await prisma.usuarioPunto.findFirst({
    where: {
      usuario_id: parsed.data.supervisor_id,
      punto_fichaje_id: punto.id,
      usuario: { empresa_id: punto.empresa_id, rol: "SUPERVISOR", activo: true, deleted_at: null },
    },
  })
  if (!asignacion) return NextResponse.json({ error: "No autorizado para supervisar este punto" }, { status: 403 })

  const supervision = await prisma.supervision.create({
    data: {
      empresa_id: punto.empresa_id,
      punto_fichaje_id: punto.id,
      usuario_id: parsed.data.supervisor_id,
      estado: parsed.data.estado,
      checklist_json: parsed.data.checklist_json,
      observaciones: parsed.data.observaciones,
    },
    select: {
      id: true,
      timestamp: true,
      estado: true,
      checklist_json: true,
      observaciones: true,
    },
  })

  return NextResponse.json({ ok: true, supervision }, { status: 201 })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const punto_id = searchParams.get("punto_id")
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50)

  if (!punto_id) return NextResponse.json({ error: "punto_id requerido" }, { status: 400 })

  const supervisiones = await prisma.supervision.findMany({
    where: { punto_fichaje_id: punto_id },
    include: {
      supervisor: { select: { nombre: true } },
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  })

  return NextResponse.json({ supervisiones })
}
