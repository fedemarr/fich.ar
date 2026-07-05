import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { Toaster } from "@/components/ui/sonner"
import { ChatWidget } from "@/components/ai/chat-widget"

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { slug } = await params

  if (session.user.empresaSlug !== slug) {
    redirect(`/${session.user.empresaSlug}/resumen`)
  }

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden">
      <Sidebar slug={slug} rol={session.user.rol} puedeGestionarPuntos={session.user.puedeGestionarPuntos} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header userName={session.user.name} empresaNombre={session.user.empresaNombre} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <Toaster richColors position="top-right" />
      <ChatWidget />
    </div>
  )
}
