import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const punto = await prisma.puntoFichaje.findUnique({
    where: { qr_token: token },
    select: {
      id: true,
      nombre: true,
      activo: true,
      empresa_id: true,
      empresa: {
        select: { nombre: true, logo_url: true, slug: true },
      },
    },
  })

  if (!punto || !punto.activo) {
    return NextResponse.json({ error: "Punto no válido" }, { status: 404 })
  }

  return NextResponse.json({ punto })
}
