import { prisma } from "@/lib/prisma"
import type { SesionVerificada } from "@/lib/auth-helpers"

/**
 * Devuelve los IDs de colaboradores que pertenecen a los puntos del supervisor.
 * Para ADMIN/SUPER_ADMIN devuelve null (sin restricción).
 */
export async function getColaboradoresSupervisor(
  session: SesionVerificada
): Promise<string[] | null> {
  if (session.user.rol !== "SUPERVISOR") return null

  const puntosIds = session.user.puntosIds
  if (!puntosIds.length) return []

  const jornadas = await prisma.colaboradorJornada.findMany({
    where: {
      fecha_hasta: null,
      jornada: { punto_fichaje_id: { in: puntosIds } },
    },
    select: { colaborador_id: true },
    distinct: ["colaborador_id"],
  })

  return jornadas.map((j) => j.colaborador_id)
}

/**
 * Devuelve el where de empresa_id + filtro de puntos para fichadas/novedades.
 */
export async function getWhereEmpresaSupervisor(
  session: SesionVerificada
): Promise<{ empresa_id: string; colaborador_id?: { in: string[] }; punto_fichaje_id?: { in: string[] } }> {
  if (session.user.rol !== "SUPERVISOR") {
    return { empresa_id: session.user.empresaId }
  }

  const colaboradorIds = await getColaboradoresSupervisor(session)
  return {
    empresa_id: session.user.empresaId,
    ...(colaboradorIds !== null ? { colaborador_id: { in: colaboradorIds } } : {}),
  }
}
