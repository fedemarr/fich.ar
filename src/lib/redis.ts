import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

export interface EstadoBotWA {
  step: "waiting_tipo" | "waiting_location"
  qr_token: string
  tipo?: "ENTRADA" | "SALIDA"
  punto_id: string
  empresa_id: string
  colaborador_id: string
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
