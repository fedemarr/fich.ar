import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NovedadesCliente } from "@/components/novedades/novedades-cliente"

export default async function NovedadesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ fecha?: string; desde?: string; hasta?: string; tab?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { slug } = await params
  const sp = await searchParams
  const tab = sp.tab ?? "inasistencias"

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const fechaStr = sp.fecha ?? hoy.toISOString().split("T")[0]

  const desdeStr = sp.desde ?? fechaStr
  const hastaStr = sp.hasta ?? fechaStr
  const desde = new Date(desdeStr + "T00:00:00")
  const hasta = new Date(hastaStr + "T23:59:59")

  const empresaId = session.user.empresaId

  const [colaboradores, novedades, fichadasDelDia] = await Promise.all([
    prisma.colaborador.findMany({
      where: { empresa_id: empresaId, deleted_at: null, estado: "ACTIVO" },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.novedad.findMany({
      where: {
        empresa_id: empresaId,
        fecha: { gte: desde, lte: hasta },
      },
      include: { colaborador: true },
      orderBy: { fecha: "desc" },
    }),
    prisma.fichada.findMany({
      where: {
        empresa_id: empresaId,
        tipo: "ENTRADA",
        timestamp: {
          gte: new Date(fechaStr + "T00:00:00"),
          lte: new Date(fechaStr + "T23:59:59"),
        },
      },
      select: { colaborador_id: true },
    }),
  ])

  const idsConFichada = new Set(fichadasDelDia.map((f) => f.colaborador_id))
  const inasistentes = colaboradores.filter((c) => !idsConFichada.has(c.id))

  return (
    <NovedadesCliente
      slug={slug}
      colaboradores={colaboradores}
      novedades={novedades}
      inasistentes={inasistentes}
      tabInicial={tab}
      fechaInicial={fechaStr}
      desdeInicial={desdeStr}
      hastaInicial={hastaStr}
    />
  )
}
