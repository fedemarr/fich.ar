import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const lista = await prisma.colaborador.findMany({
    where: { omitir_recordatorio: true },
    select: { apellido: true, nombre: true, estado: true },
    orderBy: { apellido: "asc" },
  })
  console.log(`Total con omitir_recordatorio=true: ${lista.length}`)
  lista.forEach((c) => console.log(` - ${c.apellido}, ${c.nombre} [${c.estado}]`))
}

main().catch(console.error).finally(() => { void prisma.$disconnect(); void pool.end() })
