import { verificarAcceso } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { tags, invalidateTag } from "@/lib/queries"

const FilaAsociadoSchema = z.object({
  legajo: z.string(),
  apellido: z.string(),
  nombre: z.string(),
  identificacion: z.string(),
  domicilio: z.string(),
  celular: z.string().optional().default(""),
  email: z.string().optional().default(""),
  sector: z.string().optional().default(""),
  fecha_ingreso: z.string().optional().default(""),
  punto_qr_id: z.string().nullable().optional(),
  hora_entrada: z.string().optional(),
  hora_salida: z.string().optional(),
})

const FilaServicioSchema = z.object({
  legajo: z.string(),
  apellido: z.string(),
  nombre: z.string(),
  objetivos: z.array(z.string()),
})

const BodySchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("asociados"),
    creados: z.array(FilaAsociadoSchema),
    actualizados: z.array(FilaAsociadoSchema),
    desactivarIds: z.array(z.string()),
    jornada_id: z.string().optional(),
  }),
  z.object({
    tipo: z.literal("servicios"),
    asignaciones: z.array(FilaServicioSchema),
  }),
])

export async function POST(req: Request): Promise<Response> {
  const { error, session } = await verificarAcceso("IMPORTAR_COLABORADORES")
  if (error) return error

  const empresaId = session.user.empresaId

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 })

  let resp: Response
  if (parsed.data.tipo === "asociados") {
    resp = await confirmarAsociados(parsed.data, empresaId)
  } else {
    resp = await confirmarServicios(parsed.data, empresaId)
  }
  invalidateTag(tags.colaboradores(empresaId))
  return resp
}

// Busca una jornada existente en ese punto con el mismo horario, o crea una nueva (L-V presencial)
async function resolverJornadaPunto(
  empresaId: string,
  puntoId: string,
  horaInicio: string,
  horaFin: string
): Promise<string> {
  const existente = await prisma.jornada.findFirst({
    where: { empresa_id: empresaId, punto_fichaje_id: puntoId, hora_inicio: horaInicio, hora_fin: horaFin, activo: true },
  })
  if (existente) return existente.id

  const nueva = await prisma.jornada.create({
    data: {
      empresa_id: empresaId,
      punto_fichaje_id: puntoId,
      nombre: `L-V ${horaInicio} a ${horaFin}`,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      lunes_presencial: true,
      martes_presencial: true,
      miercoles_presencial: true,
      jueves_presencial: true,
      viernes_presencial: true,
    },
  })
  return nueva.id
}

// Asigna la jornada que corresponda: la calculada por fila (punto QR + horario) tiene prioridad sobre la global
async function asignarJornadaSiCorresponde(
  colabId: string,
  empresaId: string,
  fila: z.infer<typeof FilaAsociadoSchema>,
  jornadaIdGlobal?: string
) {
  let jornadaId: string | undefined
  if (fila.punto_qr_id && fila.hora_entrada && fila.hora_salida) {
    jornadaId = await resolverJornadaPunto(empresaId, fila.punto_qr_id, fila.hora_entrada, fila.hora_salida)
  } else if (jornadaIdGlobal) {
    jornadaId = jornadaIdGlobal
  }
  if (!jornadaId) return

  await prisma.colaboradorJornada.updateMany({
    where: { colaborador_id: colabId, fecha_hasta: null },
    data: { fecha_hasta: new Date() },
  })
  await prisma.colaboradorJornada.create({
    data: { colaborador_id: colabId, jornada_id: jornadaId, fecha_desde: new Date() },
  })
}

