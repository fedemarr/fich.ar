import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  qr_sector_token: z.string().uuid(),
  dni: z.string().min(6).max(15),
})

// Ruta pública — identifica al colaborador por DNI dentro del contexto del sector
export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const sector = await prisma.sector.findFirst({
    where: { qr_sector_token: parsed.data.qr_sector_token, activo: true },
    select: { empresa_id: true },
  })
  if (!sector) return NextResponse.json({ error: "Sector no encontrado" }, { status: 404 })

  const colaborador = await prisma.colaborador.findFirst({
    where: {
      empresa_id: sector.empresa_id,
      identificacion: parsed.data.dni,
      deleted_at: null,
      estado: "ACTIVO",
    },
    select: { id: true, nombre: true, apellido: true },
  })
  if (!colaborador) return NextResponse.json({ error: "DNI no encontrado" }, { status: 404 })

  return NextResponse.json({ colaborador })
}
