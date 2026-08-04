import { NextResponse } from "next/server"
import { verificarAcceso } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { tags, invalidateTag } from "@/lib/queries"

const schema = z.object({
  nombre: z.string().min(1),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  radio_metros: z.number().min(50).max(2000),
})

export async function GET() {
  const { error, session } = await verificarAcceso("VER_PUNTOS")
  if (error) return error

  const puntos = await prisma.puntoFichaje.findMany({
    where: { empresa_id: session.user.empresaId, activo: true },
    select: { id: true, nombre: true, operaciones_token: true },
    orderBy: { nombre: "asc" },
  })

  return NextResponse.json({ puntos })
}

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const punto = await prisma.puntoFichaje.create({
    data: { ...parsed.data, empresa_id: session.user.empresaId },
  })

  invalidateTag(tags.puntos(session.user.empresaId))
  return NextResponse.json(punto, { status: 201 })
}
