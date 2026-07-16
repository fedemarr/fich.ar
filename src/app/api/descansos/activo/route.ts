import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"

// PATCH — cerrar el descanso activo de un colaborador (sin auth, usado desde QR page y bot)
export async function PATCH(req: Request) {
  const { colaborador_id, empresa_id } = await req.json() as { colaborador_id?: string; empresa_id?: string }
  if (!colaborador_id || !empresa_id) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
  }

  const hoy = hoyARG()
  const inicio = inicioDiaARG(hoy)
  const fin = finDiaARG(hoy)

  const descanso = await prisma.descanso.findFirst({
    where: {
      colaborador_id,
      empresa_id,
      inicio: { gte: inicio, lte: fin },
      fin: null,
    },
  })

  if (!descanso) {
    return NextResponse.json({ error: "No hay descanso activo" }, { status: 404 })
  }

  const ahora = new Date()
  await prisma.descanso.update({
    where: { id: descanso.id },
    data: { fin: ahora },
  })

  const duracion = Math.round((ahora.getTime() - descanso.inicio.getTime()) / 60000)
  const horaFin = ahora.toLocaleTimeString("es-AR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires",
  })

  return NextResponse.json({ ok: true, hora: horaFin, duracion_min: duracion })
}
