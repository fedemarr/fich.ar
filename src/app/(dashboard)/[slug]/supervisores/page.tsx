import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SupervisoresCliente } from "@/components/supervisores/supervisores-cliente"

export default async function SupervisoresPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  if (!session) redirect(`/login`)
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.rol)) redirect(`/${slug}/resumen`)

  const puntos = await prisma.puntoFichaje.findMany({
    where: { empresa_id: session.user.empresaId, activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  })

  return <SupervisoresCliente puntos={puntos} />
}
