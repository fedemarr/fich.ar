import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const crearSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  puedeGestionarPuntos: z.boolean().default(false),
  puntosIds: z.array(z.string()).min(1),
})

export async function GET() {
  const session = await auth()
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const supervisores = await prisma.usuario.findMany({
    where: {
      empresa_id: session.user.empresaId,
      rol: "SUPERVISOR",
      deleted_at: null,
    },
    include: {
      puntos_asignados: {
        include: { punto_fichaje: { select: { id: true, nombre: true } } },
      },
    },
    orderBy: { nombre: "asc" },
  })

  return NextResponse.json(
    supervisores.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      email: s.email,
      activo: s.activo,
      puedeGestionarPuntos: s.puede_gestionar_puntos,
      puntos: s.puntos_asignados.map((p) => ({
        id: p.punto_fichaje.id,
        nombre: p.punto_fichaje.nombre,
      })),
    }))
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = crearSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { nombre, email, password, puedeGestionarPuntos, puntosIds } = parsed.data
  const hash = await bcrypt.hash(password, 10)

  const supervisor = await prisma.usuario.create({
    data: {
      empresa_id: session.user.empresaId,
      nombre,
      email,
      password: hash,
      rol: "SUPERVISOR",
      puede_gestionar_puntos: puedeGestionarPuntos,
      puntos_asignados: {
        create: puntosIds.map((id) => ({ punto_fichaje_id: id })),
      },
    },
    include: {
      puntos_asignados: {
        include: { punto_fichaje: { select: { id: true, nombre: true } } },
      },
    },
  })

  return NextResponse.json({
    id: supervisor.id,
    nombre: supervisor.nombre,
    email: supervisor.email,
    activo: supervisor.activo,
    puedeGestionarPuntos: supervisor.puede_gestionar_puntos,
    puntos: supervisor.puntos_asignados.map((p) => ({
      id: p.punto_fichaje.id,
      nombre: p.punto_fichaje.nombre,
    })),
  })
}
