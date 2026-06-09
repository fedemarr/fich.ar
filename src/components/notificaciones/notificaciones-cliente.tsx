"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, AlertCircle, Info, Megaphone, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { Notificacion, Colaborador, TipoNotificacion } from "@/generated/prisma/client"

type NotificacionConColaborador = Notificacion & { colaborador: Colaborador | null }

interface NotificacionesClienteProps {
  notificaciones: NotificacionConColaborador[]
}

const ICONOS: Record<TipoNotificacion, React.ReactNode> = {
  FALLA_FICHADA: <AlertCircle size={16} className="text-orange-500" />,
  INASISTENCIA: <UserX size={16} className="text-red-500" />,
  SISTEMA: <Info size={16} className="text-blue-500" />,
  COMUNICACION_NUEVA: <Megaphone size={16} className="text-[#E8593C]" />,
}

const ETIQUETAS: Record<TipoNotificacion, string> = {
  FALLA_FICHADA: "Falla fichada",
  INASISTENCIA: "Inasistencia",
  SISTEMA: "Sistema",
  COMUNICACION_NUEVA: "Comunicación",
}

function formatFechaRelativa(date: Date | string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  const horas = Math.floor(diff / 3600000)
  const dias = Math.floor(diff / 86400000)

  if (mins < 1) return "ahora"
  if (mins < 60) return `hace ${mins}min`
  if (horas < 24) return `hace ${horas}h`
  if (dias < 7) return `hace ${dias}d`
  return new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
}

export function NotificacionesCliente({ notificaciones: notifs }: NotificacionesClienteProps) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<"todas" | "no_leidas">("todas")

  const noLeidas = notifs.filter((n) => n.estado === "NO_LEIDA")
  const filtradas = filtro === "no_leidas" ? noLeidas : notifs

  async function marcarLeida(id: string) {
    await fetch(`/api/notificaciones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "LEIDA" }),
    })
    router.refresh()
  }

  async function marcarTodasLeidas() {
    await fetch("/api/notificaciones/leer-todas", { method: "POST" })
    toast.success("Notificaciones marcadas como leídas")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-[#E8593C]" />
        <h1 className="text-xl font-semibold text-gray-900">Notificaciones</h1>
        {noLeidas.length > 0 && (
          <Badge className="bg-[#E8593C] text-white text-xs">{noLeidas.length}</Badge>
        )}
        {noLeidas.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 gap-1.5 text-xs"
            onClick={marcarTodasLeidas}
          >
            <CheckCheck size={13} />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setFiltro("todas")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filtro === "todas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Todas ({notifs.length})
        </button>
        <button
          onClick={() => setFiltro("no_leidas")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filtro === "no_leidas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          No leídas ({noLeidas.length})
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtradas.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {filtro === "no_leidas" ? "No tenés notificaciones sin leer" : "Sin notificaciones"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtradas.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors ${
                  n.estado === "NO_LEIDA" ? "bg-[#FEF3F0]/30" : ""
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {ICONOS[n.tipo]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm ${n.estado === "NO_LEIDA" ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                      {n.titulo}
                    </p>
                    <Badge variant="outline" className="text-xs text-gray-400 border-gray-200 py-0">
                      {ETIQUETAS[n.tipo]}
                    </Badge>
                    {n.estado === "NO_LEIDA" && (
                      <span className="w-2 h-2 rounded-full bg-[#E8593C] shrink-0" />
                    )}
                  </div>
                  {n.descripcion && (
                    <p className="text-xs text-gray-500 mb-1">{n.descripcion}</p>
                  )}
                  {n.colaborador && (
                    <p className="text-xs text-gray-400">
                      {n.colaborador.apellido}, {n.colaborador.nombre}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400">
                    {formatFechaRelativa(n.created_at)}
                  </span>
                  {n.estado === "NO_LEIDA" && (
                    <button
                      onClick={() => marcarLeida(n.id)}
                      className="text-gray-300 hover:text-[#E8593C] transition-colors"
                      title="Marcar como leída"
                    >
                      <CheckCheck size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
