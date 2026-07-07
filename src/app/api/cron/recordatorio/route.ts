import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enviarPlantilla } from "@/lib/whatsapp"
import { esDiaPresencial, esDiaLaboral } from "@/lib/jornadas"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"

// Vercel Cron — runs 11:45 UTC = 08:45 ARG
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const hoyStr = hoyARG()
  const inicioDia = inicioDiaARG(hoyStr)
  const finDia = finDiaARG(hoyStr)

  const empresas = await prisma.empresa.findMany({
    where: { activa: true, deleted_at: null },
    select: { id: true },
  })

  let totalEnviados = 0
  let totalOmitidos = 0

  for (const empresa of empresas) {
    const colaboradores = await prisma.colaborador.findMany({
      where: { empresa_id: empresa.id, estado: "ACTIVO", deleted_at: null },
      include: {
        jornadas: {
          where: { fecha_hasta: null },
          include: { jornada: true },
          take: 1,
        },
      },
    })

    const fichadasHoy = await prisma.fichada.findMany({
      where: {
        empresa_id: empresa.id,
        tipo: "ENTRADA",
        timestamp: { gte: inicioDia, lte: finDia },
      },
      select: { colaborador_id: true },
    })

    const idsConFichada = new Set(fichadasHoy.map((f) => f.colaborador_id))

    for (const colab of colaboradores) {
      const jornadaActiva = colab.jornadas[0]?.jornada
      if (!jornadaActiva) { totalOmitidos++; continue }
      if (!esDiaLaboral(jornadaActiva as Parameters<typeof esDiaLaboral>[0], inicioDia)) { totalOmitidos++; continue }
      if (!esDiaPresencial(jornadaActiva as Parameters<typeof esDiaPresencial>[0], inicioDia)) { totalOmitidos++; continue }

      // Ya fichó — no recordar
      if (idsConFichada.has(colab.id)) { totalOmitidos++; continue }

      // Tiene novedad (franco, vacaciones, etc.) — no recordar
      const novedadHoy = await prisma.novedad.findFirst({
        where: { colaborador_id: colab.id, fecha: { gte: inicioDia, lte: finDia } },
      })
      if (novedadHoy) { totalOmitidos++; continue }

      // Normalizar número: asegurarse de que no tenga "+"
      const numero = colab.celular.replace(/^\+/, "")

      try {
        await enviarPlantilla(numero, "recordatorio_ingreso", [])
        totalEnviados++
      } catch {
        totalOmitidos++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    fecha: hoyStr,
    enviados: totalEnviados,
    omitidos: totalOmitidos,
  })
}
