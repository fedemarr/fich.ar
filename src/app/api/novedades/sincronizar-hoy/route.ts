import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"

// Sincroniza las fichadas de ENTRADA de hoy como novedades P/PT
// Solo crea/actualiza si el colaborador no tiene novedad o tiene AU (del cron)
export async function POST(req: Request) {
  const { error, session } = await verificarAcceso("CREAR_NOVEDAD")
  if (error) return error

  const empresaId = session.user.empresaId
  const hoyStr = hoyARG()
  const inicioDia = inicioDiaARG(hoyStr)
  const finDia = finDiaARG(hoyStr)
  const fechaNovedad = new Date(hoyStr + "T12:00:00.000Z")

  const fichadasHoy = await prisma.fichada.findMany({
    where: {
      empresa_id: empresaId,
      tipo: "ENTRADA",
      es_valida: true,
      timestamp: { gte: inicioDia, lte: finDia },
    },
    select: { colaborador_id: true, analisis: true },
  })

  if (fichadasHoy.length === 0) return NextResponse.json({ ok: true, creadas: 0 })

  // Buscar novedades existentes para hoy
  const colaboradorIds = [...new Set(fichadasHoy.map((f) => f.colaborador_id))]
  const novedadesExistentes = await prisma.novedad.findMany({
    where: {
      empresa_id: empresaId,
      colaborador_id: { in: colaboradorIds },
      fecha: fechaNovedad,
    },
    select: { colaborador_id: true, tipo: true },
  })
  const novedadMap = new Map(novedadesExistentes.map((n) => [n.colaborador_id, n.tipo]))

  let creadas = 0
  for (const f of fichadasHoy) {
    const tipoExistente = novedadMap.get(f.colaborador_id)
    // Saltar si ya tiene una novedad que no sea AU (VAC, FR, EN, etc.)
    if (tipoExistente && tipoExistente !== "AU") continue

    const tipoNovedad = f.analisis === "LLEGADA_TARDE" ? "PT" : "P"
    await prisma.novedad.upsert({
      where: { colaborador_id_fecha: { colaborador_id: f.colaborador_id, fecha: fechaNovedad } },
      create: { empresa_id: empresaId, colaborador_id: f.colaborador_id, fecha: fechaNovedad, tipo: tipoNovedad },
      update: { tipo: tipoNovedad },
    })
    creadas++
  }

  return NextResponse.json({ ok: true, creadas })
}
