import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  punto_fichaje_id: z.string().min(1),
  nombre: z.string().min(1),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/),
  tolerancia_min: z.number().min(0).max(60),
  lunes_presencial: z.boolean().optional().default(false),
  martes_presencial: z.boolean().optional().default(false),
  miercoles_presencial: z.boolean().optional().default(false),
  jueves_presencial: z.boolean().optional().default(false),
  viernes_presencial: z.boolean().optional().default(false),
  sabado_presencial: z.boolean().optional().default(false),
  domingo_presencial: z.boolean().optional().default(false),
  lunes_virtual: z.boolean().optional().default(false),
  martes_virtual: z.boolean().optional().default(false),
  miercoles_virtual: z.boolean().optional().default(false),
  jueves_virtual: z.boolean().optional().default(false),
  viernes_virtual: z.boolean().optional().default(false),
  sabado_virtual: z.boolean().optional().default(false),
  domingo_virtual: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  // Verify the punto belongs to this empresa
  const punto = await prisma.puntoFichaje.findFirst({
    where: { id: parsed.data.punto_fichaje_id, empresa_id: session.user.empresaId },
  })
  if (!punto) return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 })

  const { punto_fichaje_id, ...jornadaData } = parsed.data
  const jornada = await prisma.jornada.create({
    data: { ...jornadaData, punto_fichaje_id, empresa_id: session.user.empresaId },
  })

  return NextResponse.json(jornada, { status: 201 })
}
