"use server"

import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function auditarLogin(email: string, password: string): Promise<
  | { ok: true; slug: string }
  | { ok: false; error: string }
> {
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const user_agent = h.get("user-agent") ?? "unknown"

  const usuario = await prisma.usuario.findFirst({
    where: { email, deleted_at: null },
    include: { empresa: { select: { slug: true } } },
  })

  const passwordOk = usuario ? await bcrypt.compare(password, usuario.password) : false
  const exitoso = !!usuario && usuario.activo && passwordOk

  await prisma.auditLog.create({
    data: {
      empresa_id: usuario?.empresa_id ?? null,
      usuario_id: exitoso ? usuario!.id : null,
      rol: usuario?.rol ?? "DESCONOCIDO",
      accion: exitoso ? "LOGIN" : "LOGIN_FALLIDO",
      detalle: { email },
      ip,
      user_agent,
    },
  }).catch(() => {})

  if (!exitoso) return { ok: false, error: "Email o contraseña incorrectos" }
  return { ok: true, slug: usuario!.empresa.slug }
}
