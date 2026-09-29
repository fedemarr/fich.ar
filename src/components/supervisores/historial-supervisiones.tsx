"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardCheck, CheckCircle2, AlertTriangle, Loader2, ChevronDown, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface Supervision {
  id: string
  timestamp: string
  estado: "ok" | "novedad"
  checklist_json: { limpieza?: boolean; insumos?: boolean; personal?: boolean }
  observaciones: string | null
  supervisor_nombre: string
  supervisor_tipo: "colaborador" | "usuario"
  fotos: string[]
  punto_id: string
  punto_nombre: string
}

interface Punto { id: string; nombre: string }

interface Props { puntos: Punto[] }

const CHECKLIST_LABELS: Record<string, string> = {
  limpieza: "Limpieza",
  insumos: "Insumos",
  personal: "Personal",
}

function fechaLarga(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  })
}

function CardSupervision({ s }: { s: Supervision }) {
  const [abierto, setAbierto] = useState(false)
  const checklist = s.checklist_json ?? {}
  const items = Object.entries(checklist) as [string, boolean][]

  return (
    <div className={cn(
      "rounded-xl border bg-white overflow-hidden",
      s.estado === "ok" ? "border-green-200" : "border-amber-200"
    )}>
      <button
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-start gap-3 p-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          s.estado === "ok" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
        )}>
          {s.estado === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{s.supervisor_nombre}</span>
            <span className="text-xs text-gray-400">{fechaLarga(s.timestamp)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
            <MapPin size={11} className="text-gray-300" />
            {s.punto_nombre}
            {s.fotos.length > 0 && (
              <span className="ml-1 text-gray-400">· {s.fotos.length} foto{s.fotos.length > 1 ? "s" : ""}</span>
            )}
          </div>
          {s.observaciones && !abierto && (
            <p className="text-xs text-gray-500 mt-1.5 line-clamp-1">{s.observaciones}</p>
          )}
        </div>

        <ChevronDown size={16} className={cn("text-gray-300 shrink-0 mt-1 transition-transform", abierto && "rotate-180")} />
      </button>

      {abierto && (
        <div className="border-t border-gray-100 px-3.5 py-3 space-y-3 bg-gray-50/50">
          {items.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {items.map(([key, ok]) => (
                <span
                  key={key}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5",
                    ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                  )}
                >
                  {ok ? "✓" : "✗"} {CHECKLIST_LABELS[key] ?? key}
                </span>
              ))}
            </div>
          )}

          {s.observaciones && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">OBSERVACIONES</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.observaciones}</p>
            </div>
          )}

          {s.fotos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">FOTOS</p>
              <div className="flex gap-2 flex-wrap">
                {s.fotos.map((f, i) => (
                  <a key={i} href={f} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f}
                      alt={`Foto ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function HistorialSupervisiones({ puntos }: Props) {
  const [supervisiones, setSupervisiones] = useState<Supervision[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroPunto, setFiltroPunto] = useState<string>("")

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ limit: "100" })
      if (filtroPunto) qs.set("punto_id", filtroPunto)
      const res = await fetch(`/api/supervisiones?${qs}`)
      if (res.ok) {
        const data = await res.json() as { supervisiones: Supervision[] }
        setSupervisiones(data.supervisiones)
      }
    } finally {
      setLoading(false)
    }
  }, [filtroPunto])

  useEffect(() => { void cargar() }, [cargar])

  const conNovedad = supervisiones.filter(s => s.estado === "novedad").length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={18} className="text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Historial de rondas</h2>
          {!loading && supervisiones.length > 0 && (
            <span className="text-xs text-gray-400">
              {supervisiones.length} ronda{supervisiones.length > 1 ? "s" : ""}
              {conNovedad > 0 && ` · ${conNovedad} con novedad`}
            </span>
          )}
        </div>

        <select
          value={filtroPunto}
          onChange={(e) => setFiltroPunto(e.target.value)}
          className="h-8 px-2.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">Todos los servicios</option>
          {puntos.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="text-gray-300 animate-spin" />
        </div>
      ) : supervisiones.length === 0 ? (
        <div className="text-center py-14 text-gray-400 bg-white rounded-xl border border-gray-200">
          <ClipboardCheck size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Todavía no hay rondas registradas</p>
          <p className="text-xs text-gray-300 mt-1">
            Aparecen acá cuando un supervisor escanea un QR
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {supervisiones.map(s => <CardSupervision key={s.id} s={s} />)}
        </div>
      )}
    </div>
  )
}
