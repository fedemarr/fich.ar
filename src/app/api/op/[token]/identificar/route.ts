import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  dni: z.string().optional(),
  celular: z.string().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const punto = await prisma.puntoFichaje.findFirst({
    where: { operaciones_token: token, activo: true },
    select: { empresa_id: true, empresa: { select: { modulo_operaciones: true } } },
  })
  if (!punto) return NextResponse.json({ error: "QR inválido" }, { status: 404 })
  if (!punto.empresa.modulo_operaciones) return NextResponse.json({ error: "Módulo no activo" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { dni, celular } = parsed.data
  if (!dni && !celular) return NextResponse.json({ error: "Ingresá DNI o celular" }, { status: 400 })

  let colaborador = null

  if (dni) {
    colaborador = await prisma.colaborador.findFirst({
      where: {
        empresa_id: punto.empresa_id,
        identificacion: dni.replace(/\./g, "").trim(),
        estado: "ACTIVO",
        deleted_at: null,
      },
      select: { id: true, nombre: true, apellido: true },
    })
  }

  if (!colaborador && celular) {
    const num = celular.replace(/[\s\-().+]/g, "")
    colaborador = await prisma.colaborador.findFirst({
      where: {
        empresa_id: punto.empresa_id,
        celular: { contains: num },
        estado: "ACTIVO",
        deleted_at: null,
      },
      select: { id: true, nombre: true, apellido: true },
    })
  }

  if (!colaborador) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json({ colaborador })
}
