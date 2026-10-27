import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { clasesDelDia } from "@/lib/clases"
import { hoyARG } from "@/lib/utils"

// GET ?fecha=YYYY-MM-DD — clases programadas del día con quién las dio
export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_FICHADAS")
  if (error) return error
  const empresaId = session.user.empresaId

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { fichaje_por_clase: true } })
  if (!empresa?.fichaje_por_clase) {
    return NextResponse.json({ error: "Esta empresa no ficha por clase" }, { status: 403 })
  }

  const fecha = new URL(req.url).searchParams.get("fecha") ?? hoyARG()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
  }

  const filtro = session.user.rol === "SUPERVISOR" ? { puntosIds: session.user.puntosIds } : undefined
  const clases = await clasesDelDia(empresaId, fecha, new Date(), filtro)

  return NextResponse.json({ fecha, es_hoy: fecha === hoyARG(), clases })
}
