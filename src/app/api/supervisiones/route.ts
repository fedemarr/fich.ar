import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  qr_token: z.string(),
  // Un colaborador con es_supervisor=true o un usuario legacy con rol SUPERVISOR
  colaborador_id: z.string().uuid().optional(),
  supervisor_id: z.string().uuid().optional(),
  estado: z.enum(["ok", "novedad"]),
  checklist_json: z.object({
    limpieza: z.boolean(),
    insumos: z.boolean(),
    personal: z.boolean(),
  }),
  observaciones: z.string().max(1000).optional(),
  fotos: z.array(z.string().max(2_500_000)).max(3).optional(),
}).refine((d) => d.colaborador_id ?? d.supervisor_id, {
  message: "Se requiere colaborador_id o supervisor_id",
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: parsed.data.qr_token },
    select: { id: true, empresa_id: true, activo: true },
  })
  if (!punto || !punto.activo) return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 })

  let supervisorNombre: string
  let usuarioId: string | undefined
  let colaboradorId: string | undefined

  if (parsed.data.colaborador_id) {
    // Colaborador con es_supervisor=true
    const col = await prisma.colaborador.findFirst({
      where: {
        id: parsed.data.colaborador_id,
        empresa_id: punto.empresa_id,
        es_supervisor: true,
        estado: "ACTIVO",
        deleted_at: null,
      },
      select: { id: true, nombre: true, apellido: true },
    })
    if (!col) return NextResponse.json({ error: "No autorizado para supervisar" }, { status: 403 })
    supervisorNombre = `${col.nombre} ${col.apellido}`
    colaboradorId = col.id
  } else {
    // Usuario legacy con rol SUPERVISOR asignado al punto
    const asignacion = await prisma.usuarioPunto.findFirst({
      where: {
        usuario_id: parsed.data.supervisor_id!,
        punto_fichaje_id: punto.id,
        usuario: { empresa_id: punto.empresa_id, rol: "SUPERVISOR", activo: true, deleted_at: null },
      },
      include: { usuario: { select: { nombre: true } } },
    })
    if (!asignacion) return NextResponse.json({ error: "No autorizado para supervisar este punto" }, { status: 403 })
    supervisorNombre = asignacion.usuario.nombre
    usuarioId = parsed.data.supervisor_id!
  }

  const supervision = await prisma.supervision.create({
    data: {
      empresa_id: punto.empresa_id,
      punto_fichaje_id: punto.id,
      ...(usuarioId ? { usuario_id: usuarioId } : {}),
      ...(colaboradorId ? { colaborador_id: colaboradorId } : {}),
      supervisor_nombre: supervisorNombre,
      estado: parsed.data.estado,
      checklist_json: parsed.data.checklist_json,
      observaciones: parsed.data.observaciones,
      fotos: parsed.data.fotos ?? [],
    },
    select: {
      id: true,
      timestamp: true,
      estado: true,
      checklist_json: true,
      observaciones: true,
      supervisor_nombre: true,
      fotos: true,
    },
  })

  return NextResponse.json({ ok: true, supervision }, { status: 201 })
}

export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_COLABORADORES")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const puntoId = searchParams.get("punto_id")
  const supervisorId = searchParams.get("supervisor_id")
  const limite = Math.min(Number(searchParams.get("limit") ?? "50"), 200)

  // El SUPERVISOR legacy solo ve los puntos que tiene asignados
  const puntosIds = session.user.rol === "SUPERVISOR" ? session.user.puntosIds : null

  const supervisiones = await prisma.supervision.findMany({
    where: {
      empresa_id: session.user.empresaId,
      ...(puntoId ? { punto_fichaje_id: puntoId } : {}),
      ...(puntosIds ? { punto_fichaje_id: { in: puntosIds } } : {}),
      ...(supervisorId
        ? {
            OR: [
              { colaborador_id: supervisorId },
              { usuario_id: supervisorId },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      timestamp: true,
      estado: true,
      checklist_json: true,
      observaciones: true,
      supervisor_nombre: true,
      fotos: true,
      colaborador_id: true,
      usuario_id: true,
      punto_fichaje: { select: { id: true, nombre: true } },
    },
    orderBy: { timestamp: "desc" },
    take: limite,
  })

  return NextResponse.json({
    supervisiones: supervisiones.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      estado: s.estado,
      checklist_json: s.checklist_json,
      observaciones: s.observaciones,
      supervisor_nombre: s.supervisor_nombre,
      supervisor_tipo: s.colaborador_id ? "colaborador" : "usuario",
      fotos: s.fotos,
      punto_id: s.punto_fichaje.id,
      punto_nombre: s.punto_fichaje.nombre,
    })),
  })
}
