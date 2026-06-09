import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ColaboradoresCliente } from "@/components/colaboradores/colaboradores-cliente"

export default async function ColaboradoresPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { slug } = await params

  const empresa = await prisma.empresa.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!empresa) redirect("/login")

  const [colaboradores, jornadas] = await Promise.all([
    prisma.colaborador.findMany({
      where: { empresa_id: empresa.id, deleted_at: null },
      include: {
        jornadas: {
          where: { fecha_hasta: null },
          include: { jornada: { include: { punto_fichaje: true } } },
          take: 1,
        },
      },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.jornada.findMany({
      where: { empresa_id: empresa.id, activo: true },
      include: { punto_fichaje: true },
    }),
  ])

  return (
    <ColaboradoresCliente
      colaboradores={colaboradores}
      jornadas={jornadas}
      empresaId={empresa.id}
    />
  )
}
