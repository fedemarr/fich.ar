import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  colaborador_id: z.string().uuid(),
  foto_antes_url: z.string().optional(),
  foto_antes_hash: z.string().optional(),
  foto_despues_url: z.string().optional(),
  foto_despues_hash: z.string().optional(),
  solo_asignar: z.boolean().optional(),
})

// Ruta semi-pública — el operario accede desde la PWA con su colaborador_id
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const reclamo = await prisma.reclamo.findUnique({
    where: { id },
    select: { id: true, empresa_id: true, hora_aviso: true, estado: true, colaborador_id: true },
  })
  if (!reclamo) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (reclamo.estado === "CERRADO") return NextResponse.json({ error: "Reclamo ya cerrado" }, { status: 400 })

  const colaborador = await prisma.colaborador.findFirst({
    where: { id: parsed.data.colaborador_id, empresa_id: reclamo.empresa_id, deleted_at: null },
  })
  if (!colaborador) return NextResponse.json({ error: "Colaborador no válido" }, { status: 403 })

  // Solo asignar al operario sin cerrar
  if (parsed.data.solo_asignar) {
    await prisma.reclamo.update({
      where: { id },
      data: { colaborador_id: parsed.data.colaborador_id, estado: "EN_PROCESO" },
    })
    return NextResponse.json({ ok: true, estado: "EN_PROCESO" })
  }

  const ahora = new Date()
  const minutos = Math.round((ahora.getTime() - reclamo.hora_aviso.getTime()) / 60000)

  await prisma.reclamo.update({
    where: { id },
    data: {
      colaborador_id: parsed.data.colaborador_id,
      foto_antes_url: parsed.data.foto_antes_url,
      foto_antes_hash: parsed.data.foto_antes_hash,
      foto_despues_url: parsed.data.foto_despues_url,
      foto_despues_hash: parsed.data.foto_despues_hash,
      hora_cierre: ahora,
      tiempo_resolucion_min: minutos,
      estado: "CERRADO",
    },
  })

  return NextResponse.json({ ok: true, tiempo_resolucion_min: minutos })
}
