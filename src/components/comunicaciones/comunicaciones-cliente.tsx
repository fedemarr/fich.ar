"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Megaphone, Plus, Pencil, Trash2, Clock, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ComunicacionDialog } from "@/components/comunicaciones/comunicacion-dialog"
import { toast } from "sonner"
import type { Comunicacion } from "@/generated/prisma/client"

interface ComunicacionesClienteProps {
  slug: string
  comunicaciones: Comunicacion[]
}

function estadoComunicacion(c: Comunicacion) {
  const ahora = new Date()
  const fin = new Date(c.fecha_fin)
  const inicio = new Date(c.fecha_inicio)

  if (!c.activa) return "inactiva"
  if (fin < ahora) return "vencida"
  if (inicio > ahora) return "programada"
  return "activa"
}

function formatFecha(date: Date | string) {
  return new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function diasRestantes(fecha_fin: Date | string) {
  const diff = new Date(fecha_fin).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function ComunicacionesCliente({ comunicaciones: commsIniciales }: ComunicacionesClienteProps) {
  const router = useRouter()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<Comunicacion | null>(null)
  const [filtro, setFiltro] = useState<"todas" | "activas" | "vencidas">("todas")

  const comunicaciones = commsIniciales

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta comunicación?")) return
    const res = await fetch(`/api/comunicaciones/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Error al eliminar"); return }
    toast.success("Comunicación eliminada")
    router.refresh()
  }

  async function toggleActiva(c: Comunicacion) {
    await fetch(`/api/comunicaciones/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !c.activa }),
    })
    router.refresh()
  }

  const filtradas = comunicaciones.filter((c) => {
    const est = estadoComunicacion(c)
    if (filtro === "activas") return est === "activa" || est === "programada"
    if (filtro === "vencidas") return est === "vencida" || est === "inactiva"
    return true
  })

  const activas = comunicaciones.filter((c) => estadoComunicacion(c) === "activa").length
  const vencidas = comunicaciones.filter((c) => estadoComunicacion(c) === "vencida" || estadoComunicacion(c) === "inactiva").length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Megaphone size={20} className="text-[#2563EB]" />
        <h1 className="text-xl font-semibold text-gray-900">Comunicaciones</h1>
        <Button
          className="ml-auto h-9 gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
          onClick={() => { setEditando(null); setDialogoAbierto(true) }}
        >
          <Plus size={15} />
          Nueva comunicación
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFiltro("todas")}
          className={`bg-white rounded-xl border p-4 text-left transition-colors ${
            filtro === "todas" ? "border-[#2563EB] bg-[#EFF6FF]" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <p className="text-2xl font-bold text-gray-900">{comunicaciones.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total</p>
        </button>
        <button
          onClick={() => setFiltro("activas")}
          className={`bg-white rounded-xl border p-4 text-left transition-colors ${
            filtro === "activas" ? "border-[#2563EB] bg-[#EFF6FF]" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <p className="text-2xl font-bold text-green-600">{activas}</p>
          <p className="text-xs text-gray-500 mt-0.5">Activas</p>
        </button>
        <button
          onClick={() => setFiltro("vencidas")}
          className={`bg-white rounded-xl border p-4 text-left transition-colors ${
            filtro === "vencidas" ? "border-[#2563EB] bg-[#EFF6FF]" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <p className="text-2xl font-bold text-gray-400">{vencidas}</p>
          <p className="text-xs text-gray-500 mt-0.5">Vencidas</p>
        </button>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Megaphone size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Sin comunicaciones</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((c) => {
            const estado = estadoComunicacion(c)
            const dias = diasRestantes(c.fecha_fin)

            return (
              <div
                key={c.id}
                className={`bg-white rounded-xl border p-5 ${
                  estado === "vencida" || estado === "inactiva"
                    ? "border-gray-200 opacity-60"
                    : estado === "activa"
                    ? "border-green-200"
                    : "border-blue-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {estado === "activa" && (
                        <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-xs gap-1">
                          <CheckCircle2 size={10} /> Activa
                        </Badge>
                      )}
                      {estado === "programada" && (
                        <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 text-xs gap-1">
                          <Clock size={10} /> Programada
                        </Badge>
                      )}
                      {estado === "vencida" && (
                        <Badge variant="outline" className="text-gray-500 border-gray-200 text-xs gap-1">
                          <AlertTriangle size={10} /> Vencida
                        </Badge>
                      )}
                      {estado === "inactiva" && (
                        <Badge variant="outline" className="text-gray-500 border-gray-200 text-xs">
                          Inactiva
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-gray-800 leading-relaxed">{c.texto}</p>

                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span>Desde: {formatFecha(c.fecha_inicio)}</span>
                      <span>Hasta: {formatFecha(c.fecha_fin)}</span>
                      {estado === "activa" && dias > 0 && (
                        <span className={`font-medium ${dias <= 3 ? "text-orange-500" : "text-gray-500"}`}>
                          {dias === 1 ? "Vence mañana" : `Vence en ${dias} días`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 px-2 text-xs ${c.activa ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-gray-600"}`}
                      onClick={() => toggleActiva(c)}
                      title={c.activa ? "Desactivar" : "Activar"}
                    >
                      {c.activa ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-[#2563EB]"
                      onClick={() => { setEditando(c); setDialogoAbierto(true) }}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                      onClick={() => eliminar(c.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ComunicacionDialog
        open={dialogoAbierto}
        comunicacion={editando}
        onClose={() => { setDialogoAbierto(false); setEditando(null) }}
        onSuccess={() => { setDialogoAbierto(false); setEditando(null); router.refresh() }}
      />
    </div>
  )
}
