import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DescansosCliente } from "@/components/descansos/descansos-cliente"

export const metadata = { title: "Descansos" }

export default async function DescansosPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  const { slug } = await params

  const empresa = await prisma.empresa.findUnique({
    where: { id: session.user.empresaId },
    select: { descanso_wa: true },
  })
  if (empresa && !empresa.descanso_wa) redirect(`/${slug}/resumen`)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <DescansosCliente />
    </div>
  )
}
