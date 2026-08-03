import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  turno_id: z.string().uuid(),
  nombre: z.string().min(1).max(150),
  descripcion: z.string().max(500).optional(),
  lunes: z.boolean().default(false),
  martes: z.boolean().default(false),
  miercoles: z.boolean().default(false),
  jueves: z.boolean().default(false),
  viernes: z.boolean().default(false),
  sabado: z.boolean().default(false),
  domingo: z.boolean().default(false),
})

export async function GET() {
  const { error, session } = await verificarAcceso("VER_PUNTOS")
  if (error) return error

  const procedimientos = await prisma.procedimiento.findMany({
    where: { empresa_id: session.user.empresaId },
    include: {
      turno: { select: { id: true, nombre: true, hora_inicio: true, hora_fin: true } },
      _count: { select: { tareas: { where: { activo: true } } } },
    },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  })

  return NextResponse.json({ procedimientos })
}

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_PUNTO")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  // Verificar que el turno pertenece a la empresa
  const turno = await prisma.turno.findFirst({
    where: { id: parsed.data.turno_id, empresa_id: session.user.empresaId },
  })
  if (!turno) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })

  const procedimiento = await prisma.procedimiento.create({
    data: { ...parsed.data, empresa_id: session.user.empresaId },
    include: { turno: { select: { id: true, nombre: true, hora_inicio: true, hora_fin: true } } },
  })

  return NextResponse.json({ procedimiento }, { status: 201 })
}
