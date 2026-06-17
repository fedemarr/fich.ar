"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Download, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ETIQUETAS_NOVEDAD } from "@/types"
import { toast } from "sonner"
import type { Colaborador, Novedad, TipoNovedad } from "@/generated/prisma/client"

type NovedadConColaborador = Novedad & { colaborador: Colaborador }

interface CalendarioNovedadesProps {
  colaboradores: Colaborador[]
  novedadesMes: NovedadConColaborador[]
  presenciasMes: Set<string>
  mes: number
  anio: number
  onCambiarMes: (mes: number, anio: number) => void
  onCeldaClick: (colaborador: Colaborador, dia: number) => void
}

const COLORES_BG: Record<TipoNovedad, string> = {
  P:   "bg-white text-gray-700",
  PT:  "bg-amber-100 text-amber-800",
  AU:  "bg-red-500 text-white",
  VAC: "bg-blue-400 text-white",
  EN:  "bg-orange-400 text-white",
  FR:  "bg-sky-300 text-sky-900",
  FE:  "bg-gray-300 text-gray-700",
  HDO: "bg-green-500 text-white",
  C:   "bg-cyan-400 text-white",
  DES: "bg-slate-300 text-slate-800",
  VIR: "bg-purple-300 text-purple-900",
}

const NOMBRES_MES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

function diasEnMes(mes: number, anio: number) {
  return new Date(anio, mes, 0).getDate()
}

function exportarExcel(
  colaboradores: Colaborador[],
  novedadesMes: NovedadConColaborador[],
  mes: number,
  anio: number
) {
  const dias = diasEnMes(mes, anio)
  // Build map
  const mapa: Record<string, Record<number, TipoNovedad>> = {}
  for (const n of novedadesMes) {
    const dia = new Date(n.fecha).getUTCDate()
    if (!mapa[n.colaborador_id]) mapa[n.colaborador_id] = {}
    mapa[n.colaborador_id][dia] = n.tipo
  }

  const headers = ["Colaborador", "Legajo", ...Array.from({ length: dias }, (_, i) => String(i + 1))]
  const rows = colaboradores.map((c) => {
    const fila: string[] = [`${c.apellido}, ${c.nombre}`, c.legajo ?? "N/A"]
    for (let d = 1; d <= dias; d++) {
      fila.push(mapa[c.id]?.[d] ?? "")
    }
    return fila
  })

  // Create CSV
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n")

  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `novedades-${NOMBRES_MES[mes - 1].toLowerCase()}-${anio}.csv`
  link.click()
  URL.revokeObjectURL(url)
  toast.success("Reporte exportado")
}

