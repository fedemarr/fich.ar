import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// Apellidos exactos tal como están guardados en los registros ACTIVOS
const APELLIDOS_EXACTOS = [
  "Arispe Alfredo",
  "Brisuela Hugo",
  "Cacciato Alejandro",
  "Carballo Gisela",
  "Gonzalez Claudio",
  "Lage Dario",
  "Luna Carlos",
  "Maidana Matias",
  "Pereyra Miguel",
  "Poncino Maximiliano",
  "Quintana Teresa",
  "Uballes Alvaro",
]

async function main() {
  const result = await prisma.colaborador.updateMany({
    where: {
      estado: "ACTIVO",
      deleted_at: null,
      apellido: { in: APELLIDOS_EXACTOS },
    },
    data: { omitir_recordatorio: true },
  })
  console.log(`Actualizados: ${result.count} registros activos`)

  // Verificar resultado
  const activos = await prisma.colaborador.findMany({
    where: { estado: "ACTIVO", deleted_at: null, omitir_recordatorio: true },
    select: { apellido: true, nombre: true },
    orderBy: { apellido: "asc" },
  })
  console.log(`\nActivos con omitir=true (${activos.length}):`)
  activos.forEach((c) => console.log(` ✓ ${c.apellido}, ${c.nombre}`))
}

main().catch(console.error).finally(() => { void prisma.$disconnect(); void pool.end() })
