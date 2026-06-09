import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  estado: z.enum(["LEIDA", "NO_LEIDA"]),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  await prisma.notificacion.updateMany({
    where: { id, empresa_id: session.user.empresaId },
    data: { estado: parsed.data.estado },
  })

  return NextResponse.json({ ok: true })
}
