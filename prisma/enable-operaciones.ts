import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const result = await prisma.empresa.updateMany({
    where: { deleted_at: null },
    data: { modulo_operaciones: true },
  })
  console.log(`Actualizado: ${result.count} empresa(s)`)

  const empresas = await prisma.empresa.findMany({
    select: { nombre: true, modulo_operaciones: true }
  })
  console.log(empresas)
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect() })
