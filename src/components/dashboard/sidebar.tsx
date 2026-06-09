"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  MapPin,
  Calendar,
  Megaphone,
  Bell,
  Settings,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  slug: string
}

const navMain = [
  { href: "resumen",        label: "Resumen",        icon: LayoutDashboard },
  { href: "listado",        label: "Listado del día", icon: ClipboardList },
  { href: "colaboradores",  label: "Colaboradores",   icon: Users },
  { href: "puntos",         label: "Puntos QR",       icon: MapPin },
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
          ? "text-[#E8593C] bg-[#FEF3F0] border-l-2 border-[#E8593C] pl-[10px]"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      )}
    >
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
      {label}
    </Link>
  )
}

export function Sidebar({ slug }: SidebarProps) {
  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100">
        <span className="text-2xl font-bold text-[#E8593C] tracking-tight">Fich.ar</span>
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
      </div>
    </aside>
  )
}
