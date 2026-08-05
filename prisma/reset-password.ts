import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"
import * as path from "path"
import bcrypt from "bcryptjs"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const hash = await bcrypt.hash("agustina06", 12)
  const result = await prisma.usuario.updateMany({
    where: { rol: "SUPER_ADMIN" },
    data: { password: hash },
  })
  console.log("Actualizados:", result.count)
  const usuarios = await prisma.usuario.findMany({
    where: { rol: "SUPER_ADMIN" },
    select: { email: true, rol: true },
  })
  usuarios.forEach((u) => console.log(" -", u.email, u.rol))
}

main().catch(console.error).finally(() => { void prisma.$disconnect(); void pool.end() })
