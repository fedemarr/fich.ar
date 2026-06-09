import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding Olimpia...")

  const empresa = await prisma.empresa.upsert({
    where: { slug: "olimpia" },
    update: {},
    create: { nombre: "Olimpia", slug: "olimpia" },
  })

  const passwordHash = await bcrypt.hash("admin123", 12)
  await prisma.usuario.upsert({
    where: { email: "admin@olimpia.com" },
    update: {},
    create: {
      empresa_id: empresa.id,
      nombre: "Admin",
      email: "admin@olimpia.com",
      password: passwordHash,
      rol: "ADMIN",
    },
  })

  const puntoOficina = await prisma.puntoFichaje.upsert({
    where: { qr_token: "olimpia-oficina-token" },
    update: {},
    create: {
      empresa_id: empresa.id,
      nombre: "Olimpia Oficina",
      latitud: -34.5724,
      longitud: -58.4506,
      radio_metros: 200,
      qr_token: "olimpia-oficina-token",
    },
  })

  const puntoDeposito = await prisma.puntoFichaje.upsert({
    where: { qr_token: "olimpia-deposito-token" },
    update: {},
    create: {
      empresa_id: empresa.id,
      nombre: "Depósito Logística",
      latitud: -34.5838,
      longitud: -58.4504,
      radio_metros: 300,
      qr_token: "olimpia-deposito-token",
    },
  })

  const jornadaLV = await prisma.jornada.create({
    data: {
      empresa_id: empresa.id,
      punto_fichaje_id: puntoOficina.id,
      nombre: "L-V 9 a 17",
      hora_inicio: "09:00",
      hora_fin: "17:00",
      tolerancia_min: 15,
      lunes_presencial: true,
      martes_presencial: true,
      miercoles_presencial: true,
      jueves_presencial: true,
      viernes_presencial: true,
    },
  })

  const jornada4diasVirtual = await prisma.jornada.create({
    data: {
      empresa_id: empresa.id,
      punto_fichaje_id: puntoOficina.id,
      nombre: "4 días + virtual miércoles",
      hora_inicio: "09:00",
      hora_fin: "17:00",
      tolerancia_min: 15,
      lunes_presencial: true,
      martes_presencial: true,
      miercoles_virtual: true,
      jueves_presencial: true,
      viernes_presencial: true,
    },
  })

  const jornada2dias = await prisma.jornada.create({
    data: {
      empresa_id: empresa.id,
      punto_fichaje_id: puntoOficina.id,
      nombre: "2 días presenciales",
      hora_inicio: "09:00",
      hora_fin: "17:00",
      tolerancia_min: 15,
      lunes_presencial: true,
      martes_presencial: true,
    },
  })

  const jornadaDeposito = await prisma.jornada.create({
    data: {
      empresa_id: empresa.id,
      punto_fichaje_id: puntoDeposito.id,
      nombre: "Administración",
      hora_inicio: "09:00",
      hora_fin: "17:00",
      tolerancia_min: 15,
      lunes_presencial: true,
      martes_presencial: true,
      miercoles_presencial: true,
      jueves_presencial: true,
      viernes_presencial: true,
    },
  })

  const colaboradores = [
    { nombre: "Gabriela", apellido: "Lucero", celular: "+5491136832051", jornada: jornadaLV },
    { nombre: "Cecilia Raquel", apellido: "Recalde Samaniego", celular: "+5491136830491", jornada: jornadaLV },
    { nombre: "Lucas Valentin", apellido: "Maidana", celular: "+5491133045658", jornada: jornada4diasVirtual },
    { nombre: "Yolanda", apellido: "Panica Zulema", celular: "+5491134736440", jornada: jornadaLV },
    { nombre: "Florencia Beatriz", apellido: "Puma", celular: "+5491138075464", legajo: "2570", jornada: jornada4diasVirtual },
    { nombre: "Martina Concepcion", apellido: "Ramirez Benitez", celular: "+5491122751376", jornada: jornada2dias },
    { nombre: "Rocio Del Cielo", apellido: "Rodriguez Naara", celular: "+5491136831803", jornada: jornadaDeposito },
    { nombre: "Matilde", apellido: "Noceti", celular: "+5491136855479", jornada: jornadaDeposito },
    { nombre: "Sandra", apellido: "Luna", celular: "+5491100000001", jornada: jornadaLV },
    { nombre: "Jimena Mariel", apellido: "Martinez Guillen", celular: "+5491100000002", jornada: jornadaLV },
  ]

  for (const colab of colaboradores) {
    const colaborador = await prisma.colaborador.create({
      data: {
        empresa_id: empresa.id,
        nombre: colab.nombre,
        apellido: colab.apellido,
        celular: colab.celular,
        legajo: colab.legajo,
        estado: "ACTIVO",
        fecha_ingreso: new Date("2024-01-01"),
      },
    })

    await prisma.colaboradorJornada.create({
      data: {
        colaborador_id: colaborador.id,
        jornada_id: colab.jornada.id,
        fecha_desde: new Date("2024-01-01"),
      },
    })
  }

  console.log("✓ Seed completado: empresa Olimpia con", colaboradores.length, "colaboradores")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
