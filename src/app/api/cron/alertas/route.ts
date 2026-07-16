import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { esDiaPresencial, esDiaLaboral } from "@/lib/jornadas"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"

// Vercel Cron — runs 13:00 UTC = 10:00 ARG
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const hoyStr = hoyARG()
  const fechaArg = inicioDiaARG(hoyStr)   // ARG 00:00 = UTC 03:00
  const finDia = finDiaARG(hoyStr)        // ARG 23:59:59 = UTC next day 02:59:59

  const empresas = await prisma.empresa.findMany({
    where: { activa: true, deleted_at: null },
    select: { id: true },
  })

  let totalAusentes = 0

  for (const empresa of empresas) {
    const colaboradores = await prisma.colaborador.findMany({
      where: { empresa_id: empresa.id, estado: "ACTIVO", deleted_at: null, omitir_recordatorio: false },
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
        timestamp: { gte: fechaArg, lte: finDia },
      },
      select: { colaborador_id: true },
    })

    const idsConFichada = new Set(fichadasHoy.map((f) => f.colaborador_id))

    for (const colab of colaboradores) {
      const jornadaActiva = colab.jornadas[0]?.jornada
      if (!jornadaActiva) continue
      if (!esDiaLaboral(jornadaActiva as Parameters<typeof esDiaLaboral>[0], fechaArg)) continue
      if (!esDiaPresencial(jornadaActiva as Parameters<typeof esDiaPresencial>[0], fechaArg)) continue

      if (idsConFichada.has(colab.id)) continue

      // Verificar que no ya tenga novedad para hoy
      const novedadExistente = await prisma.novedad.findFirst({
        where: {
          colaborador_id: colab.id,
          fecha: { gte: fechaArg, lte: finDia },
        },
      })
      if (novedadExistente) continue

      // Crear novedad AU e inasistencia
      // Para @db.Date usamos mediodía UTC del día ARG para evitar drift de timezone
      const fechaNovedad = new Date(hoyStr + "T12:00:00.000Z")
      const fechaLabel = new Date(hoyStr + "T12:00:00.000Z").toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
      })
      await prisma.$transaction([
        prisma.novedad.create({
          data: {
            empresa_id: empresa.id,
            colaborador_id: colab.id,
            fecha: fechaNovedad,
            tipo: "AU",
            observacion: "Generada automáticamente por el sistema",
          },
        }),
        prisma.notificacion.create({
          data: {
            empresa_id: empresa.id,
            colaborador_id: colab.id,
            tipo: "INASISTENCIA",
            titulo: `Inasistencia — ${colab.apellido}, ${colab.nombre}`,
            descripcion: `Sin fichada de entrada el ${fechaLabel}`,
          },
        }),
      ])

      totalAusentes++
    }
  }

  return NextResponse.json({
    ok: true,
    fecha: fechaArg.toISOString().split("T")[0],
    ausentes: totalAusentes,
  })
}
