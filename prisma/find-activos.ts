import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const BUSCAR = ["Poncino","Pereyra","Arispe","Lage","Uballes","Cacciato","Quintana","Roque","Luna","Carballo","Brisuela","Maidana","Gonzalez","Unzain"]

async function main() {
  const activos = await prisma.colaborador.findMany({
    where: {
      estado: "ACTIVO",
      deleted_at: null,
      OR: BUSCAR.map((a) => ({ apellido: { contains: a, mode: "insensitive" as const } })),
    },
    select: { id: true, apellido: true, nombre: true, omitir_recordatorio: true },
    orderBy: { apellido: "asc" },
  })
  console.log(`Activos con apellidos buscados: ${activos.length}`)
  activos.forEach((c) => console.log(` [omitir=${c.omitir_recordatorio}] ${c.apellido}, ${c.nombre}`))
}

main().catch(console.error).finally(() => { void prisma.$disconnect(); void pool.end() })
