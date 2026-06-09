import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { esDiaPresencial, esDiaLaboral } from "@/lib/jornadas"

// Vercel Cron — runs 13:00 UTC = 10:00 ARG
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const ahora = new Date()
  // Argentina timezone offset: UTC-3
  const fechaArg = new Date(ahora.getTime() - 3 * 60 * 60 * 1000)
  fechaArg.setHours(0, 0, 0, 0)

  const empresas = await prisma.empresa.findMany({
    where: { activa: true, deleted_at: null },
    select: { id: true },
  })

  let totalAusentes = 0

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
        timestamp: {
          gte: fechaArg,
          lte: new Date(fechaArg.getTime() + 86400000 - 1),
        },
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
          fecha: {
            gte: fechaArg,
            lte: new Date(fechaArg.getTime() + 86400000 - 1),
          },
        },
      })
      if (novedadExistente) continue

      // Crear novedad AU e inasistencia
      await prisma.$transaction([
        prisma.novedad.create({
          data: {
            empresa_id: empresa.id,
            colaborador_id: colab.id,
            fecha: fechaArg,
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
            descripcion: `Sin fichada de entrada el ${fechaArg.toLocaleDateString("es-AR")}`,
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
