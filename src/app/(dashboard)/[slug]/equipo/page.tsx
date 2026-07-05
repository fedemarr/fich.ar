import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { EquipoCliente } from "@/components/supervisores/equipo-cliente"

export default async function EquipoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  if (!session) redirect("/login")
  if (!["SUPERVISOR", "ADMIN", "SUPER_ADMIN"].includes(session.user.rol)) {
    redirect(`/${slug}/resumen`)
  }

  return <EquipoCliente />
}