export function CalendarioNovedades({
  colaboradores,
  novedadesMes,
  presenciasMes,
  mes,
  anio,
  onCambiarMes,
  onCeldaClick,
}: CalendarioNovedadesProps) {
  const [mostrarRefs, setMostrarRefs] = useState(false)
  const [filtroBusqueda, setFiltroBusqueda] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")

  const dias = diasEnMes(mes, anio)
  const hoy = new Date()
  const esHoy = (dia: number) =>
    dia === hoy.getDate() && mes === hoy.getMonth() + 1 && anio === hoy.getFullYear()
  const esFuturo = (dia: number) => new Date(anio, mes - 1, dia) > hoy

  // Build lookup map: colaborador_id -> { dia: tipo }
  const mapa: Record<string, Record<number, TipoNovedad>> = {}
  for (const n of novedadesMes) {
    const dia = new Date(n.fecha).getUTCDate()
    if (!mapa[n.colaborador_id]) mapa[n.colaborador_id] = {}
    mapa[n.colaborador_id][dia] = n.tipo
  }

  const colaboradoresFiltrados = colaboradores.filter((c) => {
    const texto = `${c.apellido} ${c.nombre}`.toLowerCase()
    if (filtroBusqueda && !texto.includes(filtroBusqueda.toLowerCase())) return false
    if (filtroTipo) {
      const novedadesColab = mapa[c.id] ?? {}
      if (!Object.values(novedadesColab).includes(filtroTipo as TipoNovedad)) return false
    }
    return true
  })

  function navegarMes(delta: number) {
    let nuevoMes = mes + delta
    let nuevoAnio = anio
    if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio++ }
    if (nuevoMes < 1) { nuevoMes = 12; nuevoAnio-- }
    onCambiarMes(nuevoMes, nuevoAnio)
  }

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar colaborador..."
          value={filtroBusqueda}
          onChange={(e) => setFiltroBusqueda(e.target.value)}
          className="h-9 text-sm px-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 w-52"
        />

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="h-9 text-sm px-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
        >
          <option value="">Todos</option>
          {(Object.entries(ETIQUETAS_NOVEDAD) as [TipoNovedad, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <button
          onClick={() => setMostrarRefs((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-[#2563EB] hover:underline"
        >
          <Info size={14} />
          Referencias
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navegarMes(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
            {NOMBRES_MES[mes - 1]} {anio}
          </span>
          <button
            onClick={() => navegarMes(1)}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Referencias */}
      {mostrarRefs && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold bg-green-50 text-green-600 border border-green-200">
                P
              </span>
              <span className="text-xs text-gray-600">Presente (fichada)</span>
            </div>
            {(Object.entries(ETIQUETAS_NOVEDAD) as [TipoNovedad, string][]).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${COLORES_BG[k]}`}>
                  {k}
                </span>
                <span className="text-xs text-gray-600">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendario */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: `${200 + dias * 36}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 z-10 bg-gray-50 text-left text-xs font-medium text-gray-500 px-4 py-2.5 min-w-[200px] border-r border-gray-200">
                  Colaborador
                </th>
                <th className="text-xs font-medium text-gray-500 px-2 py-2.5 min-w-[60px] border-r border-gray-200">
                  Legajo
                </th>
                {Array.from({ length: dias }, (_, i) => i + 1).map((dia) => (
                  <th
                    key={dia}
                    className={`text-xs font-medium px-1 py-2.5 w-9 text-center ${
                      esHoy(dia) ? "text-[#2563EB] bg-[#EFF6FF]" : "text-gray-500"
                    }`}
                  >
                    {dia}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colaboradoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={dias + 2} className="text-center text-sm text-gray-400 py-12">
                    Sin colaboradores
                  </td>
                </tr>
              ) : (
                colaboradoresFiltrados.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white px-4 py-1.5 border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                          {(c.nombre[0] ?? "") + (c.apellido[0] ?? "")}
                        </div>
                        <span className="text-xs font-medium text-gray-800 truncate max-w-[140px]">
                          {c.apellido} {c.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs text-gray-400 px-2 py-1.5 text-center border-r border-gray-200">
                      {c.legajo ?? "N/A"}
                    </td>
                    {Array.from({ length: dias }, (_, i) => i + 1).map((dia) => {
                      const tipo = mapa[c.id]?.[dia]
                      const presente = presenciasMes.has(`${c.id}|${dia}`)
                      return (
                        <td key={dia} className="p-0.5">
                          {tipo ? (
                            <button
                              onClick={() => onCeldaClick(c, dia)}
                              className={`w-full h-7 rounded text-xs font-bold transition-opacity hover:opacity-80 ${COLORES_BG[tipo]}`}
                              title={ETIQUETAS_NOVEDAD[tipo]}
                            >
                              {tipo}
                            </button>
                          ) : esFuturo(dia) ? (
                            <div className="w-full h-7 rounded bg-gray-50" />
                          ) : presente ? (
                            <button
                              onClick={() => onCeldaClick(c, dia)}
                              className="w-full h-7 rounded bg-green-50 hover:bg-green-100 transition-colors border border-green-200"
                              title="Presente — click para agregar novedad"
                            >
                              <span className="text-xs font-bold text-green-600">P</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onCeldaClick(c, dia)}
                              className="w-full h-7 rounded bg-white hover:bg-[#EFF6FF] transition-colors relative overflow-hidden border border-gray-100"
                              title="Agregar novedad"
                            >
                              <span
                                className="absolute bottom-0 right-0 w-0 h-0"
                                style={{
                                  borderStyle: "solid",
                                  borderWidth: "0 0 8px 8px",
                                  borderColor: "transparent transparent #F59E0B transparent",
                                }}
                              />
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-[#2563EB] border-[#2563EB] hover:bg-[#EFF6FF]"
          onClick={() => exportarExcel(colaboradores, novedadesMes, mes, anio)}
        >
          <Download size={14} />
          Exportar reporte a Excel
        </Button>
      </div>
    </div>
  )
}
