import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"
import { iniciarDescanso } from "@/app/api/descansos/route"

// GET — estado descanso del colaborador hoy (para la página QR)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const colaborador_id = searchParams.get("colaborador_id")
  const empresa_id = searchParams.get("empresa_id")

  if (!colaborador_id || !empresa_id) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
  }

  const hoy = hoyARG()
  const inicio = inicioDiaARG(hoy)
  const fin = finDiaARG(hoy)

  const descansoHoy = await prisma.descanso.findFirst({
    where: { colaborador_id, empresa_id, inicio: { gte: inicio, lte: fin } },
    orderBy: { inicio: "desc" },
  })

  if (!descansoHoy) return NextResponse.json({ usado: false, activo: false })

  const horaInicio = descansoHoy.inicio.toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires",
  })

  if (!descansoHoy.fin) {
    return NextResponse.json({ usado: true, activo: true, hora_inicio: horaInicio })
  }

  const duracion = Math.round((descansoHoy.fin.getTime() - descansoHoy.inicio.getTime()) / 60000)
  const horaFin = descansoHoy.fin.toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires",
  })

  return NextResponse.json({ usado: true, activo: false, hora_inicio: horaInicio, hora_fin: horaFin, duracion_min: duracion })
}

// POST — iniciar descanso desde página QR (sin auth de sesión)
export async function POST(req: Request) {
  const { colaborador_id, empresa_id } = await req.json() as { colaborador_id?: string; empresa_id?: string }
  if (!colaborador_id || !empresa_id) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
  }

  // Validar que el colaborador pertenece a la empresa
  const colaborador = await prisma.colaborador.findFirst({
    where: { id: colaborador_id, empresa_id, estado: "ACTIVO", deleted_at: null },
  })
  if (!colaborador) return NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 })

  return iniciarDescanso(colaborador_id, empresa_id)
}
