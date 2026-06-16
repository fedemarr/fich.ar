import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PuntosCliente } from "@/components/puntos/puntos-cliente"

interface PuntosPageProps {
  params: Promise<{ slug: string }>
}

export default async function PuntosPage({ params }: PuntosPageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { slug } = await params

  const empresa = await prisma.empresa.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!empresa) redirect("/login")

  const puntos = await prisma.puntoFichaje.findMany({
    where: { empresa_id: empresa.id, activo: true },
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
  })

  return <PuntosCliente puntos={puntos} empresaId={empresa.id} />
}
