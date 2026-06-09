import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ConfiguracionCliente } from "@/components/configuracion/configuracion-cliente"

export default async function ConfiguracionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  await params
  const empresaId = session.user.empresaId

  const [empresa, usuario, usuarios] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nombre: true, slug: true, logo_url: true },
    }),
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, nombre: true, email: true, rol: true },
    }),
    prisma.usuario.findMany({
      where: { empresa_id: empresaId, deleted_at: null },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
      orderBy: { nombre: "asc" },
    }),
  ])

  if (!empresa || !usuario) redirect("/login")

  return (
    <ConfiguracionCliente
      empresa={empresa}
      usuario={usuario}
      usuarios={usuarios}
    />
  )
}
