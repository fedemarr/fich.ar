import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"

export async function GET() {
  const { error } = await verificarAcceso("VER_AUDITORIA")
  if (error) return error

  const logs = await prisma.auditLog.findMany({
    orderBy: { created_at: "desc" },
    take: 500,
  })

  return NextResponse.json({ logs, total: logs.length })
}
