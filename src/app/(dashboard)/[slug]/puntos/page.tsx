import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PuntosCliente } from "@/components/puntos/puntos-cliente"

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

  // Puntos y logo en paralelo — sin query empresa previa bloqueante
  const [puntos, empresaData] = await Promise.all([
    prisma.puntoFichaje.findMany({
      where: { empresa_id: empresaId, activo: true },
      include: {
        jornadas: {
          where: { activo: true },
          include: {
            colaboradores: {
              where: { fecha_hasta: null },
            },
          },
        },
      },
      orderBy: { created_at: "asc" },
    }),
    prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { logo_url: true },
    }),
  ])

  return (
    <PuntosCliente
      puntos={puntos}
      empresaId={empresaId}
      empresaNombre={empresaNombre}
      empresaLogoUrl={empresaData?.logo_url ?? null}
    />
  )
}
