import { verificarAcceso } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const FilaAsociadoSchema = z.object({
  legajo: z.string(),
  apellido: z.string(),
  nombre: z.string(),
  identificacion: z.string(),
  domicilio: z.string(),
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

  if (parsed.data.tipo === "asociados") return confirmarAsociados(parsed.data, empresaId)
  return confirmarServicios(parsed.data, empresaId)
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
    where: { empresa_id: empresaId, deleted_at: null, legajo: { not: null } },
    select: { id: true, legajo: true },
  })
  const mapaId = new Map(existentes.map((c) => [c.legajo!, c.id]))

  for (const fila of data.creados) {
    const colab = await prisma.colaborador.create({
      data: {
        empresa_id: empresaId,
        legajo: fila.legajo,
        apellido: fila.apellido,
        nombre: fila.nombre || fila.apellido,
        celular: `SIN_CEL_${fila.legajo}`,
        identificacion: fila.identificacion || null,
        domicilio: fila.domicilio || null,
        estado: "ACTIVO",
      },
    })
    if (jornada_id) {
      await prisma.colaboradorJornada.create({
        data: { colaborador_id: colab.id, jornada_id, fecha_desde: new Date() },
      })
    }
    creados++
  }

  for (const fila of data.actualizados) {
    const id = mapaId.get(fila.legajo)
    if (!id) continue
    await prisma.colaborador.update({
      where: { id },
      data: {
        apellido: fila.apellido,
        nombre: fila.nombre || fila.apellido,
        ...(fila.identificacion && { identificacion: fila.identificacion }),
        ...(fila.domicilio && { domicilio: fila.domicilio }),
        estado: "ACTIVO",
        deleted_at: null,
      },
    })
    if (jornada_id) {
      // Cerrar jornadas vigentes y asignar la nueva
      await prisma.colaboradorJornada.updateMany({
        where: { colaborador_id: id, fecha_hasta: null },
        data: { fecha_hasta: new Date() },
      })
      await prisma.colaboradorJornada.create({
        data: { colaborador_id: id, jornada_id, fecha_desde: new Date() },
      })
    }
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
