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
  if (id === session.user.id) {
    return NextResponse.json({ error: "No podés eliminarte a vos mismo" }, { status: 400 })
  }

  await prisma.usuario.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: { deleted_at: new Date(), activo: false },
  })

  return NextResponse.json({ ok: true })
}
