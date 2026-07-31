import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

export async function GET() {
  const { error } = await verificarAcceso("VER_TODAS_EMPRESAS")
  if (error) return error

  const cobros = await prisma.cobro.findMany({
    orderBy: { created_at: "desc" },
    include: { empresa: { select: { id: true, nombre: true, slug: true } } },
  })

  const empresas = await prisma.empresa.findMany({
    where: { deleted_at: null },
    select: { id: true, nombre: true, slug: true },
    orderBy: { nombre: "asc" },
  })

  return NextResponse.json({ cobros, empresas })
}

const crearSchema = z.object({
  empresa_id: z.string().uuid(),
  concepto: z.string().min(1).max(200),
  monto: z.number().positive(),
  moneda: z.enum(["ARS", "USD"]).default("ARS"),
  periodo: z.string().max(50).optional(),
  fecha_vencimiento: z.string().optional(),
  nota: z.string().max(500).optional(),
})

export async function POST(req: Request) {
  const { error } = await verificarAcceso("VER_TODAS_EMPRESAS")
  if (error) return error

  const body = await req.json()
  const parsed = crearSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { empresa_id, concepto, monto, moneda, periodo, fecha_vencimiento, nota } = parsed.data

  const cobro = await prisma.cobro.create({
    data: {
      empresa_id,
      concepto,
      monto,
      moneda,
      periodo: periodo ?? null,
      fecha_vencimiento: fecha_vencimiento ? new Date(fecha_vencimiento) : null,
      nota: nota ?? null,
    },
    include: { empresa: { select: { id: true, nombre: true, slug: true } } },
  })

  return NextResponse.json({ cobro }, { status: 201 })
}

const patchSchema = z.object({
  estado: z.enum(["PENDIENTE", "PAGADO", "VENCIDO"]).optional(),
  fecha_pago: z.string().optional(),
  nota: z.string().max(500).optional(),
  monto: z.number().positive().optional(),
})

export async function PATCH(req: Request) {
  const { error } = await verificarAcceso("VER_TODAS_EMPRESAS")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const cobro = await prisma.cobro.update({
    where: { id },
    data: {
      ...parsed.data,
      fecha_pago: parsed.data.estado === "PAGADO"
        ? (parsed.data.fecha_pago ? new Date(parsed.data.fecha_pago) : new Date())
        : parsed.data.estado === "PENDIENTE" ? null : undefined,
    },
    include: { empresa: { select: { id: true, nombre: true, slug: true } } },
  })

  return NextResponse.json({ cobro })
}

export async function DELETE(req: Request) {
  const { error } = await verificarAcceso("VER_TODAS_EMPRESAS")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 })

  await prisma.cobro.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
