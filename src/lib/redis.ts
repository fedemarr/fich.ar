import { Redis } from "@upstash/redis"

export const redis = Redis.fromEnv()

export interface EstadoBotWA {
  paso: "esperando_accion" | "esperando_dni" | "esperando_ubicacion" | "post_entrada"
  qr_token: string
  punto_id: string
  empresa_id: string
  colaborador_id?: string
  tipo_fichada?: "ENTRADA" | "SALIDA"
  timestamp: number
}

const TTL_SEGUNDOS = 600 // 10 minutos
const TTL_POST_ENTRADA = 14400 // 4 horas — para descanso durante la jornada

export { TTL_POST_ENTRADA }

export function keyEstadoBot(phone: string) {
  return `wa:state:${phone}`
}

export async function getEstadoBot(phone: string): Promise<EstadoBotWA | null> {
  return redis.get<EstadoBotWA>(keyEstadoBot(phone))
}

export async function setEstadoBot(phone: string, estado: EstadoBotWA) {
  await redis.set(keyEstadoBot(phone), estado, { ex: TTL_SEGUNDOS })
}

export async function delEstadoBot(phone: string) {
  await redis.del(keyEstadoBot(phone))
}
