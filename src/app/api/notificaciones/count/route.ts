import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ noLeidas: 0 })

  const noLeidas = await prisma.notificacion.count({
    where: { empresa_id: session.user.empresaId, estado: "NO_LEIDA" },
  })

  return NextResponse.json({ noLeidas })
}
