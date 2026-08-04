import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  nombre: z.string().min(1).max(100),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/),
})

export async function GET() {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const turnos = await prisma.turno.findMany({
    where: { empresa_id: session.user.empresaId, activo: true },
    orderBy: { hora_inicio: "asc" },
  })

  return NextResponse.json({ turnos })
}

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO", "operaciones")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos invÃ¡lidos" }, { status: 400 })

  const turno = await prisma.turno.create({
    data: { ...parsed.data, empresa_id: session.user.empresaId },
  })

  return NextResponse.json({ turno }, { status: 201 })
}
