import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const empresa = await prisma.empresa.findUnique({
    where: { id: session.user.empresaId },
    select: { logo_url: true },
  })
  return NextResponse.json({ logo_url: empresa?.logo_url ?? null })
}

const schema = z.object({
  nombre: z.string().min(1),
  logo_url: z.string().optional().nullable(),
})

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  await prisma.empresa.update({
    where: { id: session.user.empresaId },
    data: {
      nombre: parsed.data.nombre,
      logo_url: parsed.data.logo_url ?? null,
    },
  })

  return NextResponse.json({ ok: true })
}
