import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.rol)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const empresa = await prisma.empresa.update({
    where: { id: session.user.empresaId },
    data: { stats_token: crypto.randomUUID() },
    select: { stats_token: true },
  })

  return NextResponse.json({ stats_token: empresa.stats_token })
}
