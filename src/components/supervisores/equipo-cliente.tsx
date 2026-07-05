"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, XCircle, FileText, RefreshCw, MapPin } from "lucide-react"

interface ColaboradorEquipo {
  id: string
  nombre: string
  apellido: string
  sector: string | null
  jornada: string | null
  punto: string | null
  estado: "presente" | "ausente" | "novedad" | "sin_registro"
  entrada: string | null
  salida: string | null
  analisisEntrada: string | null
  novedad: { tipo: string; observacion: string | null } | null
}

const LABELS_NOVEDAD: Record<string, string> = {
  AU: "Ausente", VAC: "Vacaciones", EN: "Enfermedad", FR: "Franco",
  FE: "Feriado", HDO: "Horas por deber", C: "Capacitación",
  DES: "Descanso", VIR: "Virtual", P: "Presente", PT: "Tarde", ST: "Salida tarde",
}

function EstadoBadge({ estado }: { estado: ColaboradorEquipo["estado"] }) {
  if (estado === "presente") return (
    <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
      <CheckCircle2 size={11} /> Presente
    </Badge>
  )
  if (estado === "novedad") return (
    <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs">
      <FileText size={11} /> Novedad
    </Badge>
  )
  if (estado === "ausente") return (
    <Badge className="bg-red-50 text-red-700 border-red-200 gap-1 text-xs">
      <XCircle size={11} /> Ausente
    </Badge>
  )
  return (
    <Badge className="bg-gray-100 text-gray-500 border-gray-200 gap-1 text-xs">
      <Clock size={11} /> Sin registro
    </Badge>
  )
}

export function EquipoCliente() {
  const [colaboradores, setColaboradores] = useState<ColaboradorEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  const cargar = useCallback(async (manual = false) => {
    if (manual) setFetching(true)
    else setLoading(true)
    const res = await fetch("/api/supervisores/equipo")
    if (res.ok) setColaboradores(await res.json())
    setLoading(false)
    setFetching(false)
  }, [])

  useEffect(() => {
    cargar()
    const interval = setInterval(() => cargar(), 30000)
    return () => clearInterval(interval)
  }, [cargar])

  const presentes = colaboradores.filter((c) => c.estado === "presente").length
  const ausentes = colaboradores.filter((c) => c.estado === "ausente").length
  const novedades = colaboradores.filter((c) => c.estado === "novedad").length

  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi equipo</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{today}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => cargar(true)} disabled={fetching} className="gap-2">
          <RefreshCw size={14} className={fetching ? "animate-spin" : ""} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{presentes}</p>
          <p className="text-xs text-gray-500 mt-1">Presentes</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-red-500">{ausentes}</p>
          <p className="text-xs text-gray-500 mt-1">Ausentes</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{novedades}</p>
          <p className="text-xs text-gray-500 mt-1">Con novedad</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando equipo...</div>
      ) : colaboradores.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No hay colaboradores asignados a tus puntos</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Colaborador</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Punto / Jornada</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entrada</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Salida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colaboradores.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.apellido}, {c.nombre}</p>
                    {c.sector && <p className="text-xs text-gray-400">{c.sector}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {c.punto && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <MapPin size={10} /> {c.punto}
                      </span>
                    )}
                    {c.jornada && <p className="text-xs text-gray-400 mt-0.5">{c.jornada}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={c.estado} />
                    {c.novedad && (
                      <p className="text-xs text-gray-400 mt-1">
                        {LABELS_NOVEDAD[c.novedad.tipo] ?? c.novedad.tipo}
                        {c.novedad.observacion && ` — ${c.novedad.observacion}`}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.entrada ? (
                      <span className={`font-medium ${c.analisisEntrada === "LLEGADA_TARDE" ? "text-orange-600" : "text-gray-900"}`}>
                        {c.entrada}
                        {c.analisisEntrada === "LLEGADA_TARDE" && (
                          <span className="ml-1 text-xs text-orange-500">tarde</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.salida ? (
                      <span className="font-medium text-gray-900">{c.salida}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
