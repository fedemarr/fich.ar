import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  estado: z.enum(["OMITIDA", "EN_CURSO"]),
  colaborador_id: z.string().uuid(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ token: string; etId: string }> }
) {
  const { token, etId } = await params

  const punto = await prisma.puntoFichaje.findFirst({
    where: { operaciones_token: token, activo: true },
    select: { empresa_id: true, empresa: { select: { modulo_operaciones: true } } },
  })
  if (!punto) return NextResponse.json({ error: "QR inválido" }, { status: 404 })
  if (!punto.empresa.modulo_operaciones) return NextResponse.json({ error: "Módulo no activo" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { estado, colaborador_id } = parsed.data

  const et = await prisma.ejecucionTarea.findFirst({
    where: {
      id: etId,
      ejecucion_procedimiento: { empresa_id: punto.empresa_id },
    },
    select: { id: true, ejecucion_procedimiento_id: true },
  })
  if (!et) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 })

  await prisma.ejecucionTarea.update({
    where: { id: etId },
    data: { estado, colaborador_id },
  })

  return NextResponse.json({ ok: true })
}
