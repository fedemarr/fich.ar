import type {
  Empresa,
  Usuario,
  Colaborador,
  PuntoFichaje,
  Jornada,
  ColaboradorJornada,
  Fichada,
  Novedad,
  Comunicacion,
  Notificacion,
  RolUsuario,
  EstadoColaborador,
  TipoNovedad,
  TipoFichada,
  MetodoFichada,
  AnalisisFichada,
  EstadoNotificacion,
  TipoNotificacion,
} from "@/generated/prisma/client"

export type {
  Empresa,
  Usuario,
  Colaborador,
  PuntoFichaje,
  Jornada,
  ColaboradorJornada,
  Fichada,
  Novedad,
  Comunicacion,
  Notificacion,
  RolUsuario,
  EstadoColaborador,
  TipoNovedad,
  TipoFichada,
  MetodoFichada,
  AnalisisFichada,
  EstadoNotificacion,
  TipoNotificacion,
}

export type ColaboradorConJornada = Colaborador & {
  jornadas: (ColaboradorJornada & { jornada: Jornada & { punto_fichaje: PuntoFichaje } })[]
}

export type FichadaConColaborador = Fichada & {
  colaborador: Colaborador
  punto_fichaje: PuntoFichaje | null
}

export type NovedadConColaborador = Novedad & {
  colaborador: Colaborador
}

export interface SessionUser {
  id: string
  email: string
  nombre: string
  empresaId: string
  empresaSlug: string
  rol: RolUsuario
}

export interface KpiResumen {
  totalColaboradores: number
  presentes: number
  ingresos: number
  salidas: number
  ausentes: number
  novedades: number
}

export interface DatoGrafico {
  hora: string
  ingresos: number
  salidas: number
}

export const ETIQUETAS_NOVEDAD: Record<TipoNovedad, string> = {
  P: "Presente",
  PT: "Presente tarde",
  AU: "Ausente",
  VAC: "Vacaciones",
  EN: "Enfermedad",
  FR: "Franco",
  FE: "Feriado",
  HDO: "Hora de duelo",
  C: "Capacitación",
  DES: "Descanso",
  VIR: "Virtual",
}
