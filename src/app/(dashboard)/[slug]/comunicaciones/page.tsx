import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ComunicacionesCliente } from "@/components/comunicaciones/comunicaciones-cliente"

export default async function ComunicacionesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { slug } = await params
  const empresaId = session.user.empresaId

  const comunicaciones = await prisma.comunicacion.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
    orderBy: { fecha_inicio: "desc" },
  })

  return <ComunicacionesCliente slug={slug} comunicaciones={comunicaciones} />
}
