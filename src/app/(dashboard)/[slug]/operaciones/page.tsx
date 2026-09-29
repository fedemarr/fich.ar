import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { OperacionesV2 } from "@/components/operaciones/operaciones-v2"
import { OperacionesDashboard } from "@/components/operaciones/operaciones-dashboard"

export const metadata = { title: "Operaciones" }

export default async function OperacionesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  if (!session) redirect(`/login`)

  const empresa = await prisma.empresa.findFirst({
    where: { id: session.user.empresaId },
    select: { operaciones_v2: true },
  })

  if (empresa?.operaciones_v2) {
    return (
      <div className="max-w-4xl mx-auto">
        <OperacionesV2 />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <OperacionesDashboard />
    </div>
  )
}
