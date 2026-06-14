import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || session.user.rol !== "SUPER_ADMIN") {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <nav className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center gap-6">
        <span className="text-xl font-bold text-[#E8593C]">Fich.ar</span>
        <span className="text-sm text-[#6B7280]">Panel SUPER_ADMIN</span>
        <a href="/admin/auditoria" className="text-sm text-[#111827] hover:text-[#E8593C] ml-auto">
          Auditoría
        </a>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
