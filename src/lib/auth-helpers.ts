import { auth } from "@/lib/auth"
import type { RolUsuario } from "@/generated/prisma/client"

const PERMISOS = {
  // Colaboradores
  VER_COLABORADORES:      ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  CREAR_COLABORADOR:      ["SUPER_ADMIN", "ADMIN"],
  EDITAR_COLABORADOR:     ["SUPER_ADMIN", "ADMIN"],
  DESACTIVAR_COLABORADOR: ["SUPER_ADMIN", "ADMIN"],
  IMPORTAR_COLABORADORES: ["SUPER_ADMIN", "ADMIN"],

  // Fichadas
  VER_FICHADAS:           ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  CREAR_FICHADA_MANUAL:   ["SUPER_ADMIN", "ADMIN"],
  EDITAR_FICHADA:         ["SUPER_ADMIN", "ADMIN"],

  // Novedades
  VER_NOVEDADES:          ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  CREAR_NOVEDAD:          ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  APROBAR_NOVEDAD:        ["SUPER_ADMIN", "ADMIN"],

  // Puntos QR
  VER_PUNTOS:             ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  CREAR_PUNTO:            ["SUPER_ADMIN", "ADMIN"],
  EDITAR_PUNTO:           ["SUPER_ADMIN", "ADMIN"],
  ELIMINAR_PUNTO:         ["SUPER_ADMIN"],
  GENERAR_QR:             ["SUPER_ADMIN", "ADMIN"],

  // Proyección
  VER_PROYECCION:         ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  IMPORTAR_PROYECCION:    ["SUPER_ADMIN", "ADMIN"],

  // Comunicaciones
  VER_COMUNICACIONES:     ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  CREAR_COMUNICACION:     ["SUPER_ADMIN", "ADMIN"],
  ELIMINAR_COMUNICACION:  ["SUPER_ADMIN", "ADMIN"],

  // Exportar / importar
  EXPORTAR_DATOS:         ["SUPER_ADMIN", "ADMIN"],

  // Config
  VER_CONFIGURACION:      ["SUPER_ADMIN", "ADMIN"],
  EDITAR_CONFIGURACION:   ["SUPER_ADMIN", "ADMIN"],

  // Solo SUPER_ADMIN
  VER_AUDITORIA:          ["SUPER_ADMIN"],
  VER_TODAS_EMPRESAS:     ["SUPER_ADMIN"],
  RESET_NOMINA:           ["SUPER_ADMIN", "ADMIN"],
} as const

export type Permiso = keyof typeof PERMISOS

interface SesionVerificada {
  user: {
    id: string
    email: string
    name: string
    empresaId: string
    empresaSlug: string
    rol: RolUsuario
  }
}

type ResultadoAcceso =
  | { error: Response; session: null }
  | { error: null; session: SesionVerificada }

export async function verificarAcceso(permiso: Permiso): Promise<ResultadoAcceso> {
  const session = await auth()

  if (!session?.user) {
    return {
      error: Response.json({ error: "No autenticado" }, { status: 401 }),
      session: null,
    }
  }

  const rolesPermitidos = PERMISOS[permiso] as readonly string[]
  if (!rolesPermitidos.includes(session.user.rol)) {
    return {
      error: Response.json({ error: "Sin permiso" }, { status: 403 }),
      session: null,
    }
  }

  return { error: null, session: session as unknown as SesionVerificada }
}
