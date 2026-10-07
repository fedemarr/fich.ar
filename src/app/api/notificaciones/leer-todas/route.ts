import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { whereNotificacionesVisibles } from "@/lib/supervisor-helpers"

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  // Un supervisor solo marca las suyas: no debe dejar como leídas las del resto de la empresa
  await prisma.notificacion.updateMany({
    where: { ...(await whereNotificacionesVisibles(session)), estado: "NO_LEIDA" },
    data: { estado: "LEIDA" },
  })

  return NextResponse.json({ ok: true })
}
