import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"

// GET — listar descansos (admin / manager / supervisor)
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fecha = searchParams.get("fecha") ?? hoyARG()

  const inicio = inicioDiaARG(fecha)
  const fin = finDiaARG(fecha)

  const descansos = await prisma.descanso.findMany({
    where: {
      empresa_id: session.user.empresaId,
      inicio: { gte: inicio, lte: fin },
    },
    include: {
      colaborador: { select: { nombre: true, apellido: true } },
    },
    orderBy: { inicio: "desc" },
  })

  return NextResponse.json(
    descansos.map((d) => ({
      id: d.id,
      colaborador_id: d.colaborador_id,
      colaborador: `${d.colaborador.apellido}, ${d.colaborador.nombre}`,
      inicio: d.inicio.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }),
      fin: d.fin
        ? d.fin.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })
        : null,
      duracion_min: d.fin ? Math.round((d.fin.getTime() - d.inicio.getTime()) / 60000) : null,
      activo: !d.fin,
      inicio_raw: d.inicio,
      fin_raw: d.fin,
    }))
  )
}

// POST — iniciar descanso (desde dashboard, usado por admin/manager)
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { colaborador_id } = await req.json() as { colaborador_id?: string }
  if (!colaborador_id) return NextResponse.json({ error: "colaborador_id requerido" }, { status: 400 })

  return iniciarDescanso(colaborador_id, session.user.empresaId)
}

export async function iniciarDescanso(colaboradorId: string, empresaId: string) {
  const hoy = hoyARG()
  const inicio = inicioDiaARG(hoy)
  const fin = finDiaARG(hoy)

  // Verificar que tiene entrada hoy sin salida
  const fichadasHoy = await prisma.fichada.findMany({
    where: { colaborador_id: colaboradorId, empresa_id: empresaId, timestamp: { gte: inicio, lte: fin }, es_valida: true },
    select: { tipo: true },
  })
  const tieneEntrada = fichadasHoy.some((f) => f.tipo === "ENTRADA")
  const tieneSalida = fichadasHoy.some((f) => f.tipo === "SALIDA")

  if (!tieneEntrada || tieneSalida) {
    return NextResponse.json({ error: "Solo podés tomar un descanso después de registrar la entrada y antes de la salida" }, { status: 400 })
  }

  // Verificar que no usó el descanso hoy
  const descansoHoy = await prisma.descanso.findFirst({
    where: { colaborador_id: colaboradorId, empresa_id: empresaId, inicio: { gte: inicio, lte: fin } },
  })
  if (descansoHoy) {
    return NextResponse.json({ error: "Ya usaste tu descanso de hoy" }, { status: 409 })
  }

  const descanso = await prisma.descanso.create({
    data: { empresa_id: empresaId, colaborador_id: colaboradorId },
  })

  const horaInicio = descanso.inicio.toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires",
  })

  return NextResponse.json({ ok: true, id: descanso.id, hora: horaInicio }, { status: 201 })
}
