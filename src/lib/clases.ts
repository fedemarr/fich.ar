import { prisma } from "@/lib/prisma"
import { esFranco, type DiaSemana } from "@/lib/jornadas"
import { inicioDiaARG, finDiaARG, fechaARG, formatHoraARG } from "@/lib/utils"

// Fichaje por clase (gimnasios): cada clase es una Jornada con es_clase = true,
// sus profes titulares son los ColaboradorJornada y cada fichada guarda la clase dictada.

const DIAS: readonly DiaSemana[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]

export interface ProfeRef {
  id: string
  nombre: string
  apellido: string
}

export interface ClaseConAsignaciones {
  id: string
  nombre: string
  hora_inicio: string
  hora_fin: string
  tolerancia_min: number
  punto_fichaje_id: string
  punto_nombre: string
  dias: Record<DiaSemana, boolean>
  asignaciones: { colaborador: ProfeRef; fecha_desde: Date; fecha_hasta: Date | null; dias_franco: string[] }[]
}

export interface ClaseProgramada {
  id: string
  nombre: string
  hora_inicio: string
  hora_fin: string
  tolerancia_min: number
  punto_fichaje_id: string
  punto_nombre: string
  titulares: ProfeRef[]
}

export function horaAMinutos(hm: string): number {
  const [h, m] = hm.split(":").map(Number)
  return h * 60 + m
}

export function minutosAhoraARG(ahora: Date): number {
  const [h, m] = formatHoraARG(ahora).split(":").map(Number)
  return h * 60 + m
}

export function diaSemanaDe(fecha: string): DiaSemana {
  return DIAS[inicioDiaARG(fecha).getUTCDay()]
}

export function nombreProfe(p: ProfeRef): string {
  return `${p.apellido} ${p.nombre}`
}

// Todas las clases activas de la empresa con sus profes (para evaluar varios días sin repetir consultas)
export async function cargarClases(
  empresaId: string,
  filtro?: { puntoId?: string; puntosIds?: string[] }
): Promise<ClaseConAsignaciones[]> {
  const puntoWhere = filtro?.puntoId
    ? { punto_fichaje_id: filtro.puntoId }
    : filtro?.puntosIds
      ? { punto_fichaje_id: { in: filtro.puntosIds } }
      : {}

  const jornadas = await prisma.jornada.findMany({
    where: { empresa_id: empresaId, es_clase: true, activo: true, ...puntoWhere },
    include: {
      punto_fichaje: { select: { nombre: true } },
      colaboradores: {
        where: { colaborador: { estado: "ACTIVO", deleted_at: null } },
        include: { colaborador: { select: { id: true, nombre: true, apellido: true } } },
      },
    },
    orderBy: { hora_inicio: "asc" },
  })

  return jornadas.map((j) => {
    const dias = Object.fromEntries(
      DIAS.map((d) => [d, Boolean(j[`${d}_presencial`]) || Boolean(j[`${d}_virtual`])])
    ) as Record<DiaSemana, boolean>
    return {
      id: j.id,
      nombre: j.nombre,
      hora_inicio: j.hora_inicio,
      hora_fin: j.hora_fin,
      tolerancia_min: j.tolerancia_min,
      punto_fichaje_id: j.punto_fichaje_id,
      punto_nombre: j.punto_fichaje.nombre,
      dias,
      asignaciones: j.colaboradores.map((cj) => ({
        colaborador: cj.colaborador,
        fecha_desde: cj.fecha_desde,
        fecha_hasta: cj.fecha_hasta,
        dias_franco: cj.dias_franco,
      })),
    }
  })
}

// Clases que se dan en una fecha (YYYY-MM-DD ARG), con los titulares que no tienen franco ese día
export function programadasEnFecha(clases: ClaseConAsignaciones[], fecha: string): ClaseProgramada[] {
  const dia = diaSemanaDe(fecha)
  const inicio = inicioDiaARG(fecha)
  const fin = finDiaARG(fecha)

  return clases
    .filter((c) => c.dias[dia])
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      hora_inicio: c.hora_inicio,
      hora_fin: c.hora_fin,
      tolerancia_min: c.tolerancia_min,
      punto_fichaje_id: c.punto_fichaje_id,
      punto_nombre: c.punto_nombre,
      titulares: c.asignaciones
        .filter((a) => a.fecha_desde <= fin && (a.fecha_hasta === null || a.fecha_hasta >= inicio))
        .filter((a) => !esFranco(a.dias_franco, inicio))
        .map((a) => a.colaborador),
    }))
    .sort((a, b) => horaAMinutos(a.hora_inicio) - horaAMinutos(b.hora_inicio))
}

