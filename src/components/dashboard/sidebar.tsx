"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
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
  UserCog,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  slug: string
  rol?: string
}

const navMain = [
  { href: "resumen",        label: "Resumen",         icon: LayoutDashboard },
  { href: "listado",        label: "Listado del día",  icon: ClipboardList },
  { href: "colaboradores",  label: "Colaboradores",    icon: Users },
  { href: "puntos",         label: "Puntos QR",        icon: MapPin },
  { href: "proyeccion",     label: "Proyección",       icon: BarChart2 },
  { href: "novedades",      label: "Novedades",        icon: Calendar },
  { href: "comunicaciones", label: "Comunicaciones",   icon: Megaphone },
  { href: "notificaciones", label: "Notificaciones",   icon: Bell },
]

const navBottom = [
  { href: "configuracion", label: "Configuración",    icon: Settings },
  { href: "ayuda",         label: "Centro de Ayuda",  icon: HelpCircle },
]

function NavLink({ href, label, icon: Icon, slug, badge }: { href: string; label: string; icon: React.ElementType; slug: string; badge?: number }) {
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
      <span className="relative">
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </span>
      {label}
    </Link>
  )
}

export function Sidebar({ slug, rol }: SidebarProps) {
  const pathname = usePathname()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    fetch("/api/empresa")
      .then((r) => r.json())
      .then((data: { logo_url?: string | null }) => {
        if (data.logo_url) setLogoUrl(data.logo_url)
      })
      .catch(() => {/* silently ignore */})
  }, [])

  useEffect(() => {
    if (pathname.includes("/notificaciones")) {
      setNotifCount(0)
      return
    }
    fetch("/api/notificaciones/count")
      .then((r) => r.json())
      .then((data: { noLeidas: number }) => setNotifCount(data.noLeidas ?? 0))
      .catch(() => {})
  }, [pathname])

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100">
        {logoUrl && !logoError ? (
          <div className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Logo empresa"
              className="h-12 max-w-[160px] object-contain"
              onError={() => setLogoError(true)}
            />
            <span className="text-[10px] text-gray-400 tracking-wide">powered by Fich.ar</span>
          </div>
        ) : (
          <span className="text-2xl font-bold text-[#2563EB] tracking-tight">Fich.ar</span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navMain.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            slug={slug}
            badge={item.href === "notificaciones" ? notifCount : undefined}
          />
        ))}
        {(rol === "ADMIN" || rol === "SUPER_ADMIN") && (
          <NavLink href="usuarios" label="Usuarios" icon={UserCog} slug={slug} />
        )}
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
