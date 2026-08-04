import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { registrarAudit } from "@/lib/audit"
import { z } from "zod"

const checklistRespSchema = z.object({ texto: z.string(), marcado: z.boolean() })

// Asociado completa o salta una tarea (sin sesión — usa colaborador_id del body)
// Supervisor aprueba o rechaza (con sesión verificada)
const bodySchema = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("iniciar"),
    colaborador_id: z.string().uuid(),
  }),
  z.object({
    accion: z.literal("completar"),
    colaborador_id: z.string().uuid(),
    comentario: z.string().max(1000).optional(),
    checklist_completado: z.array(checklistRespSchema).optional(),
    latitud: z.number().optional(),
    longitud: z.number().optional(),
  }),
  z.object({
    accion: z.literal("omitir"),
    colaborador_id: z.string().uuid(),
    motivo_salteo: z.string().min(1).max(300),
  }),
  z.object({
    accion: z.literal("aprobar"),
  }),
  z.object({
    accion: z.literal("rechazar"),
    motivo_rechazo: z.string().min(1).max(500),
  }),
])

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ejecucionId: string; tareaId: string }> }
) {
  const { ejecucionId, tareaId } = await params

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const data = parsed.data

  // Verificar que la ejecución de tarea existe y obtener empresa_id
  const et = await prisma.ejecucionTarea.findFirst({
    where: {
      id: tareaId,
      ejecucion_procedimiento_id: ejecucionId,
    },
    include: {
      tarea: { select: { es_critica: true, foto_min: true, requiere_comentario: true } },
      fotos: { select: { id: true, estado_subida: true } },
      ejecucion_procedimiento: { select: { empresa_id: true } },
    },
  })
  if (!et) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  const empresaId = et.ejecucion_procedimiento.empresa_id

  // Acciones del asociado (iniciar / completar / omitir) — no requieren sesión de admin
  if (data.accion === "iniciar") {
    const colab = await prisma.colaborador.findFirst({
      where: { id: data.colaborador_id, empresa_id: empresaId, estado: "ACTIVO" },
    })
    if (!colab) return NextResponse.json({ error: "Asociado no encontrado" }, { status: 404 })

    await prisma.ejecucionTarea.update({
      where: { id: tareaId },
      data: { estado: "EN_CURSO", colaborador_id: data.colaborador_id, hora_inicio: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  if (data.accion === "completar") {
    const colab = await prisma.colaborador.findFirst({
      where: { id: data.colaborador_id, empresa_id: empresaId, estado: "ACTIVO" },
    })
    if (!colab) return NextResponse.json({ error: "Asociado no encontrado" }, { status: 404 })

    // Validar que subió las fotos mínimas requeridas
    const fotosOk = et.fotos.filter((f) => f.estado_subida === "COMPLETA").length
    if (et.tarea.foto_min > 0 && fotosOk < et.tarea.foto_min) {
      return NextResponse.json(
        { error: `Faltan fotos. Requeridas: ${et.tarea.foto_min}, subidas: ${fotosOk}` },
        { status: 400 }
      )
    }
    if (et.tarea.requiere_comentario && !data.comentario?.trim()) {
      return NextResponse.json({ error: "El comentario es requerido" }, { status: 400 })
    }

    await prisma.ejecucionTarea.update({
      where: { id: tareaId },
      data: {
        estado: "COMPLETADA",
        colaborador_id: data.colaborador_id,
        hora_fin: new Date(),
        comentario: data.comentario ?? null,
        checklist_completado: data.checklist_completado
          ? JSON.parse(JSON.stringify(data.checklist_completado))
          : null,
        latitud_completado: data.latitud ?? null,
        longitud_completado: data.longitud ?? null,
        validacion_estado: "PENDIENTE",
      },
    })

    // Actualizar estado de la ejecución padre
    await actualizarEstadoEjecucion(ejecucionId)

    return NextResponse.json({ ok: true })
  }

  if (data.accion === "omitir") {
    await prisma.ejecucionTarea.update({
      where: { id: tareaId },
      data: {
        estado: "OMITIDA",
        colaborador_id: data.colaborador_id,
        se_salteo_orden: true,
        motivo_salteo: data.motivo_salteo,
        hora_fin: new Date(),
      },
    })
    return NextResponse.json({ ok: true })
  }

  // Acciones del supervisor — requieren sesión
  const { error: sessionError, session } = await verificarAcceso("APROBAR_NOVEDAD", "operaciones")
  if (sessionError) return sessionError

  if (session.user.empresaId !== empresaId) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 })
  }

  if (data.accion === "aprobar") {
    await prisma.ejecucionTarea.update({
      where: { id: tareaId },
      data: { validacion_estado: "APROBADA", validado_por_id: session.user.id },
    })
    await registrarAudit({
      empresa_id: empresaId,
      usuario_id: session.user.id,
      rol: session.user.rol,
      accion: "APROBAR_TAREA",
      entidad: "EjecucionTarea",
      entidad_id: tareaId,
    })
    return NextResponse.json({ ok: true })
  }

  if (data.accion === "rechazar") {
    await prisma.ejecucionTarea.update({
      where: { id: tareaId },
      data: {
        validacion_estado: "RECHAZADA",
        validado_por_id: session.user.id,
        motivo_rechazo: data.motivo_rechazo,
        estado: "PENDIENTE",
      },
    })
    await registrarAudit({
      empresa_id: empresaId,
      usuario_id: session.user.id,
      rol: session.user.rol,
      accion: "RECHAZAR_TAREA",
      entidad: "EjecucionTarea",
      entidad_id: tareaId,
      detalle: { motivo: data.motivo_rechazo },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Acción desconocida" }, { status: 400 })
}

async function actualizarEstadoEjecucion(ejecucionId: string) {
  const tareas = await prisma.ejecucionTarea.findMany({
    where: { ejecucion_procedimiento_id: ejecucionId },
    select: { estado: true },
  })
  const todas = tareas.length
  const completadas = tareas.filter((t) => t.estado === "COMPLETADA" || t.estado === "OMITIDA").length
  const enCurso = tareas.some((t) => t.estado === "EN_CURSO")

  let estado = "PENDIENTE"
  if (completadas === todas) estado = "COMPLETADO"
  else if (enCurso || completadas > 0) estado = "EN_CURSO"

  await prisma.ejecucionProcedimiento.update({
    where: { id: ejecucionId },
    data: { estado },
  })
}