async function confirmarAsociados(
  data: {
    tipo: "asociados"
    creados: z.infer<typeof FilaAsociadoSchema>[]
    actualizados: z.infer<typeof FilaAsociadoSchema>[]
    desactivarIds: string[]
    jornada_id?: string
  },
  empresaId: string
): Promise<Response> {
  let creados = 0
  let actualizados = 0
  let desactivados = 0
  const { jornada_id } = data

  // Pre-cargar todos para no hacer N queries individuales
  const existentes = await prisma.colaborador.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
    select: { id: true, legajo: true, identificacion: true },
  })
  const mapaIdPorLegajo = new Map(existentes.filter(c => c.legajo).map((c) => [c.legajo!, c.id]))
  const mapaIdPorDni = new Map(existentes.filter(c => c.identificacion).map((c) => [c.identificacion!, c.id]))

  for (const fila of data.creados) {
    const colab = await prisma.colaborador.create({
      data: {
        empresa_id: empresaId,
        legajo: fila.legajo,
        apellido: fila.apellido,
        nombre: fila.nombre || fila.apellido,
        celular: fila.celular || `SIN_CEL_${fila.legajo}`,
        identificacion: fila.identificacion || null,
        domicilio: fila.domicilio || null,
        email: fila.email || null,
        sector: fila.sector || null,
        fecha_ingreso: fila.fecha_ingreso ? new Date(fila.fecha_ingreso) : null,
        estado: "ACTIVO",
      },
    })
    await asignarJornadaSiCorresponde(colab.id, empresaId, fila, jornada_id)
    creados++
  }

  for (const fila of data.actualizados) {
    const id = fila.legajo
      ? (mapaIdPorLegajo.get(fila.legajo) ?? (fila.identificacion ? mapaIdPorDni.get(fila.identificacion) : undefined))
      : (fila.identificacion ? mapaIdPorDni.get(fila.identificacion) : undefined)
    if (!id) continue
    await prisma.colaborador.update({
      where: { id },
      data: {
        apellido: fila.apellido,
        nombre: fila.nombre || fila.apellido,
        ...(fila.identificacion && { identificacion: fila.identificacion }),
        ...(fila.domicilio && { domicilio: fila.domicilio }),
        ...(fila.celular && { celular: fila.celular }),
        ...(fila.email && { email: fila.email }),
        ...(fila.sector && { sector: fila.sector }),
        ...(fila.fecha_ingreso && { fecha_ingreso: new Date(fila.fecha_ingreso) }),
        estado: "ACTIVO",
        deleted_at: null,
      },
    })
    await asignarJornadaSiCorresponde(id, empresaId, fila, jornada_id)
    actualizados++
  }

  if (data.desactivarIds.length > 0) {
    const result = await prisma.colaborador.updateMany({
      where: { id: { in: data.desactivarIds }, empresa_id: empresaId },
      data: { estado: "DESACTIVADO" },
    })
    desactivados = result.count
  }

  return Response.json({ ok: true, creados, actualizados, desactivados })
}

async function confirmarServicios(
  data: { tipo: "servicios"; asignaciones: z.infer<typeof FilaServicioSchema>[] },
  empresaId: string
): Promise<Response> {
  const puntos = await prisma.puntoFichaje.findMany({
    where: { empresa_id: empresaId, activo: true },
    include: { jornadas: { where: { activo: true }, take: 1 } },
  })

  const colaboradores = await prisma.colaborador.findMany({
    where: { empresa_id: empresaId, deleted_at: null, legajo: { not: null } },
    select: { id: true, legajo: true },
  })
  const colabPorLegajo = new Map(colaboradores.map((c) => [c.legajo!, c.id]))

  let actualizados = 0

  for (const asignacion of data.asignaciones) {
    const colaboradorId = colabPorLegajo.get(asignacion.legajo)
    if (!colaboradorId) continue

    // Actualizar sector con el objetivo principal
    const sectorPrincipal = asignacion.objetivos[0] ?? null
    if (sectorPrincipal) {
      await prisma.colaborador.update({
        where: { id: colaboradorId },
        data: { sector: sectorPrincipal },
      })
    }

    // Asignar jornada del punto correspondiente a cada objetivo
    for (const objetivo of asignacion.objetivos) {
      const punto = puntos.find(
        (p) =>
          p.nombre.toLowerCase().includes(objetivo.toLowerCase()) ||
          objetivo.toLowerCase().includes(p.nombre.toLowerCase())
      )
      const jornadaId = punto?.jornadas[0]?.id
      if (!jornadaId) continue

      const existe = await prisma.colaboradorJornada.findFirst({
        where: { colaborador_id: colaboradorId, jornada_id: jornadaId, fecha_hasta: null },
      })
      if (!existe) {
        await prisma.colaboradorJornada.create({
          data: { colaborador_id: colaboradorId, jornada_id: jornadaId, fecha_desde: new Date() },
        })
      }
    }

    actualizados++
  }

  return Response.json({ ok: true, actualizados })
}
