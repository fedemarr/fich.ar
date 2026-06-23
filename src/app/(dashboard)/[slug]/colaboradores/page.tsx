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

  await params
  const empresaId = session.user.empresaId

  const [colaboradores, jornadas] = await Promise.all([
    prisma.colaborador.findMany({
      where: { empresa_id: empresaId, deleted_at: null },
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
      where: { empresa_id: empresaId, activo: true },
      include: { punto_fichaje: true },
    }),
  ])

  return (
    <ColaboradoresCliente
      colaboradores={colaboradores}
      jornadas={jornadas}
      empresaId={empresaId}
    />
  )
}
