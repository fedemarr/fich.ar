import type { AnalisisFichada, TipoFichada } from "@/generated/prisma/client"

interface JornadaRef {
  hora_inicio: string
  hora_fin: string
  tolerancia_min: number
}

export function calcularAnalisis(
  timestamp: Date,
  tipo: TipoFichada,
  jornada?: JornadaRef
): AnalisisFichada {
  if (!jornada) {
    return tipo === "ENTRADA" ? "LLEGADA_EN_TIEMPO" : "SALIDA_EN_TIEMPO"
  }

  const hora = timestamp.getHours() * 60 + timestamp.getMinutes()
  const [hI, mI] = jornada.hora_inicio.split(":").map(Number)
  const [hF, mF] = jornada.hora_fin.split(":").map(Number)

  if (tipo === "ENTRADA") {
    return hora <= hI * 60 + mI + jornada.tolerancia_min
      ? "LLEGADA_EN_TIEMPO"
      : "LLEGADA_TARDE"
  }
  return hora >= hF * 60 + mF ? "SALIDA_EN_TIEMPO" : "SALIDA_ANTICIPADA"
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
