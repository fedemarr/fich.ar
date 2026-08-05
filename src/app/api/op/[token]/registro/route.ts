import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  identificacion: z.string().min(4).max(20),
  celular: z.string().min(6).max(30),
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
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", detalles: parsed.error.flatten() }, { status: 400 })

  const { nombre, apellido, identificacion, celular } = parsed.data

  // Verificar que no exista ya ese DNI en la empresa
  const existente = await prisma.colaborador.findFirst({
    where: { empresa_id: punto.empresa_id, identificacion, deleted_at: null },
  })
  if (existente) {
    return NextResponse.json({ error: "Ya existe un asociado con ese DNI" }, { status: 409 })
  }

  // Formatear celular con prefijo argentina si no lo tiene
  const celularFormateado = celular.startsWith("+") ? celular : `+549${celular.replace(/^0?/, "")}`

  const colaborador = await prisma.colaborador.create({
    data: {
      empresa_id: punto.empresa_id,
      nombre,
      apellido,
      identificacion,
      celular: celularFormateado,
      estado: "ACTIVO",
    },
    select: { id: true, nombre: true, apellido: true },
  })

  return NextResponse.json({ colaborador }, { status: 201 })
}
