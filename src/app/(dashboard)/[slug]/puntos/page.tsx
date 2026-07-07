import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PuntosCliente } from "@/components/puntos/puntos-cliente"
import { getPuntos } from "@/lib/queries"

export default async function PuntosPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  await params
  const empresaId = session.user.empresaId
  const empresaNombre = session.user.empresaNombre

  const [puntos, empresaData, colaboradores] = await Promise.all([
    getPuntos(empresaId),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { logo_url: true },
    }),
    prisma.colaborador.findMany({
      where: { empresa_id: empresaId, estado: "ACTIVO", deleted_at: null },
      select: { id: true, nombre: true, apellido: true },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
  ])

  return (
    <PuntosCliente
      puntos={puntos}
      colaboradores={colaboradores}
      empresaId={empresaId}
      empresaNombre={empresaNombre}
      empresaLogoUrl={empresaData?.logo_url ?? null}
    />
  )
}
