import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"

export async function GET() {
  const [ultimoError, ultimoErrorEnvio, ultimosWebhooks, sesionesActivas] = await Promise.all([
    redis.get<string>("wa:last_error").catch(() => null),
    redis.get<string>("wa:last_send_error").catch(() => null),
    prisma.webhookWA.findMany({
      orderBy: { created_at: "desc" },
      take: 10,
      select: {
        id: true,
        from_number: true,
        body: true,
        procesado: true,
        error: true,
        created_at: true,
      },
    }),
    // Buscar sesiones activas en Redis (keys wa:state:*)
    redis.keys("wa:state:*").catch(() => [] as string[]),
  ])

  const envVars = {
    META_WA_TOKEN: !!process.env.META_WA_TOKEN ? `...${process.env.META_WA_TOKEN.slice(-6)}` : "❌ NO CONFIGURADO",
    META_WA_PHONE_NUMBER_ID: process.env.META_WA_PHONE_NUMBER_ID ?? "❌ NO CONFIGURADO",
    META_WA_VERIFY_TOKEN: process.env.META_WA_VERIFY_TOKEN ? "✅ configurado" : "❌ NO CONFIGURADO",
    META_APP_SECRET: process.env.META_APP_SECRET ? "✅ configurado" : "❌ NO CONFIGURADO",
    NEXT_PUBLIC_META_WA_NUMBER: process.env.NEXT_PUBLIC_META_WA_NUMBER ?? "❌ NO CONFIGURADO",
  }

  return NextResponse.json({
    env: envVars,
    ultimoError: ultimoError ?? null,
    ultimoErrorEnvio: ultimoErrorEnvio ?? null,
    webhooksRecibidos: ultimosWebhooks,
    sesionesActivasEnRedis: sesionesActivas.length,
    sesionesKeys: sesionesActivas,
  })
}
