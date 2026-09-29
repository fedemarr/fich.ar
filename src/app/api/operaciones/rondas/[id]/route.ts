import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { id } = await params
  const ronda = await prisma.rondaMuestreo.findFirst({
    where: { id, empresa_id: session.user.empresaId },
    include: {
      sede: { select: { nombre: true } },
      supervisor: { select: { nombre: true } },
      verificaciones: {
        include: {
          sector: {
            include: { ficha: true },
          },
        },
        orderBy: { created_at: "asc" },
      },
    },
  })
  if (!ronda) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json({ ronda })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const { id } = await params
  const body = await req.json() as { estado?: string }

  // Cierra la ronda cuando todas las verificaciones tienen resultado_final
  const ronda = await prisma.rondaMuestreo.findFirst({
    where: { id, empresa_id: session.user.empresaId },
    include: { verificaciones: { select: { resultado_final: true } } },
  })
  if (!ronda) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const todasCompletadas = ronda.verificaciones.every((v) => v.resultado_final !== null)
  const nuevoEstado = body.estado ?? (todasCompletadas ? "COMPLETADA" : ronda.estado)

  await prisma.rondaMuestreo.update({
    where: { id },
    data: { estado: nuevoEstado },
  })

  return NextResponse.json({ ok: true, estado: nuevoEstado })
}
