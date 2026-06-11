import { Redis } from "@upstash/redis"

export const redis = Redis.fromEnv()

export interface EstadoBotWA {
  paso: "esperando_accion" | "esperando_dni" | "esperando_ubicacion"
  qr_token: string
  punto_id: string
  empresa_id: string
  colaborador_id?: string      // undefined hasta ser identificado por DNI
  tipo_fichada?: "ENTRADA" | "SALIDA"
  timestamp: number
}

const TTL_SEGUNDOS = 600 // 10 minutos

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
