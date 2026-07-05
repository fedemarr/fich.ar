import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { MobileNav } from "@/components/dashboard/mobile-nav"
import { Toaster } from "@/components/ui/sonner"
import { ChatWidget } from "@/components/ai/chat-widget"

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { slug } = await params
  if (session.user.empresaSlug !== slug) redirect(`/${session.user.empresaSlug}/resumen`)

  const notifCount = await prisma.notificacion.count({
    where: { empresa_id: session.user.empresaId, estado: "NO_LEIDA" },
  })

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden">
      {/* Sidebar — oculto en mobile */}
      <div className="hidden lg:flex">
        <Sidebar
          slug={slug}
          rol={session.user.rol}
          puedeGestionarPuntos={session.user.puedeGestionarPuntos}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header userName={session.user.name} empresaNombre={session.user.empresaNombre} />
        {/* padding-bottom en mobile para el bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav — solo mobile */}
      <MobileNav
        slug={slug}
        rol={session.user.rol}
        puedeGestionarPuntos={session.user.puedeGestionarPuntos}
        notifCount={notifCount}
      />

      <Toaster richColors position="top-right" />
      <ChatWidget />
    </div>
  )
}
