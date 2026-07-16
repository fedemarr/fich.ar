"use client"

import { useState, useEffect, useCallback } from "react"
import { Coffee, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface DescansoRow {
  id: string
  colaborador_id: string
  colaborador: string
  inicio: string
  fin: string | null
  duracion_min: number | null
  activo: boolean
  inicio_raw: string
  fin_raw: string | null
}

function hoyARG() {
  return new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })
    .split("/").map((p) => p.padStart(2, "0")).reverse().join("-")
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(fecha + "T12:00:00Z")
  d.setDate(d.getDate() + dias)
  return d.toISOString().split("T")[0]
}

export function DescansosCliente() {
  const [fecha, setFecha] = useState(hoyARG())
  const [descansos, setDescansos] = useState<DescansoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  const cargar = useCallback(async (f: string, manual = false) => {
    if (manual) setFetching(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/descansos?fecha=${f}`)
      if (res.ok) setDescansos(await res.json() as DescansoRow[])
    } finally {
      setLoading(false)
      setFetching(false)
    }
  }, [])

  useEffect(() => { void cargar(fecha) }, [cargar, fecha])

  // Auto-refresh cada 30s si viendo hoy
  useEffect(() => {
    if (fecha !== hoyARG()) return
    const iv = setInterval(() => void cargar(fecha), 30000)
    return () => clearInterval(iv)
  }, [cargar, fecha])

  const activos = descansos.filter((d) => d.activo).length
  const finalizados = descansos.filter((d) => !d.activo).length
  const esHoy = fecha === hoyARG()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Coffee size={20} className="text-amber-500" />
        <h1 className="text-xl font-semibold text-gray-900">Descansos</h1>
        <span className="text-sm text-gray-400 ml-1">· 30 min por jornada</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setFecha(sumarDias(fecha, -1))}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-sm font-medium text-gray-700 min-w-[90px] text-center">{formatFecha(fecha)}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={esHoy} onClick={() => setFecha(sumarDias(fecha, 1))}>
            <ChevronRight size={14} />
          </Button>
          {!esHoy && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFecha(hoyARG())}>Hoy</Button>
          )}
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => void cargar(fecha, true)} disabled={fetching}>
            <RefreshCw size={13} className={fetching ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{descansos.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{activos}</p>
          <p className="text-xs text-gray-500 mt-0.5">En descanso</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{finalizados}</p>
          <p className="text-xs text-gray-500 mt-0.5">Finalizados</p>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : descansos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Coffee size={32} className="mx-auto mb-3 opacity-30" />
          <p>Sin descansos registrados para esta fecha</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2">
            {descansos.map((d) => (
              <div key={d.id} className={`bg-white border rounded-xl p-4 space-y-2 ${d.activo ? "border-amber-200 bg-amber-50/30" : "border-gray-200"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 text-sm">{d.colaborador}</p>
                  {d.activo
                    ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">En descanso</Badge>
                    : <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Finalizado</Badge>
                  }
                </div>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span>Inicio: <strong>{d.inicio}</strong></span>
                  {d.fin && <span>Fin: <strong>{d.fin}</strong></span>}
                  {d.duracion_min !== null && <span className="text-gray-400">{d.duracion_min} min</span>}
                  {d.activo && <span className="text-amber-600 text-xs font-medium">En curso...</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Colaborador</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Inicio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fin</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Duración</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {descansos.map((d) => (
                  <tr key={d.id} className={`hover:bg-gray-50 transition-colors ${d.activo ? "bg-amber-50/40" : ""}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{d.colaborador}</td>
                    <td className="px-4 py-3 text-gray-700">{d.inicio}</td>
                    <td className="px-4 py-3 text-gray-700">{d.fin ?? <span className="text-amber-500 font-medium">En curso</span>}</td>
                    <td className="px-4 py-3 text-gray-500">{d.duracion_min !== null ? `${d.duracion_min} min` : "—"}</td>
                    <td className="px-4 py-3">
                      {d.activo
                        ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">En descanso</Badge>
                        : <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Finalizado</Badge>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
