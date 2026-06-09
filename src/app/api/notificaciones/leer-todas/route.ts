import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  await prisma.notificacion.updateMany({
    where: { empresa_id: session.user.empresaId, estado: "NO_LEIDA" },
    data: { estado: "LEIDA" },
  })

  return NextResponse.json({ ok: true })
}
