import type { AnalisisFichada, TipoFichada } from "@/generated/prisma/client"

interface JornadaRef {
  hora_inicio: string
  hora_fin: string
  tolerancia_min: number
}

// Todos los flags de días que tiene el modelo Jornada
export interface JornadaConFlags extends JornadaRef {
  lunes_presencial: boolean; lunes_virtual: boolean
  martes_presencial: boolean; martes_virtual: boolean
  miercoles_presencial: boolean; miercoles_virtual: boolean
  jueves_presencial: boolean; jueves_virtual: boolean
  viernes_presencial: boolean; viernes_virtual: boolean
  sabado_presencial: boolean; sabado_virtual: boolean
  domingo_presencial: boolean; domingo_virtual: boolean
}

const DIAS_SEMANA = [
  "domingo", "lunes", "martes", "miercoles",
  "jueves", "viernes", "sabado",
] as const

function horaToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number)
  return h * 60 + m
}

function trabajaEseDia(j: JornadaConFlags, dia: string): boolean {
  const k = j as unknown as Record<string, unknown>
  return Boolean(k[`${dia}_presencial`]) || Boolean(k[`${dia}_virtual`])
}

// true si las dos jornadas se solapan en al menos 1 día y el horario se superpone
export function jornadasSeSolapan(a: JornadaConFlags, b: JornadaConFlags): boolean {
  const comparteDia = DIAS_SEMANA.some((d) => trabajaEseDia(a, d) && trabajaEseDia(b, d))
  if (!comparteDia) return false
  // intervalo abierto: solapan si inicio1 < fin2 AND inicio2 < fin1
  return horaToMin(a.hora_inicio) < horaToMin(b.hora_fin) &&
    horaToMin(b.hora_inicio) < horaToMin(a.hora_fin)
}

// Dado un array de jornadas activas de un colaborador, elige la más adecuada
// para el momento de la fichada (día ARG + ventana horaria más cercana)
export function encontrarJornadaParaFichada<T extends JornadaConFlags>(
  jornadas: T[],
  ahora: Date
): T | undefined {
  if (jornadas.length === 0) return undefined
  if (jornadas.length === 1) return jornadas[0]

  const ahoraARG = new Date(
    ahora.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  )
  const diaKey = DIAS_SEMANA[ahoraARG.getDay()]
  const horaMin = ahoraARG.getHours() * 60 + ahoraARG.getMinutes()

  // Filtrar al día actual; si ninguna aplica hoy, usar todas
  const hoy = jornadas.filter((j) => trabajaEseDia(j, diaKey))
  const candidatas = hoy.length > 0 ? hoy : jornadas

  if (candidatas.length === 1) return candidatas[0]

  // Distancia temporal: 0 si está dentro de la ventana (con tolerancia), positiva si no
  function distancia(j: T): number {
    const inicio = horaToMin(j.hora_inicio)
    const fin = horaToMin(j.hora_fin)
    const tol = j.tolerancia_min
    if (horaMin >= inicio - tol && horaMin <= fin) return 0
    if (horaMin < inicio - tol) return inicio - tol - horaMin
    return horaMin - fin
  }

  return candidatas.reduce((mejor, j) => (distancia(j) < distancia(mejor) ? j : mejor))
}

export function calcularAnalisis(
  timestamp: Date,
  tipo: TipoFichada,
  jornada?: JornadaRef
): AnalisisFichada {
  if (!jornada) {
    return tipo === "ENTRADA" ? "LLEGADA_EN_TIEMPO" : "SALIDA_EN_TIEMPO"
  }

  // Hora en zona ARG (UTC-3) — el servidor corre en UTC, getHours() devolvería hora UTC
  const argDate = new Date(timestamp.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }))
  const hora = argDate.getHours() * 60 + argDate.getMinutes()
  const [hI, mI] = jornada.hora_inicio.split(":").map(Number)
  const [hF, mF] = jornada.hora_fin.split(":").map(Number)

  if (tipo === "ENTRADA") {
    return hora <= hI * 60 + mI + jornada.tolerancia_min
      ? "LLEGADA_EN_TIEMPO"
      : "LLEGADA_TARDE"
  }
  const horaFin = hF * 60 + mF
  if (hora < horaFin) return "SALIDA_ANTICIPADA"
  if (hora === horaFin) return "SALIDA_EN_TIEMPO"
  return "SALIDA_TARDE"
}

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
] as const

type DiaSemana = (typeof DIAS)[number]

interface JornadaConDias extends JornadaRef {
  [key: string]: unknown
}

export function esDiaPresencial(jornada: JornadaConDias, fecha: Date): boolean {
  const dia: DiaSemana = DIAS[fecha.getDay()]
  return Boolean(jornada[`${dia}_presencial`])
}

export function esDiaVirtual(jornada: JornadaConDias, fecha: Date): boolean {
  const dia: DiaSemana = DIAS[fecha.getDay()]
  return Boolean(jornada[`${dia}_virtual`])
}

export function esDiaLaboral(jornada: JornadaConDias, fecha: Date): boolean {
  return esDiaPresencial(jornada, fecha) || esDiaVirtual(jornada, fecha)
}
