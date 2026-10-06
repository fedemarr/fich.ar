import { HORAS_TURNO_ABIERTO } from "@/lib/turno-abierto"

export interface FichadaMovimiento {
  tipo: "ENTRADA" | "SALIDA"
  timestamp: Date
  punto_id: string | null
  punto_nombre: string
  analisis: string | null
  es_cobertura: boolean
  metodo: string
  nota_manual: string | null
}

export type EstadoServicio = "COMPLETO" | "EN_CURSO" | "SIN_SALIDA" | "SIN_ENTRADA"

export interface ServicioDia {
  punto_id: string | null
  punto: string
  entrada: Date | null
  salida: Date | null
  estado: EstadoServicio
  duracion_min: number | null
  cobertura: boolean
  tarde: boolean
  salida_anticipada: boolean
  cierre_automatico: boolean
  manual: boolean
}

function nuevo(f: FichadaMovimiento): ServicioDia {
  return {
    punto_id: f.punto_id,
    punto: f.punto_nombre,
    entrada: f.tipo === "ENTRADA" ? f.timestamp : null,
    salida: f.tipo === "SALIDA" ? f.timestamp : null,
    estado: f.tipo === "ENTRADA" ? "SIN_SALIDA" : "SIN_ENTRADA",
    duracion_min: null,
    cobertura: f.es_cobertura,
    tarde: f.analisis === "LLEGADA_TARDE",
    salida_anticipada: f.analisis === "SALIDA_ANTICIPADA",
    cierre_automatico: false,
    manual: f.metodo === "MANUAL",
  }
}

// Agrupa las fichadas del día en servicios entrada → salida
export function armarServicios(fichadas: FichadaMovimiento[], ahora: Date): ServicioDia[] {
  const ordenadas = [...fichadas].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const servicios: ServicioDia[] = []
  let abierto: ServicioDia | null = null

  for (const f of ordenadas) {
    if (f.tipo === "ENTRADA") {
      abierto = nuevo(f)
      servicios.push(abierto)
      continue
    }
    if (abierto && abierto.entrada) {
      abierto.salida = f.timestamp
      abierto.estado = "COMPLETO"
      abierto.duracion_min = Math.round((f.timestamp.getTime() - abierto.entrada.getTime()) / 60000)
      abierto.salida_anticipada = f.analisis === "SALIDA_ANTICIPADA"
      abierto.cierre_automatico = (f.nota_manual ?? "").startsWith("Cierre automático")
      abierto.manual = abierto.manual || f.metodo === "MANUAL"
      abierto = null
    } else {
      servicios.push(nuevo(f))
    }
  }

  // La última entrada sin salida sigue en curso si es reciente (misma ventana que el fichaje)
  if (abierto?.entrada) {
    const horas = (ahora.getTime() - abierto.entrada.getTime()) / 3600000
    if (horas >= 0 && horas < HORAS_TURNO_ABIERTO) abierto.estado = "EN_CURSO"
  }
  return servicios
}
