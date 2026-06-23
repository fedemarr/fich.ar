import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ColaboradoresCliente } from "@/components/colaboradores/colaboradores-cliente"
import { getColaboradoresActivos, getJornadas } from "@/lib/queries"

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
    getColaboradoresActivos(empresaId),
    getJornadas(empresaId),
  ])

  return (
    <ColaboradoresCliente
      colaboradores={colaboradores}
      jornadas={jornadas}
      empresaId={empresaId}
    />
  )
}
