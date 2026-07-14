import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Building2, Shield } from "lucide-react"
import Link from "next/link"

const NAV = [
  { href: "/admin/empresas", label: "Empresas", icon: Building2 },
  { href: "/admin/auditoria", label: "Auditoría", icon: Shield },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || session.user.rol !== "SUPER_ADMIN") {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">

      {/* ── TOP NAV (mobile) ── */}
      <nav className="lg:hidden sticky top-0 z-20 bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#E8593C]">Jornada.OH</span>
          <span className="text-xs text-[#6B7280] bg-[#F9FAFB] px-2 py-0.5 rounded-full">Admin</span>
        </div>
        <div className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#FEF3F0] hover:text-[#E8593C] transition-colors"
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ── LAYOUT DESKTOP (sidebar + contenido) ── */}
      <div className="lg:flex lg:min-h-screen">

        {/* Sidebar — solo desktop */}
        <aside className="hidden lg:flex w-56 bg-white border-r border-[#E5E7EB] flex-col shrink-0 min-h-screen sticky top-0 h-screen">
          <div className="px-5 py-5 border-b border-[#E5E7EB]">
            <span className="text-xl font-bold text-[#E8593C]">Jornada.OH</span>
            <p className="text-xs text-[#6B7280] mt-0.5">Panel Super Admin</p>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#FEF3F0] hover:text-[#E8593C] transition-colors"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="px-5 py-4 border-t border-[#E5E7EB]">
            <p className="text-xs text-[#6B7280] truncate">{session.user.email}</p>
          </div>
        </aside>

        {/* Contenido */}
        <main className="flex-1 p-4 lg:p-8 min-w-0">{children}</main>
      </div>
    </div>
  )
}
