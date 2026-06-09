import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NotificacionesCliente } from "@/components/notificaciones/notificaciones-cliente"

export default async function NotificacionesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  await params
  const empresaId = session.user.empresaId

  const notificaciones = await prisma.notificacion.findMany({
    where: { empresa_id: empresaId },
    include: { colaborador: true },
    orderBy: { created_at: "desc" },
    take: 100,
  })

  return <NotificacionesCliente notificaciones={notificaciones} />
}
