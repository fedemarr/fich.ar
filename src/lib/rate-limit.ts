import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

const redis = Redis.fromEnv()

// Bot WhatsApp: max 10 mensajes por minuto por número
export const rateLimitWA = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "rl:wa",
})

// Login: max 5 intentos por 15 minutos por IP
export const rateLimitLogin = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "rl:login",
})

// QR Web: 200 requests por minuto por IP (48 colaboradores × 2-3 requests c/u en pico de mañana)
export const rateLimitQR = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, "1 m"),
  prefix: "rl:qr",
})
