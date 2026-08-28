"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, UsersRound, ClipboardList,
  Calendar, Bell, MapPin, Users, ClipboardCheck, MoreHorizontal, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavProps {
  slug: string
  rol: string
  puedeGestionarPuntos?: boolean
  notifCount?: number
  moduloOperaciones?: boolean
}

const supervisorTabs = [
  { href: "resumen",        label: "Resumen",   icon: LayoutDashboard },
  { href: "equipo",         label: "Mi equipo", icon: UsersRound },
  { href: "listado",        label: "Listado",   icon: ClipboardList },
  { href: "novedades",      label: "Novedades", icon: Calendar },
  { href: "notificaciones", label: "Alertas",   icon: Bell },
]

export function MobileNav({ slug, rol, notifCount = 0, moduloOperaciones = false }: MobileNavProps) {
  const pathname = usePathname()
  const [masAbierto, setMasAbierto] = useState(false)

  // Tabs "Más" — secciones secundarias accesibles desde mobile
  const masItems = [
    { href: "colaboradores",  label: "Colaboradores", icon: Users,          desc: "Gestionar equipo" },
    { href: "puntos",         label: "Puntos QR",     icon: MapPin,         desc: "Configurar puntos de fichaje" },
    ...(moduloOperaciones
      ? [{ href: "operaciones", label: "Operaciones", icon: ClipboardCheck, desc: "Ver y configurar operaciones" }]
      : []
    ),
    { href: "notificaciones", label: "Alertas",       icon: Bell,           desc: "Notificaciones" },
  ]

  const adminTabs = [
    { href: "resumen",        label: "Resumen",    icon: LayoutDashboard },
    { href: "listado",        label: "Listado",    icon: ClipboardList },
    { href: "novedades",      label: "Novedades",  icon: Calendar },
    { href: "notificaciones", label: "Alertas",    icon: Bell },
  ]

  const tabs = rol === "SUPERVISOR" ? supervisorTabs : adminTabs

  // Para admin: íconos activos en el menú "Más"
  const masActive = masItems.some((item) => {
    const full = `/${slug}/${item.href}`
    return pathname === full || pathname.startsWith(`${full}/`)
  })

  return (
    <>
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

          {/* Botón Más — solo admin */}
          {rol !== "SUPERVISOR" && (
            <button
              onClick={() => setMasAbierto((v) => !v)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative",
                masActive || masAbierto ? "text-[#2563EB]" : "text-gray-400"
              )}
            >
              {masAbierto
                ? <X size={20} strokeWidth={2} />
                : <MoreHorizontal size={20} strokeWidth={1.8} />
              }
              <span>Más</span>
              {(masActive && !masAbierto) && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#2563EB] rounded-full" />
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Menú "Más" — bottom sheet */}
      {masAbierto && (
        <>
          {/* Overlay */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/20"
            onClick={() => setMasAbierto(false)}
          />
          {/* Sheet */}
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 rounded-t-2xl shadow-xl safe-area-pb animate-in slide-in-from-bottom-2 duration-200">
            <div className="px-4 pt-3 pb-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Configuración y más</p>
              <div className="space-y-1">
                {masItems.map((item) => {
                  const fullHref = `/${slug}/${item.href}`
                  const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`)
                  return (
                    <Link
                      key={item.href}
                      href={fullHref}
                      onClick={() => setMasAbierto(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-xl transition-colors",
                        isActive
                          ? "bg-[#EFF6FF] text-[#2563EB]"
                          : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        isActive ? "bg-[#2563EB]/10" : "bg-gray-100"
                      )}>
                        <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{item.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                      </div>
                      {item.href === "notificaciones" && notifCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {notifCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
