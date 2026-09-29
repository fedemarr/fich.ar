import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  qr_sector_token: z.string().uuid(),
  colaborador_id: z.string().uuid(),
  turno_id: z.string().uuid().optional(),
})

// Ruta pública — el operario escanea el QR del sector desde la PWA
export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const sector = await prisma.sector.findFirst({
    where: { qr_sector_token: parsed.data.qr_sector_token, activo: true },
    include: { sede: { select: { nombre: true } } },
  })
  if (!sector) return NextResponse.json({ error: "Sector no encontrado" }, { status: 404 })

  const colaborador = await prisma.colaborador.findFirst({
    where: { id: parsed.data.colaborador_id, empresa_id: sector.empresa_id, deleted_at: null },
  })
  if (!colaborador) return NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 })

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const existing = await prisma.rutinaDiaria.findUnique({
    where: {
      sector_id_colaborador_id_fecha: {
        sector_id: sector.id,
        colaborador_id: colaborador.id,
        fecha: hoy,
      },
    },
  })

  if (existing?.estado === "LISTO") {
    return NextResponse.json({
      ok: true,
      estado: "LISTO",
      mensaje: "Sector ya marcado como listo hoy",
      sector: { nombre: sector.nombre, sede: sector.sede.nombre },
    })
  }

  const rutina = await prisma.rutinaDiaria.upsert({
    where: {
      sector_id_colaborador_id_fecha: {
        sector_id: sector.id,
        colaborador_id: colaborador.id,
        fecha: hoy,
      },
    },
    update: {
      estado: "LISTO",
      hora_escaneo: new Date(),
      turno_id: parsed.data.turno_id ?? null,
    },
    create: {
      empresa_id: sector.empresa_id,
      sector_id: sector.id,
      colaborador_id: colaborador.id,
      turno_id: parsed.data.turno_id ?? null,
      fecha: hoy,
      hora_escaneo: new Date(),
      estado: "LISTO",
    },
  })

  return NextResponse.json({
    ok: true,
    estado: rutina.estado,
    mensaje: "¡Sector marcado como listo!",
    sector: { nombre: sector.nombre, sede: sector.sede.nombre },
  })
}
