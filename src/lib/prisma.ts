import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; pool: Pool }

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 5,                    // máximo 5 conexiones por instancia
    idleTimeoutMillis: 30000,  // cierra conexiones idle después de 30s
    connectionTimeoutMillis: 5000,
  })
}

function createPrismaClient(pool: Pool) {
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

const pool = globalForPrisma.pool ?? createPool()
export const prisma = globalForPrisma.prisma ?? createPrismaClient(pool)

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool
  globalForPrisma.prisma = prisma
}
