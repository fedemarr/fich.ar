import { verificarAcceso } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { tags, invalidateTag } from "@/lib/queries"
import { normalizarLegajo } from "@/lib/legajo"

// Vercel max duration — necesario para imports grandes
export const maxDuration = 60

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

  try {
    let resp: Response
    if (parsed.data.tipo === "asociados") {
      resp = await confirmarAsociados(parsed.data, empresaId)
    } else {
      resp = await confirmarServicios(parsed.data, empresaId)
    }
    invalidateTag(tags.colaboradores(empresaId))
    return resp
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno al sincronizar"
    console.error("[confirmar-colaboradores]", msg)
    return Response.json({ error: msg }, { status: 500 })
  }
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
  const { jornada_id } = data

  // Pre-cargar todos para no hacer N queries individuales
  const existentes = await prisma.colaborador.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
    select: { id: true, legajo: true, identificacion: true },
  })
  const mapaIdPorLegajo = new Map(existentes.filter(c => c.legajo).map((c) => [c.legajo!, c.id]))
  const mapaIdPorDni = new Map(existentes.filter(c => c.identificacion).map((c) => [c.identificacion!, c.id]))

  // Pre-resolver todas las combinaciones únicas de jornada (punto+hora) de una sola vez
  // Evita N findFirst/create secuenciales con el mismo combo
  const jornadasCache = new Map<string, string>() // "puntoId|entrada|salida" → jornada_id
  const combosNeeded = new Set<string>()
  for (const fila of [...data.creados, ...data.actualizados]) {
    if (fila.punto_qr_id && fila.hora_entrada && fila.hora_salida) {
      combosNeeded.add(`${fila.punto_qr_id}|${fila.hora_entrada}|${fila.hora_salida}`)
    }
  }
  for (const combo of combosNeeded) {
    const [puntoId, horaEntrada, horaSalida] = combo.split("|")
    const jornadaId = await resolverJornadaPunto(empresaId, puntoId, horaEntrada, horaSalida)
    jornadasCache.set(combo, jornadaId)
  }

  function getJornadaId(fila: z.infer<typeof FilaAsociadoSchema>): string | undefined {
    if (fila.punto_qr_id && fila.hora_entrada && fila.hora_salida) {
      return jornadasCache.get(`${fila.punto_qr_id}|${fila.hora_entrada}|${fila.hora_salida}`)
    }
    return jornada_id
  }

  // N° de asociado único: no crear si ya existe activo o si viene repetido en el archivo
  const legajosVistos = new Set<string>()
  const omitidosDuplicados: string[] = []
  const aCrear = data.creados.filter((fila) => {
    const legajo = normalizarLegajo(fila.legajo)
    if (!legajo) return true
    if (mapaIdPorLegajo.has(legajo) || legajosVistos.has(legajo)) {
      omitidosDuplicados.push(legajo)
      return false
    }
    legajosVistos.add(legajo)
    return true
  })

  const errores: ErrorFila[] = []
  const etiqueta = (fila: z.infer<typeof FilaAsociadoSchema>) =>
    `${fila.legajo ? `${fila.legajo} — ` : ""}${fila.apellido} ${fila.nombre}`.trim()

  // Crear los nuevos en paralelo; si una fila falla se reporta y el resto sigue
  const resultadosCreacion = await Promise.allSettled(
    aCrear.map(async (fila) => {
      const fechaIngreso = fila.fecha_ingreso ? new Date(fila.fecha_ingreso) : null
      const colab = await prisma.colaborador.create({
        data: {
          empresa_id: empresaId,
          legajo: normalizarLegajo(fila.legajo),
          apellido: fila.apellido,
          nombre: fila.nombre,
          celular: fila.celular || `SIN_CEL_${fila.legajo || crypto.randomUUID().slice(0, 8)}`,
          identificacion: fila.identificacion || null,
          domicilio: fila.domicilio || null,
          email: fila.email || null,
          sector: fila.sector || null,
          fecha_ingreso: fechaIngreso && !isNaN(fechaIngreso.getTime()) ? fechaIngreso : null,
          estado: "ACTIVO",
        },
      })
      // Son nuevos: no tienen jornada previa que cerrar
      const jornadaIdFinal = getJornadaId(fila)
      if (jornadaIdFinal) {
        await prisma.colaboradorJornada.create({
          data: { colaborador_id: colab.id, jornada_id: jornadaIdFinal, fecha_desde: new Date() },
        })
      }
      return colab
    })
  )
  let creados = 0
  resultadosCreacion.forEach((r, i) => {
    if (r.status === "fulfilled") creados++
    else errores.push({ fila: etiqueta(aCrear[i]), motivo: describirError(r.reason) })
  })

  // Actualizar colaboradores existentes en paralelo
  const resultadosUpdate = await Promise.allSettled(
    data.actualizados.map(async (fila) => {
      const id = fila.legajo
        ? (mapaIdPorLegajo.get(fila.legajo) ?? (fila.identificacion ? mapaIdPorDni.get(fila.identificacion) : undefined))
        : (fila.identificacion ? mapaIdPorDni.get(fila.identificacion) : undefined)
      if (!id) return false

      await prisma.colaborador.update({
        where: { id },
        data: {
          apellido: fila.apellido,
          nombre: fila.nombre,
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

      const jornadaIdFinal = getJornadaId(fila)
      if (jornadaIdFinal) {
        // Si sigue en la misma jornada no se recrea la asignación: se perderían sus francos
        const yaAsignada = await prisma.colaboradorJornada.findFirst({
          where: { colaborador_id: id, jornada_id: jornadaIdFinal, fecha_hasta: null },
          select: { id: true },
        })
        if (!yaAsignada) {
          // Cerrar jornada anterior y abrir la nueva (paralelo con otros colabs — distinto colaborador_id)
          await prisma.colaboradorJornada.updateMany({
            where: { colaborador_id: id, fecha_hasta: null },
            data: { fecha_hasta: new Date() },
          })
          await prisma.colaboradorJornada.create({
            data: { colaborador_id: id, jornada_id: jornadaIdFinal, fecha_desde: new Date() },
          })
        }
      }
      return true
    })
  )
  let actualizados = 0
  resultadosUpdate.forEach((r, i) => {
    if (r.status === "fulfilled") { if (r.value) actualizados++ }
    else errores.push({ fila: etiqueta(data.actualizados[i]), motivo: describirError(r.reason) })
  })

  let desactivados = 0
  if (data.desactivarIds.length > 0) {
    const result = await prisma.colaborador.updateMany({
      where: { id: { in: data.desactivarIds }, empresa_id: empresaId },
      data: { estado: "DESACTIVADO" },
    })
    desactivados = result.count
  }

  return Response.json({
    ok: true,
    exitosos: creados + actualizados,
    creados,
    actualizados,
    desactivados,
    omitidos_duplicados: omitidosDuplicados.length,
    legajos_omitidos: omitidosDuplicados,
    errores,
  })
}

interface ErrorFila {
  fila: string
  motivo: string
}

function describirError(e: unknown): string {
  if (e && typeof e === "object" && "code" in e && (e as { code: unknown }).code === "P2002") {
    return "N° de asociado duplicado"
  }
  return e instanceof Error ? e.message.split("\n").filter(Boolean).pop() ?? "Error al guardar" : "Error al guardar"
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

  // Precargar jornadas activas de todos los colaboradores afectados de una vez
  const colabIds = data.asignaciones
    .map((a) => colabPorLegajo.get(a.legajo))
    .filter((id): id is string => !!id)

  const jornadasExistentes = await prisma.colaboradorJornada.findMany({
    where: { colaborador_id: { in: colabIds }, fecha_hasta: null },
    select: { colaborador_id: true, jornada_id: true },
  })
  const jornadaPorColab = new Map(jornadasExistentes.map((j) => [j.colaborador_id, j.jornada_id]))

  // Procesar asignaciones en paralelo
  const resultados = await Promise.all(
    data.asignaciones.map(async (asignacion) => {
      const colaboradorId = colabPorLegajo.get(asignacion.legajo)
      if (!colaboradorId) return false

      const sectorPrincipal = asignacion.objetivos[0] ?? null
      if (sectorPrincipal) {
        await prisma.colaborador.update({
          where: { id: colaboradorId },
          data: { sector: sectorPrincipal },
        })
      }

      for (const objetivo of asignacion.objetivos) {
        const punto = puntos.find(
          (p) =>
            p.nombre.toLowerCase().includes(objetivo.toLowerCase()) ||
            objetivo.toLowerCase().includes(p.nombre.toLowerCase())
        )
        const jornadaId = punto?.jornadas[0]?.id
        if (!jornadaId) continue

        const yaAsignada = jornadaPorColab.get(colaboradorId) === jornadaId
        if (!yaAsignada) {
          // Verificar en DB para evitar duplicados (puede haber cambiado desde la precarga)
          const existe = await prisma.colaboradorJornada.findFirst({
            where: { colaborador_id: colaboradorId, jornada_id: jornadaId, fecha_hasta: null },
          })
          if (!existe) {
            await prisma.colaboradorJornada.create({
              data: { colaborador_id: colaboradorId, jornada_id: jornadaId, fecha_desde: new Date() },
            })
          }
        }
      }
      return true
    })
  )

  const actualizados = resultados.filter(Boolean).length
  return Response.json({ ok: true, actualizados })
}
