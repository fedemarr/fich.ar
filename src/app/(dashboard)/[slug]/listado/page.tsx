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

  const { slug } = await params
  const { fecha, hasta } = await searchParams

  const empresa = await prisma.empresa.findUnique({
    where: { slug },
    select: { id: true, nombre: true },
  })
  if (!empresa) redirect("/login")

  const fechaStr = fecha ?? hoyARG()
  const hastaStr = hasta ?? fechaStr

  const fechaDesde = inicioDiaARG(fechaStr)
  const fechaHasta = finDiaARG(hastaStr)

  const [colaboradores, fichadas] = await Promise.all([
    prisma.colaborador.findMany({
      where: { empresa_id: empresa.id, estado: "ACTIVO", deleted_at: null },
      include: {
        jornadas: {
          where: {
            fecha_hasta: null,
          },
          include: {
            jornada: {
              include: { punto_fichaje: true },
            },
          },
          take: 1,
        },
      },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.fichada.findMany({
      where: {
        empresa_id: empresa.id,
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
      empresaId={empresa.id}
      fechaInicial={fechaStr}
      hastaInicial={hasta ?? null}
    />
  )
}
