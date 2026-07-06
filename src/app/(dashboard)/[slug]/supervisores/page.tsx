import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SupervisoresCliente } from "@/components/supervisores/supervisores-cliente"

export default async function SupervisoresPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  if (!session) redirect(`/login`)
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.rol)) redirect(`/${slug}/resumen`)

  const [puntos, colaboradores] = await Promise.all([
    prisma.puntoFichaje.findMany({
      where: { empresa_id: session.user.empresaId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.colaborador.findMany({
      where: { empresa_id: session.user.empresaId, estado: "ACTIVO", deleted_at: null },
      select: { id: true, nombre: true, apellido: true },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
  ])

  return <SupervisoresCliente puntos={puntos} colaboradores={colaboradores} />
}
