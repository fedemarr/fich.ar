import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { z } from "zod"

const schema = z.object({
  sede_id: z.string().uuid(),
  cantidad_sectores: z.number().int().min(1).max(50).default(5),
})

// Sorteo ponderado: más peso a sectores sin verificar hace más tiempo,
// con reclamos recientes, o que fallaron la última verificación.
async function sortearSectores(empresa_id: string, sede_id: string, cantidad: number, semilla: string) {
  const sectores = await prisma.sector.findMany({
    where: { empresa_id, sede_id, activo: true },
    include: {
      verificaciones: {
        orderBy: { created_at: "desc" },
        take: 1,
        select: { created_at: true, resultado_final: true },
      },
      reclamos: {
        where: { estado: { not: "CERRADO" }, hora_aviso: { gte: new Date(Date.now() - 86400000 * 7) } },
        select: { id: true },
      },
    },
  })

  if (sectores.length === 0) return []

  const ahora = Date.now()

  const pesos = sectores.map((s) => {
    const ultima = s.verificaciones[0]
    const diasSinVerif = ultima
      ? Math.floor((ahora - ultima.created_at.getTime()) / 86400000)
      : 999
    const falloUltima = ultima?.resultado_final === "RECHAZADO" ? 1 : 0
    const tieneReclamo = s.reclamos.length > 0 ? 1 : 0

    // Peso: días sin verificar + bonus por fallo o reclamo
    const peso = Math.max(1, diasSinVerif) + falloUltima * 10 + tieneReclamo * 5
    return { sector: s, peso }
  })

  // Sorteo determinístico con semilla (linear congruential)
  let rng = parseInt(semilla.replace(/-/g, "").slice(0, 8), 16)
  const next = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return Math.abs(rng) / 0xffffffff }

  const seleccionados: typeof sectores = []
  const disponibles = [...pesos]

  const n = Math.min(cantidad, disponibles.length)
  for (let i = 0; i < n; i++) {
    const totalPeso = disponibles.reduce((acc, p) => acc + p.peso, 0)
    let r = next() * totalPeso
    let idx = 0
    for (let j = 0; j < disponibles.length; j++) {
      r -= disponibles[j].peso
      if (r <= 0) { idx = j; break }
    }
    seleccionados.push(disponibles[idx].sector)
    disponibles.splice(idx, 1)
  }

  return seleccionados
}

export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const sede_id = searchParams.get("sede_id")
  const fecha = searchParams.get("fecha")

  const rondas = await prisma.rondaMuestreo.findMany({
    where: {
      empresa_id: session.user.empresaId,
      ...(sede_id ? { sede_id } : {}),
      ...(fecha ? { fecha: new Date(fecha) } : {}),
    },
    include: {
      sede: { select: { nombre: true } },
      supervisor: { select: { nombre: true } },
      _count: { select: { verificaciones: true } },
    },
    orderBy: { created_at: "desc" },
    take: 50,
  })

  return NextResponse.json({ rondas })
}

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const sede = await prisma.sede.findFirst({
    where: { id: parsed.data.sede_id, empresa_id: session.user.empresaId },
  })
  if (!sede) return NextResponse.json({ error: "Sede no encontrada" }, { status: 404 })

  const semilla = crypto.randomUUID()
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const sectoresSorteados = await sortearSectores(
    session.user.empresaId,
    parsed.data.sede_id,
    parsed.data.cantidad_sectores,
    semilla
  )

  if (sectoresSorteados.length === 0) {
    return NextResponse.json({ error: "No hay sectores activos en esta sede" }, { status: 400 })
  }

  const ronda = await prisma.rondaMuestreo.create({
    data: {
      empresa_id: session.user.empresaId,
      sede_id: parsed.data.sede_id,
      supervisor_id: session.user.id,
      fecha: hoy,
      semilla,
      cantidad_sectores: sectoresSorteados.length,
      estado: "EN_CURSO",
      verificaciones: {
        create: sectoresSorteados.map((s) => ({
          empresa_id: session.user.empresaId,
          sector_id: s.id,
          supervisor_id: session.user.id,
        })),
      },
    },
    include: {
      verificaciones: {
        include: { sector: { select: { id: true, nombre: true, ficha: true } } },
      },
    },
  })

  return NextResponse.json({ ronda }, { status: 201 })
}
