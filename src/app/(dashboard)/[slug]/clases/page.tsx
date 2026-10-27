import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ClasesCliente } from "@/components/clases/clases-cliente"

export const metadata = { title: "Clases" }

export default async function ClasesPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const { slug } = await params

  const empresa = await prisma.empresa.findUnique({
    where: { id: session.user.empresaId },
    select: { fichaje_por_clase: true },
  })
  if (!empresa?.fichaje_por_clase) redirect(`/${slug}/resumen`)

  return (
    <div className="max-w-5xl mx-auto">
      <ClasesCliente />
    </div>
  )
}
