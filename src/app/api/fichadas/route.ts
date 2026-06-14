import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { calcularAnalisis } from "@/lib/jornadas"
import { verificarAcceso } from "@/lib/auth-helpers"
import { registrarAudit } from "@/lib/audit"

const schema = z.object({
  colaborador_id: z.string(),
  tipo: z.enum(["ENTRADA", "SALIDA"]),
  timestamp: z.string(),
  nota_manual: z.string().optional(),
  metodo: z.enum(["MANUAL", "QR_WHATSAPP"]).default("MANUAL"),
})

export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_FICHADA_MANUAL")
  if (error) return error

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { colaborador_id, tipo, timestamp, nota_manual, metodo } = parsed.data
  const empresaId = session.user.empresaId

  const colaborador = await prisma.colaborador.findFirst({
    where: { id: colaborador_id, empresa_id: empresaId, deleted_at: null },
    include: {
      jornadas: {
        where: { fecha_hasta: null },
        include: { jornada: true },
        take: 1,
      },
    },
  })

  if (!colaborador) return NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 })

  const ts = new Date(timestamp)
  const jornada = colaborador.jornadas[0]?.jornada
  const analisis = calcularAnalisis(ts, tipo, jornada)

  const fichada = await prisma.fichada.create({
    data: {
      empresa_id: empresaId,
      colaborador_id,
      tipo,
      metodo,
      timestamp: ts,
      analisis,
      es_valida: true,
      nota_manual,
      usuario_manual_id: session.user.id,
    },
  })

  await registrarAudit({
    empresa_id: empresaId,
    usuario_id: session.user.id,
    rol: session.user.rol,
    accion: "FICHADA_MANUAL",
    entidad: "fichada",
    entidad_id: fichada.id,
    detalle: { colaborador_id, tipo, timestamp, metodo },
  })

  return NextResponse.json(fichada, { status: 201 })
}

export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_FICHADAS")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get("fecha")
  const empresaId = session.user.empresaId

  const desde = fecha ? new Date(fecha) : new Date()
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date(desde)
  hasta.setHours(23, 59, 59, 999)

  const fichadas = await prisma.fichada.findMany({
    where: {
      empresa_id: empresaId,
      timestamp: { gte: desde, lte: hasta },
    },
    include: { colaborador: true, punto_fichaje: true },
    orderBy: { timestamp: "asc" },
  })

  return NextResponse.json(fichadas)
}
