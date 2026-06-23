import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ListadoCliente } from "@/components/listado/listado-cliente"
import { hoyARG, inicioDiaARG, finDiaARG } from "@/lib/utils"

interface ListadoPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ fecha?: string; hasta?: string }>
}

export default async function ListadoPage({ params, searchParams }: ListadoPageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  await params
  const { fecha, hasta } = await searchParams
  const empresaId = session.user.empresaId

  const fechaStr = fecha ?? hoyARG()
  const hastaStr = hasta ?? fechaStr
  const fechaDesde = inicioDiaARG(fechaStr)
  const fechaHasta = finDiaARG(hastaStr)

  const [colaboradores, fichadas] = await Promise.all([
    prisma.colaborador.findMany({
      where: { empresa_id: empresaId, estado: "ACTIVO", deleted_at: null },
      include: {
        jornadas: {
          where: { fecha_hasta: null },
          include: { jornada: { include: { punto_fichaje: true } } },
          take: 1,
        },
      },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.fichada.findMany({
      where: {
        empresa_id: empresaId,
        timestamp: { gte: fechaDesde, lte: fechaHasta },
      },
      include: {
        colaborador: true,
        punto_fichaje: true,
      },
      orderBy: { timestamp: "asc" },
    }),
  ])

  return (
    <ListadoCliente
      colaboradores={colaboradores}
      fichadas={fichadas}
      empresaId={empresaId}
      fechaInicial={fechaStr}
      hastaInicial={hasta ?? null}
    />
  )
}
