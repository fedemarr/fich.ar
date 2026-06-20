"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  MapPin,
  BarChart2,
  Calendar,
  Megaphone,
  Bell,
  Settings,
  HelpCircle,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  slug: string
  rol?: string
  empresaLogoUrl?: string | null
}

const navMain = [
  { href: "resumen",        label: "Resumen",        icon: LayoutDashboard },
  { href: "listado",        label: "Listado del día", icon: ClipboardList },
  { href: "colaboradores",  label: "Colaboradores",   icon: Users },
  { href: "puntos",         label: "Puntos QR",       icon: MapPin },
  { href: "proyeccion",     label: "Proyección",      icon: BarChart2 },
  { href: "novedades",      label: "Novedades",       icon: Calendar },
  { href: "comunicaciones", label: "Comunicaciones",  icon: Megaphone },
  { href: "notificaciones", label: "Notificaciones",  icon: Bell },
]

const navBottom = [
  { href: "configuracion", label: "Configuración",   icon: Settings },
  { href: "ayuda",         label: "Centro de Ayuda", icon: HelpCircle },
]

function NavLink({ href, label, icon: Icon, slug }: { href: string; label: string; icon: React.ElementType; slug: string }) {
  const pathname = usePathname()
  const fullHref = `/${slug}/${href}`
  const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`)

  return (
    <Link
      href={fullHref}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "text-[#2563EB] bg-[#EFF6FF] border-l-2 border-[#2563EB] pl-[10px]"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      )}
    >
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
      {label}
    </Link>
  )
}

export function Sidebar({ slug, rol, empresaLogoUrl }: SidebarProps) {
  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100">
        {empresaLogoUrl ? (
          <div className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={empresaLogoUrl} alt="Logo empresa" className="h-9 max-w-[140px] object-contain" />
            <span className="text-[10px] text-gray-400 tracking-wide">powered by Fich.ar</span>
          </div>
        ) : (
          <span className="text-2xl font-bold text-[#2563EB] tracking-tight">Fich.ar</span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navMain.map((item) => (
          <NavLink key={item.href} {...item} slug={slug} />
        ))}
      </nav>

      <div className="px-3 pb-4 border-t border-gray-100 pt-3 space-y-1">
        {navBottom.map((item) => (
          <NavLink key={item.href} {...item} slug={slug} />
        ))}

        {rol === "SUPER_ADMIN" && (
          <Link
            href="/admin/auditoria"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[#E8593C] hover:bg-[#FEF3F0] transition-colors mt-1"
          >
            <Shield size={18} strokeWidth={2} />
            Ir a Auditoría
          </Link>
        )}
      </div>
    </aside>
  )
}
