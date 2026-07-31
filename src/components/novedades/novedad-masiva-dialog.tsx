"use client"

import { useState, useMemo } from "react"
import { CalendarCheck, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ETIQUETAS_NOVEDAD } from "@/types"
import { toast } from "sonner"
import type { Colaborador, TipoNovedad } from "@/generated/prisma/client"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  colaboradores: Colaborador[]
  puntos: { id: string; nombre: string }[]
  puntoPorColabId: Record<string, { id: string; nombre: string }>
}

function generarFechasRango(desde: string, hasta: string): string[] {
  if (!desde) return []
  const fechas: string[] = []
  const start = new Date(desde + "T12:00:00Z")
  const end = hasta ? new Date(hasta + "T12:00:00Z") : start
  if (end < start) return [desde]
  const cur = new Date(start)
  while (cur <= end && fechas.length < 62) {
    fechas.push(cur.toISOString().split("T")[0])
    cur.setDate(cur.getDate() + 1)
  }
  return fechas
}

function Checkbox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
        checked ? "bg-[#2563EB] border-[#2563EB]" : "border-gray-300 hover:border-[#2563EB]"
      }`}
    >
      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
    </button>
  )
}

export function NovedadMasivaDialog({ open, onClose, onSuccess, colaboradores, puntos, puntoPorColabId }: Props) {
  const [tipo, setTipo] = useState<TipoNovedad>("FE")
  const [esRango, setEsRango] = useState(false)
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [filtroPunto, setFiltroPunto] = useState("")
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [aplicando, setAplicando] = useState(false)

  const activos = useMemo(
    () => colaboradores.filter((c) => c.estado === "ACTIVO"),
    [colaboradores]
  )

  const filtrados = useMemo(() => {
    if (!filtroPunto) return activos
    return activos.filter((c) => puntoPorColabId[c.id]?.id === filtroPunto)
  }, [activos, filtroPunto, puntoPorColabId])

  const todosSeleccionados = filtrados.length > 0 && filtrados.every((c) => seleccionados.has(c.id))
  const algunoSeleccionado = filtrados.some((c) => seleccionados.has(c.id))

  function toggleTodos() {
    const next = new Set(seleccionados)
    if (todosSeleccionados) {
      filtrados.forEach((c) => next.delete(c.id))
    } else {
      filtrados.forEach((c) => next.add(c.id))
    }
    setSeleccionados(next)
  }

  function toggleUno(id: string) {
    const next = new Set(seleccionados)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSeleccionados(next)
  }

  const fechas = useMemo(
    () => generarFechasRango(fechaDesde, esRango ? fechaHasta : fechaDesde),
    [fechaDesde, fechaHasta, esRango]
  )

  async function aplicar() {
    if (fechas.length === 0) { toast.error("Seleccioná al menos una fecha"); return }
    if (seleccionados.size === 0) { toast.error("Seleccioná al menos un colaborador"); return }
    setAplicando(true)
    try {
      const res = await fetch("/api/novedades/masiva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, fechas, colaborador_ids: Array.from(seleccionados) }),
      })
      const data = await res.json() as { ok?: boolean; creadas?: number; error?: string }
      if (!res.ok || !data.ok) { toast.error(data.error ?? "Error al aplicar"); return }
      const n = data.creadas ?? 0
      toast.success(n === 0 ? "Ya existían todas las novedades" : `${n} novedad${n !== 1 ? "es" : ""} creada${n !== 1 ? "s" : ""}`)
      setSeleccionados(new Set())
      setFechaDesde("")
      setFechaHasta("")
      onSuccess()
    } finally {
      setAplicando(false)
    }
  }

  function handleClose() {
    if (aplicando) return
    setSeleccionados(new Set())
    setFechaDesde("")
    setFechaHasta("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarCheck size={17} className="text-[#2563EB]" />
            Novedad masiva
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Tipo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de novedad</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoNovedad)}
              className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
            >
              {(Object.entries(ETIQUETAS_NOVEDAD) as [TipoNovedad, string][]).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v}</option>
              ))}
            </select>
          </div>

          {/* Fechas */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fechas</label>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={!esRango} onChange={() => setEsRango(false)} className="accent-[#2563EB]" />
                  Una fecha
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={esRango} onChange={() => setEsRango(true)} className="accent-[#2563EB]" />
                  Rango
                </label>
              </div>
            </div>

            {!esRango ? (
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="flex-1 h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
                <span className="text-gray-400 text-sm shrink-0">→</span>
                <input
                  type="date"
                  value={fechaHasta}
                  min={fechaDesde}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="flex-1 h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            )}

            {fechas.length > 0 && (
              <p className="text-xs text-[#2563EB] font-medium">
                {fechas.length} día{fechas.length !== 1 ? "s" : ""} seleccionado{fechas.length !== 1 ? "s" : ""}
                {fechas.length <= 5 && ` (${fechas.map(f => f.split("-")[2]).join(", ")})`}
              </p>
            )}
          </div>

          {/* Colaboradores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Colaboradores
                {seleccionados.size > 0 && (
                  <span className="ml-1.5 text-[#2563EB] font-bold">{seleccionados.size} seleccionado{seleccionados.size !== 1 ? "s" : ""}</span>
                )}
              </label>
              {puntos.length > 0 && (
                <select
                  value={filtroPunto}
                  onChange={(e) => setFiltroPunto(e.target.value)}
                  className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white focus:outline-none"
                >
                  <option value="">Todos los puntos</option>
                  {puntos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={toggleTodos}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  todosSeleccionados
                    ? "bg-[#2563EB] border-[#2563EB]"
                    : algunoSeleccionado
                    ? "bg-[#2563EB]/30 border-[#2563EB]"
                    : "border-gray-300"
                }`}>
                  {(todosSeleccionados || algunoSeleccionado) && (
                    <span className="block w-2 h-0.5 bg-white rounded" />
                  )}
                  {todosSeleccionados && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs font-semibold text-gray-600">
                  {todosSeleccionados ? "Deseleccionar todos" : `Seleccionar todos (${filtrados.length})`}
                </span>
              </button>

              <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                {filtrados.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Sin colaboradores</p>
                ) : (
                  filtrados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleUno(c.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Checkbox checked={seleccionados.has(c.id)} onClick={() => toggleUno(c.id)} />
                      <span className="text-sm text-gray-700 truncate flex-1">{c.apellido} {c.nombre}</span>
                      {puntoPorColabId[c.id] && (
                        <span className="text-xs text-gray-400 shrink-0">{puntoPorColabId[c.id].nombre}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-4 border-t border-gray-100 gap-2">
          <Button variant="outline" onClick={handleClose} disabled={aplicando}>
            Cancelar
          </Button>
          <Button
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            onClick={aplicar}
            disabled={aplicando || seleccionados.size === 0 || fechas.length === 0}
          >
            {aplicando
              ? "Aplicando…"
              : `Aplicar a ${seleccionados.size} colaborador${seleccionados.size !== 1 ? "es" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
