import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { esDiaPresencial, esDiaLaboral, esFranco } from "@/lib/jornadas"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"
import { horaAMinutos, minutosAhoraARG } from "@/lib/clases"

// Genera AU (ausente) + notificación a quien no fichó entrada en el día ARG en curso.
// Dos corridas: 10:00 ARG para la mayoría de las empresas, y 18:00 ARG para las que
// tienen alertas_fin_dia (servicios a la tarde/noche, como FourMaster).
export async function generarAlertasAusencias(req: Request, finDelDia: boolean) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const hoyStr = hoyARG()
  const fechaArg = inicioDiaARG(hoyStr)   // ARG 00:00 = UTC 03:00
  const finDia = finDiaARG(hoyStr)        // ARG 23:59:59 = UTC next day 02:59:59

  const empresas = await prisma.empresa.findMany({
    where: { activa: true, deleted_at: null, alertas_fin_dia: finDelDia },
    select: { id: true },
  })

  let totalAusentes = 0
  let totalFrancos = 0
  const minutosAhora = minutosAhoraARG(new Date())

  for (const empresa of empresas) {
    const colaboradores = await prisma.colaborador.findMany({
      where: { empresa_id: empresa.id, estado: "ACTIVO", deleted_at: null, omitir_recordatorio: false },
      include: {
        jornadas: {
          where: finDelDia ? { fecha_hasta: null, jornada: { activo: true } } : { fecha_hasta: null },
          include: { jornada: true },
          take: finDelDia ? undefined : 1,
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
      // A las 18:00 solo cuentan los turnos asignados que trabajan hoy y ya empezaron
      // (un turno de 19 a 23 todavía no se controla)
      const asignacion = finDelDia
        ? colab.jornadas.find((cj) =>
            esDiaLaboral(cj.jornada as Parameters<typeof esDiaLaboral>[0], fechaArg) &&
            horaAMinutos(cj.jornada.hora_inicio) <= minutosAhora)
        : colab.jornadas[0]
      const jornadaActiva = asignacion?.jornada
      if (!jornadaActiva) continue
      if (!esDiaLaboral(jornadaActiva as Parameters<typeof esDiaLaboral>[0], fechaArg)) continue

      if (idsConFichada.has(colab.id)) continue

      const franco = esFranco(asignacion.dias_franco, fechaArg)
      if (!franco && !esDiaPresencial(jornadaActiva as Parameters<typeof esDiaPresencial>[0], fechaArg)) continue

      // Verificar que no ya tenga novedad para hoy
      const novedadExistente = await prisma.novedad.findFirst({
        where: {
          colaborador_id: colab.id,
          fecha: { gte: fechaArg, lte: finDia },
        },
      })
      if (novedadExistente) continue

      // Para @db.Date usamos mediodía UTC del día ARG para evitar drift de timezone
      const fechaNovedad = new Date(hoyStr + "T12:00:00.000Z")

      if (franco) {
        await prisma.novedad.create({
          data: {
            empresa_id: empresa.id,
            colaborador_id: colab.id,
            fecha: fechaNovedad,
            tipo: "FR",
            observacion: "Franco del turno",
          },
        })
        totalFrancos++
        continue
      }

      // Crear novedad AU e inasistencia
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
    francos: totalFrancos,
  })
}
