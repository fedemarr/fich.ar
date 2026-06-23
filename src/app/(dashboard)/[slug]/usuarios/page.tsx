import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UsuariosCliente } from "@/components/usuarios/usuarios-cliente"

export default async function UsuariosPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  await params

  if (session.user.rol !== "ADMIN" && session.user.rol !== "SUPER_ADMIN") {
    redirect(`/${session.user.empresaSlug}/resumen`)
  }

  return <UsuariosCliente />
}
