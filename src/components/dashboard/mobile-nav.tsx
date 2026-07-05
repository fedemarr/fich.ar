"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, UsersRound, ClipboardList,
  Calendar, Bell, MapPin, Megaphone,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavProps {
  slug: string
  rol: string
  puedeGestionarPuntos?: boolean
  notifCount?: number
}

const supervisorTabs = [
  { href: "resumen", label: "Resumen",   icon: LayoutDashboard },
  { href: "equipo",  label: "Mi equipo", icon: UsersRound },
  { href: "listado", label: "Listado",   icon: ClipboardList },
  { href: "novedades", label: "Novedades", icon: Calendar },
  { href: "notificaciones", label: "Alertas", icon: Bell },
]

const adminTabs = [
  { href: "resumen",    label: "Resumen",  icon: LayoutDashboard },
  { href: "listado",    label: "Listado",  icon: ClipboardList },
  { href: "novedades",  label: "Novedades", icon: Calendar },
  { href: "comunicaciones", label: "Avisos", icon: Megaphone },
  { href: "notificaciones", label: "Alertas", icon: Bell },
]

export function MobileNav({ slug, rol, puedeGestionarPuntos, notifCount = 0 }: MobileNavProps) {
  const pathname = usePathname()
  const tabs = rol === "SUPERVISOR" ? supervisorTabs : adminTabs

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => {
          const fullHref = `/${slug}/${tab.href}`
          const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`)
          const isNotif = tab.href === "notificaciones"
          return (
            <Link
              key={tab.href}
              href={fullHref}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative",
                isActive ? "text-[#2563EB]" : "text-gray-400"
              )}
            >
              <span className="relative">
                <tab.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                {isNotif && notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </span>
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#2563EB] rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
