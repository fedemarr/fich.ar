import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { puntosDeOtraEmpresa, verificarEmailSupervisor } from "@/lib/supervisor-cuentas"

const crearSchema = z.object({
  nombre: z.string().trim().min(1, "Elegí el colaborador o escribí el nombre"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  identificacion: z.string().optional(),
  puedeGestionarPuntos: z.boolean().default(false),
  puntosIds: z.array(z.string()).min(1, "Seleccioná al menos un punto QR"),
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
      identificacion: s.identificacion,
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
    return NextResponse.json({ error: "Solo un administrador puede crear supervisores" }, { status: 403 })
  }
  const empresaId = session.user.empresaId

  const parsed = crearSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 })
  }

  const { nombre, email, password, identificacion, puedeGestionarPuntos, puntosIds } = parsed.data

  if (await puntosDeOtraEmpresa(empresaId, puntosIds)) {
    return NextResponse.json({ error: "Alguno de los puntos seleccionados no existe" }, { status: 400 })
  }

  const chequeo = await verificarEmailSupervisor(empresaId, email)
  if (chequeo.error) return NextResponse.json({ error: chequeo.error }, { status: 409 })

  const hash = await bcrypt.hash(password, 10)
  const datos = {
    nombre,
    password: hash,
    identificacion: identificacion?.trim() || null,
    rol: "SUPERVISOR" as const,
    activo: true,
    puede_gestionar_puntos: puedeGestionarPuntos,
  }

  // Un supervisor dado de baja con el mismo email se reactiva: el email es único y si no, no se podría volver a crear
  const supervisor = chequeo.reactivarId
    ? await prisma.$transaction(async (tx) => {
        await tx.usuarioPunto.deleteMany({ where: { usuario_id: chequeo.reactivarId } })
        return tx.usuario.update({
          where: { id: chequeo.reactivarId },
          data: {
            ...datos,
            deleted_at: null,
            puntos_asignados: { create: puntosIds.map((id) => ({ punto_fichaje_id: id })) },
          },
          include: { puntos_asignados: { include: { punto_fichaje: { select: { id: true, nombre: true } } } } },
        })
      })
    : await prisma.usuario.create({
        data: {
          ...datos,
          empresa_id: empresaId,
          email,
          puntos_asignados: { create: puntosIds.map((id) => ({ punto_fichaje_id: id })) },
        },
        include: { puntos_asignados: { include: { punto_fichaje: { select: { id: true, nombre: true } } } } },
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
  }, { status: 201 })
}
