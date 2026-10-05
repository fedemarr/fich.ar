import { prisma } from "@/lib/prisma"

// "" y espacios se guardan como null para que los colaboradores sin legajo no choquen entre sí
export function normalizarLegajo(raw: string | null | undefined): string | null {
  const limpio = (raw ?? "").trim()
  return limpio === "" ? null : limpio
}

export interface TitularLegajo {
  id: string
  nombre: string
  apellido: string
}

export async function buscarTitularLegajo(
  empresaId: string,
  legajo: string | null,
  excluirId?: string
): Promise<TitularLegajo | null> {
  if (!legajo) return null
  return prisma.colaborador.findFirst({
    where: {
      empresa_id: empresaId,
      legajo,
      deleted_at: null,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: { id: true, nombre: true, apellido: true },
  })
}

export function mensajeLegajoDuplicado(legajo: string, titular: TitularLegajo): string {
  return `El N° de asociado ${legajo} ya pertenece a ${titular.apellido}, ${titular.nombre}`
}