// ── Estado de las clases de un día ──────────────────────────────────────────

export type EstadoClase = "DICTADA" | "EN_CURSO" | "NO_DICTADA" | "PENDIENTE"

export interface DictadoClase {
  profe: string
  colaborador_id: string
  entrada: string
  salida: string | null
  minutos: number | null
  tarde: boolean
  reemplazo_de: string | null
}

export interface ClaseDelDia extends ClaseProgramada {
  estado: EstadoClase
  dictados: DictadoClase[]
}

interface FichadaClase {
  colaborador_id: string
  jornada_id: string | null
  reemplazo_de_id: string | null
  tipo: "ENTRADA" | "SALIDA"
  timestamp: Date
  analisis: string | null
  colaborador: ProfeRef
}

export async function fichadasDeClases(empresaId: string, desde: Date, hasta: Date, jornadaIds: string[]): Promise<FichadaClase[]> {
  if (jornadaIds.length === 0) return []
  return prisma.fichada.findMany({
    where: {
      empresa_id: empresaId,
      es_valida: true,
      jornada_id: { in: jornadaIds },
      timestamp: { gte: desde, lte: hasta },
    },
    select: {
      colaborador_id: true,
      jornada_id: true,
      reemplazo_de_id: true,
      tipo: true,
      timestamp: true,
      analisis: true,
      colaborador: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { timestamp: "asc" },
  })
}

// Empareja cada entrada de clase con la salida siguiente del mismo profe en la misma clase
export function armarDictados(fichadas: FichadaClase[], jornadaId: string, nombres: Map<string, string>): { dictados: DictadoClase[]; abierta: boolean } {
  const deClase = fichadas.filter((f) => f.jornada_id === jornadaId)
  const dictados: DictadoClase[] = []
  let abierta = false
  deClase.forEach((f, i) => {
    if (f.tipo !== "ENTRADA") return
    const salida = deClase.slice(i + 1).find((s) => s.colaborador_id === f.colaborador_id)
    const cierra = salida?.tipo === "SALIDA" ? salida : null
    if (!cierra) abierta = true
    dictados.push({
      profe: nombreProfe(f.colaborador),
      colaborador_id: f.colaborador_id,
      entrada: formatHoraARG(f.timestamp),
      salida: cierra ? formatHoraARG(cierra.timestamp) : null,
      minutos: cierra ? Math.round((cierra.timestamp.getTime() - f.timestamp.getTime()) / 60000) : null,
      tarde: f.analisis === "LLEGADA_TARDE",
      reemplazo_de: f.reemplazo_de_id ? nombres.get(f.reemplazo_de_id) ?? "otro profe" : null,
    })
  })
  return { dictados, abierta }
}

// Ya pasó el inicio de la clase más la tolerancia (para marcarla como no dictada)
export function yaEmpezo(clase: { hora_inicio: string; tolerancia_min: number }, fecha: string, ahora: Date): boolean {
  const hoy = fechaARG(ahora)
  if (fecha < hoy) return true
  if (fecha > hoy) return false
  return minutosAhoraARG(ahora) > horaAMinutos(clase.hora_inicio) + clase.tolerancia_min
}

export function nombresDeProfes(clases: ClaseConAsignaciones[]): Map<string, string> {
  const nombres = new Map<string, string>()
  clases.forEach((c) => c.asignaciones.forEach((a) => nombres.set(a.colaborador.id, nombreProfe(a.colaborador))))
  return nombres
}

export async function clasesDelDia(
  empresaId: string,
  fecha: string,
  ahora: Date,
  filtro?: { puntoId?: string; puntosIds?: string[] }
): Promise<ClaseDelDia[]> {
  const clases = await cargarClases(empresaId, filtro)
  const programadas = programadasEnFecha(clases, fecha)
  const fichadas = await fichadasDeClases(empresaId, inicioDiaARG(fecha), finDiaARG(fecha), programadas.map((c) => c.id))
  const nombres = nombresDeProfes(clases)

  return programadas.map((c) => {
    const { dictados, abierta } = armarDictados(fichadas, c.id, nombres)
    const estado: EstadoClase =
      dictados.length > 0 ? (abierta ? "EN_CURSO" : "DICTADA") : yaEmpezo(c, fecha, ahora) ? "NO_DICTADA" : "PENDIENTE"
    return { ...c, estado, dictados }
  })
}
