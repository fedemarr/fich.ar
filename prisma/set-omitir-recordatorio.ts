import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// apellido → nombre (como están guardados en la DB: apellido + nombre separados)
// Formato de la lista: "Apellido(s) Nombre(s)"
const COLABORADORES: Array<{ apellido: string; nombre: string }> = [
  { apellido: "Poncino",          nombre: "Maximiliano Nahuel" },
  { apellido: "Pereyra",          nombre: "Miguel Angel" },
  { apellido: "Arispe",           nombre: "Alfredo Julian" },
  { apellido: "Gonzalez",         nombre: "Claudio Alberto" },
  { apellido: "Unzain Bordon",    nombre: "Lorena Epifania" },
  { apellido: "Lage",             nombre: "Dario Eduardo" },
  { apellido: "Uballes",          nombre: "Alvaro Jesus" },
  { apellido: "Cacciato",         nombre: "Alejandro Jose Antonio" },
  { apellido: "Quintana",         nombre: "Teresa Ines" },
  { apellido: "Roque Iriarte",    nombre: "Jose Luis" },
  { apellido: "Luna",             nombre: "Carlos Javier" },
  { apellido: "Carballo",         nombre: "Gisela Soledad" },
  { apellido: "Gonzalez Cordoba", nombre: "Jorge Ariel" },
  { apellido: "Brisuela",         nombre: "Hugo Armando" },
  { apellido: "Maidana",          nombre: "Matias Ezequiel" },
]

async function main() {
  let actualizados = 0
  let noEncontrados: string[] = []

  for (const { apellido, nombre } of COLABORADORES) {
    // Buscar por apellido exacto (case-insensitive) y nombre contains primera palabra
    const primerNombre = nombre.split(" ")[0]
    const resultados = await prisma.colaborador.findMany({
      where: {
        apellido: { contains: apellido, mode: "insensitive" },
        nombre: { contains: primerNombre, mode: "insensitive" },
      },
      select: { id: true, nombre: true, apellido: true },
    })

    if (resultados.length === 0) {
      noEncontrados.push(`${apellido} ${nombre}`)
      continue
    }

    for (const c of resultados) {
      await prisma.colaborador.update({
        where: { id: c.id },
        data: { omitir_recordatorio: true },
      })
      console.log(`✓ ${c.apellido}, ${c.nombre}`)
      actualizados++
    }
  }

  console.log(`\nActualizados: ${actualizados}`)
  if (noEncontrados.length > 0) {
    console.log(`\nNo encontrados (verificar manualmente):`)
    noEncontrados.forEach((n) => console.log(`  ✗ ${n}`))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
