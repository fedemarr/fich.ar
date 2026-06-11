import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const querySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2024),
})

export async function GET(req: Request): Promise<Response> {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No auth" }, { status: 401 })

  const empresaId = session.user.empresaId
  if (!empresaId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse({
    mes: searchParams.get("mes"),
    anio: searchParams.get("anio"),
  })
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 })

  const { mes, anio } = parsed.data

  const proyeccion = await prisma.proyeccionMensual.findUnique({
    where: { empresa_id_mes_anio: { empresa_id: empresaId, mes, anio } },
    include: {
      asignaciones: {
        include: {
          colaborador: { select: { id: true, nombre: true, apellido: true, legajo: true } },
          punto_fichaje: { select: { id: true, nombre: true } },
        },
        orderBy: [{ servicio_nombre: "asc" }, { colaborador: { apellido: "asc" } }],
      },
    },
  })

  return NextResponse.json(proyeccion)
}
