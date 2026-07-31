import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { TipoNovedad } from "@/generated/prisma/client"

const schema = z.object({
  tipo: z.enum(["P", "PT", "AU", "VAC", "EN", "FR", "FE", "HDO", "C", "DES", "VIR"]),
  fechas: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(62),
  colaborador_ids: z.array(z.string().uuid()).min(1).max(500),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const empresaId = session.user.empresaId
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { tipo, fechas, colaborador_ids } = parsed.data

  const colabs = await prisma.colaborador.findMany({
    where: { id: { in: colaborador_ids }, empresa_id: empresaId, deleted_at: null },
    select: { id: true },
  })
  const validIds = new Set(colabs.map((c) => c.id))

  const data: {
    empresa_id: string
    colaborador_id: string
    fecha: Date
    tipo: TipoNovedad
    aprobada: boolean
  }[] = []

  for (const fecha of fechas) {
    for (const colaborador_id of colaborador_ids) {
      if (!validIds.has(colaborador_id)) continue
      data.push({
        empresa_id: empresaId,
        colaborador_id,
        fecha: new Date(fecha + "T12:00:00.000Z"),
        tipo: tipo as TipoNovedad,
        aprobada: true,
      })
    }
  }

  if (data.length === 0) return NextResponse.json({ ok: true, creadas: 0 })

  const result = await prisma.novedad.createMany({ data, skipDuplicates: true })
  return NextResponse.json({ ok: true, creadas: result.count })
}
