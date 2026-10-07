import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { puntosDeOtraEmpresa, verificarEmailSupervisor } from "@/lib/supervisor-cuentas"

const editarSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
  identificacion: z.string().optional(),
  activo: z.boolean(),
  puedeGestionarPuntos: z.boolean(),
  puntosIds: z.array(z.string()).min(1, "Seleccioná al menos un punto QR"),
})

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  const session = await auth()
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = editarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 })
  }

  const { nombre, email, password, identificacion, activo, puedeGestionarPuntos, puntosIds } = parsed.data

  const existing = await prisma.usuario.findFirst({
    where: { id, empresa_id: session.user.empresaId, rol: "SUPERVISOR", deleted_at: null },
  })
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  if (await puntosDeOtraEmpresa(session.user.empresaId, puntosIds)) {
    return NextResponse.json({ error: "Alguno de los puntos seleccionados no existe" }, { status: 400 })
  }
  const chequeo = await verificarEmailSupervisor(session.user.empresaId, email, id)
  if (chequeo.error) return NextResponse.json({ error: chequeo.error }, { status: 409 })

  const dataUpdate: Record<string, unknown> = {
    nombre,
    email,
    identificacion: identificacion?.trim() || null,
    activo,
    puede_gestionar_puntos: puedeGestionarPuntos,
  }
  if (password) dataUpdate.password = await bcrypt.hash(password, 10)

  await prisma.$transaction([
    prisma.usuarioPunto.deleteMany({ where: { usuario_id: id } }),
    prisma.usuario.update({
      where: { id },
      data: {
        ...dataUpdate,
        puntos_asignados: {
          create: puntosIds.map((pid) => ({ punto_fichaje_id: pid })),
        },
      },
    }),
  ])

  const updated = await prisma.usuario.findUnique({
    where: { id },
    include: {
      puntos_asignados: {
        include: { punto_fichaje: { select: { id: true, nombre: true } } },
      },
    },
  })

  return NextResponse.json({
    id: updated!.id,
    nombre: updated!.nombre,
    email: updated!.email,
    activo: updated!.activo,
    puedeGestionarPuntos: updated!.puede_gestionar_puntos,
    puntos: updated!.puntos_asignados.map((p) => ({
      id: p.punto_fichaje.id,
      nombre: p.punto_fichaje.nombre,
    })),
  })
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.usuario.findFirst({
    where: { id, empresa_id: session.user.empresaId, rol: "SUPERVISOR", deleted_at: null },
  })
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  await prisma.usuario.update({
    where: { id },
    data: { deleted_at: new Date(), activo: false },
  })

  return NextResponse.json({ ok: true })
}
