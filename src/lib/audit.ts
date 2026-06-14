import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"

interface AuditData {
  empresa_id?: string
  usuario_id?: string
  rol: string
  accion: string
  entidad?: string
  entidad_id?: string
  detalle?: Record<string, unknown>
}

export async function registrarAudit(data: AuditData): Promise<void> {
  try {
    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const user_agent = h.get("user-agent") ?? "unknown"

    await prisma.auditLog.create({
      data: {
        ...data,
        ip,
        user_agent,
        detalle: data.detalle ? JSON.parse(JSON.stringify(data.detalle)) : undefined,
      },
    })
  } catch {
    // El audit nunca debe romper el flujo principal
  }
}
