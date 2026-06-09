import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  // Verify jornada belongs to empresa via punto
  const jornada = await prisma.jornada.findFirst({
    where: { id },
    include: { punto_fichaje: true },
  })

  if (!jornada || jornada.punto_fichaje.empresa_id !== session.user.empresaId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  await prisma.jornada.update({
    where: { id },
    data: { activo: false },
  })

  return NextResponse.json({ ok: true })
}
