import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { verificarAcceso } from "@/lib/auth-helpers"

const TIPOS_RECLAMO = ["FALTA_PAPEL", "CESTO_LLENO", "DERRAME", "SUCIO", "OTRO"] as const

const schemaPublico = z.object({
  qr_sector_token: z.string().uuid(),
  tipo: z.enum(TIPOS_RECLAMO),
  descripcion: z.string().max(500).optional(),
})

// POST público — cualquiera con el QR puede reportar
export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schemaPublico.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const sector = await prisma.sector.findFirst({
    where: { qr_sector_token: parsed.data.qr_sector_token, activo: true },
  })
  if (!sector) return NextResponse.json({ error: "Sector no encontrado" }, { status: 404 })

  // Rate limiting: no crear duplicado del mismo sector + tipo en 10 minutos
  const hace10min = new Date(Date.now() - 600000)
  const reciente = await prisma.reclamo.findFirst({
    where: {
      sector_id: sector.id,
      tipo: parsed.data.tipo,
      estado: { not: "CERRADO" },
      hora_aviso: { gte: hace10min },
    },
  })
  if (reciente) {
    return NextResponse.json({
      ok: true,
      reclamo_id: reciente.id,
      mensaje: "Aviso ya registrado, el equipo está en camino",
    })
  }

  const reclamo = await prisma.reclamo.create({
    data: {
      empresa_id: sector.empresa_id,
      sector_id: sector.id,
      tipo: parsed.data.tipo,
      descripcion: parsed.data.descripcion,
      estado: "ABIERTO",
    },
  })

  return NextResponse.json({ ok: true, reclamo_id: reclamo.id }, { status: 201 })
}

// GET autenticado — panel interno
export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const sede_id = searchParams.get("sede_id")
  const estado = searchParams.get("estado")

  const reclamos = await prisma.reclamo.findMany({
    where: {
      empresa_id: session.user.empresaId,
      ...(estado ? { estado } : {}),
      ...(sede_id
        ? { sector: { sede_id } }
        : {}),
    },
    include: {
      sector: { select: { nombre: true, sede: { select: { nombre: true } } } },
      colaborador: { select: { nombre: true, apellido: true } },
    },
    orderBy: { hora_aviso: "desc" },
    take: 100,
  })

  return NextResponse.json({ reclamos })
}
