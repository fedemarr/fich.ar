import { prisma } from "@/lib/prisma"

// Ventana para considerar abierta una entrada sin salida. Cubre turnos nocturnos que cruzan la medianoche
// (ej. 22:00 a 06:00) sin arrastrar al día siguiente una salida olvidada de un turno de mañana.
export const HORAS_TURNO_ABIERTO = 14

export interface TurnoAbierto {
  id: string
  punto_fichaje_id: string | null
  timestamp: Date
}

// Devuelve la última ENTRADA si todavía no tiene su SALIDA; null si el colaborador no está trabajando
export async function buscarTurnoAbierto(
  colaboradorId: string,
  empresaId: string,
  ahora: Date
): Promise<TurnoAbierto | null> {
  const desde = new Date(ahora.getTime() - HORAS_TURNO_ABIERTO * 60 * 60 * 1000)
  const ultima = await prisma.fichada.findFirst({
    where: { colaborador_id: colaboradorId, empresa_id: empresaId, es_valida: true, timestamp: { gte: desde } },
    orderBy: { timestamp: "desc" },
    select: { id: true, tipo: true, punto_fichaje_id: true, timestamp: true },
  })
  if (!ultima || ultima.tipo !== "ENTRADA") return null
  return { id: ultima.id, punto_fichaje_id: ultima.punto_fichaje_id, timestamp: ultima.timestamp }
}
