import { prisma } from "@/lib/prisma"

export async function puntosDeOtraEmpresa(empresaId: string, puntosIds: string[]): Promise<boolean> {
  const unicos = [...new Set(puntosIds)]
  const propios = await prisma.puntoFichaje.count({ where: { id: { in: unicos }, empresa_id: empresaId } })
  return propios !== unicos.length
}

type ChequeoEmail =
  | { error: string; reactivarId?: undefined }
  | { error: null; reactivarId?: string }

// El email de usuario es único en todo el sistema (no por empresa)
export async function verificarEmailSupervisor(
  empresaId: string,
  email: string,
  excluirId?: string
): Promise<ChequeoEmail> {
  const existente = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, ...(excluirId ? { id: { not: excluirId } } : {}) },
    select: { id: true, nombre: true, rol: true, empresa_id: true, deleted_at: true },
  })
  if (!existente) return { error: null }

  if (existente.empresa_id !== empresaId) {
    return { error: "Ese email ya está registrado en el sistema. Usá otro email para el supervisor." }
  }
  if (existente.deleted_at && existente.rol === "SUPERVISOR" && !excluirId) {
    return { error: null, reactivarId: existente.id }
  }
  if (existente.deleted_at) {
    return { error: `Ese email pertenece a un usuario dado de baja (${existente.nombre}). Usá otro email.` }
  }
  return { error: `Ese email ya lo usa ${existente.nombre}. Usá otro email.` }
}
