import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"

export async function GET(req: Request) {
  const { error } = await verificarAcceso("VER_AUDITORIA")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const empresa_id = searchParams.get("empresa_id")

  const where = empresa_id ? { empresa_id } : {}

  const [logs, empresas] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 500,
    }),
    prisma.empresa.findMany({
      where: { deleted_at: null },
      select: { id: true, nombre: true, slug: true },
      orderBy: { nombre: "asc" },
    }),
  ])

  return NextResponse.json({ logs, total: logs.length, empresas })
}
