import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"

// Fotos de una ronda: se piden al abrirla en el historial para no cargar todas juntas
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("VER_COLABORADORES")
  if (error) return error

  const { id } = await params
  const puntosIds = session.user.rol === "SUPERVISOR" ? session.user.puntosIds : null

  const supervision = await prisma.supervision.findFirst({
    where: {
      id,
      empresa_id: session.user.empresaId,
      ...(puntosIds ? { punto_fichaje_id: { in: puntosIds } } : {}),
    },
    select: { fotos: true },
  })
  if (!supervision) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  return NextResponse.json({ fotos: supervision.fotos })
}
