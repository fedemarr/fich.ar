"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Download, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ETIQUETAS_NOVEDAD } from "@/types"
import { toast } from "sonner"
import * as XLSX from "xlsx-js-style"
import type { Colaborador, Novedad, TipoNovedad } from "@/generated/prisma/client"
import type { AnalisisDia } from "@/app/(dashboard)/[slug]/novedades/page"

type NovedadConColaborador = Novedad & { colaborador: Colaborador }

interface CalendarioNovedadesProps {
  colaboradores: Colaborador[]
  novedadesMes: NovedadConColaborador[]
  presenciasMes: Set<string>
  analisisMes: Record<string, AnalisisDia>
  mes: number
  anio: number
  onCambiarMes: (mes: number, anio: number) => void
  onCeldaClick: (colaborador: Colaborador, dia: number) => void
  puntos: { id: string; nombre: string }[]
  puntoPorColabId: Record<string, { id: string; nombre: string }>
  minutosMes: Record<string, number>
}

// Colores por tipo de novedad — paleta similar a Qontact
const COLORES_BG: Record<TipoNovedad, string> = {
  P:   "bg-white text-gray-600 border border-gray-200",
  PT:  "bg-orange-50 text-orange-600 border border-orange-200",
  ST:  "bg-purple-50 text-purple-600 border border-purple-200",
  AU:  "bg-red-700 text-white",
  VAC: "bg-amber-300 text-amber-900",
  EN:  "bg-orange-400 text-white",
  FR:  "bg-rose-200 text-rose-700",
  FE:  "bg-violet-100 text-violet-600",
  HDO: "bg-green-500 text-white",
  C:   "bg-cyan-400 text-white",
  DES: "bg-slate-200 text-slate-600",
  VIR: "bg-purple-100 text-purple-600 border border-purple-200",
}

// Colores XLSX (fgColor en hex sin #) por tipo de novedad
const COLORES_XLSX: Record<string, string> = {
  P:        "F0FDF4", // green-50
  "P-S":    "DCFCE7", // green-100
  "P-T":    "FFF7ED", // orange-50
  "PT-S":   "FFF7ED",
  "P--ST":  "FAF5FF", // purple-50
  "P--STP": "FEFCE8", // yellow-50
  "PT--ST": "FEE2E2", // red-100
  "PT--STP":"FFEDD5", // orange-100
  AU:       "B91C1C", // red-700
  VAC:      "FCD34D", // amber-300
  EN:       "FB923C", // orange-400
  FR:       "FECDD3", // rose-200
  FE:       "EDE9FE", // violet-100
  HDO:      "22C55E", // green-500
  C:        "22D3EE", // cyan-400
  DES:      "E2E8F0", // slate-200
  VIR:      "F3E8FF", // purple-100
  ST:       "FAF5FF",
}

// Etiqueta visible en la celda (más corta para el grid)
const LABEL_CELDA: Partial<Record<TipoNovedad, string>> = {
  PT: "P-T",
  ST: "S-T",
  VIR: "VIR",
  HDO: "HDO",
  DES: "DES",
}

const NOMBRES_MES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

function diasEnMes(mes: number, anio: number) {
  return new Date(anio, mes, 0).getDate()
}

// Combina el estado de entrada (P / PT) con el de salida para mostrar la etiqueta compuesta
function badgeEntradaSalida(
  entradaTarde: boolean,
  analisis?: AnalisisDia
): { label: string; cls: string } {
  const salidaTarde = analisis?.salidaTarde ?? false
  const salidaTemprana = analisis?.anticipada ?? false
  const salidaNormal = analisis?.salidaNormal ?? false

  if (!entradaTarde) {
    if (salidaTarde)    return { label: "P--ST",  cls: "bg-purple-50 text-purple-700 border border-purple-200" }
    if (salidaTemprana) return { label: "P--STP", cls: "bg-yellow-50 text-yellow-700 border border-yellow-200" }
    if (salidaNormal)   return { label: "P-S",    cls: "bg-green-100 text-green-700 border border-green-300" }
    return { label: "P", cls: "bg-green-50 text-green-600 border border-green-200" }
  } else {
    if (salidaTarde)    return { label: "PT--ST",  cls: "bg-red-100 text-red-700 border border-red-300" }
    if (salidaTemprana) return { label: "PT--STP", cls: "bg-orange-100 text-orange-700 border border-orange-300" }
    if (salidaNormal)   return { label: "PT-S",    cls: "bg-orange-50 text-orange-500 border border-orange-200" }
    return { label: "P-T", cls: "bg-orange-50 text-orange-600 border border-orange-200" }
  }
}

function labelFontSize(label: string): string {
  const n = label.length
  if (n <= 2) return "11px"
  if (n <= 4) return "10px"
  if (n <= 6) return "9px"
  return "8px"
}

function minutosAHHMM(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${h}h ${String(m).padStart(2, "0")}m`
}

function xlsxCell(value: string, bgHex: string): XLSX.CellObject {
  const dark = ["B91C1C","FB923C","22C55E","22D3EE"].includes(bgHex)
  return {
    v: value,
    t: "s",
    s: {
      fill: { patternType: "solid", fgColor: { rgb: bgHex } },
      font: { bold: true, sz: 8, color: { rgb: dark ? "FFFFFF" : "1F2937" } },
      alignment: { horizontal: "center", vertical: "center" },
    },
  }
}

function exportarExcel(
  colaboradores: Colaborador[],
  novedadesMes: NovedadConColaborador[],
  presenciasMes: Set<string>,
  analisisMes: Record<string, AnalisisDia>,
  mes: number,
  anio: number,
  puntoPorColabId: Record<string, { id: string; nombre: string }>,
  minutosMes: Record<string, number>
) {
  const dias = diasEnMes(mes, anio)
  const mapa: Record<string, Record<number, TipoNovedad>> = {}
  for (const n of novedadesMes) {
    const dia = new Date(n.fecha).getUTCDate()
    if (!mapa[n.colaborador_id]) mapa[n.colaborador_id] = {}
    mapa[n.colaborador_id][dia] = n.tipo
  }

  const headerRow: XLSX.CellObject[] = [
    { v: "Colaborador", t: "s", s: { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } } },
    { v: "Legajo",      t: "s", s: { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } } },
    { v: "Punto QR",    t: "s", s: { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } } } },
    ...Array.from({ length: dias }, (_, i) => ({
      v: String(i + 1),
      t: "s" as const,
      s: { font: { bold: true }, fill: { patternType: "solid" as const, fgColor: { rgb: "F3F4F6" } }, alignment: { horizontal: "center" as const } },
    })),
    ...(["P","PT","P-S","P--ST","P--STP","AU","Horas"].map((h) => ({
      v: h,
      t: "s" as const,
      s: { font: { bold: true }, fill: { patternType: "solid" as const, fgColor: { rgb: "F3F4F6" } }, alignment: { horizontal: "center" as const } },
    }))),
  ]

  const dataRows: XLSX.CellObject[][] = colaboradores.map((c) => {
    const puntoNombre = puntoPorColabId[c.id]?.nombre ?? "—"
    const fila: XLSX.CellObject[] = [
      { v: `${c.apellido}, ${c.nombre}`, t: "s" },
      { v: c.legajo ?? "N/A", t: "s" },
      { v: puntoNombre, t: "s" },
    ]
    let totalP = 0, totalPT = 0, totalPS = 0, totalST = 0, totalSTP = 0, totalAU = 0

    for (let d = 1; d <= dias; d++) {
      const novedad = mapa[c.id]?.[d]
      const key = `${c.id}|${d}`
      const analisis = analisisMes[key]

      if (novedad) {
        if (novedad === "P" || novedad === "PT") {
          const badge = badgeEntradaSalida(novedad === "PT", analisis)
          const bg = COLORES_XLSX[badge.label] ?? "FFFFFF"
          fila.push(xlsxCell(badge.label, bg))
          if (badge.label.includes("STP")) totalSTP++
          else if (badge.label.includes("ST")) totalST++
          else if (badge.label.includes("-S")) totalPS++
          else if (novedad === "PT") totalPT++
          else totalP++
        } else {
          const label = LABEL_CELDA[novedad] ?? novedad
          const bg = COLORES_XLSX[novedad] ?? "FFFFFF"
          fila.push(xlsxCell(label, bg))
          if (novedad === "AU") totalAU++
        }
      } else if (presenciasMes.has(key)) {
        const badge = badgeEntradaSalida(analisis?.tarde ?? false, analisis)
        const bg = COLORES_XLSX[badge.label] ?? "FFFFFF"
        fila.push(xlsxCell(badge.label, bg))
        if (badge.label.includes("STP")) totalSTP++
        else if (badge.label.includes("ST")) totalST++
        else if (badge.label.includes("-S")) totalPS++
        else if (analisis?.tarde) totalPT++
        else totalP++
      } else {
        fila.push({ v: "", t: "s" })
      }
    }

    const mins = minutosMes[c.id] ?? 0
    fila.push(
      { v: totalP,   t: "n", s: { alignment: { horizontal: "center" } } },
      { v: totalPT,  t: "n", s: { alignment: { horizontal: "center" } } },
      { v: totalPS,  t: "n", s: { alignment: { horizontal: "center" } } },
      { v: totalST,  t: "n", s: { alignment: { horizontal: "center" } } },
      { v: totalSTP, t: "n", s: { alignment: { horizontal: "center" } } },
      { v: totalAU,  t: "n", s: { alignment: { horizontal: "center" } } },
      { v: mins > 0 ? minutosAHHMM(mins) : "—", t: "s", s: { alignment: { horizontal: "center" } } },
    )
    return fila
  })

  const ws = XLSX.utils.aoa_to_sheet([[]])
  XLSX.utils.sheet_add_aoa(ws, [[...headerRow.map((c) => c.v)]], { origin: "A1" })

  // Escribir celdas con estilo manualmente
  const allRows = [headerRow, ...dataRows]
  allRows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
      ws[addr] = cell
    })
  })

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: allRows.length - 1, c: headerRow.length - 1 } })

  // Ancho de columnas
  ws["!cols"] = [
    { wch: 28 }, // Colaborador
    { wch: 8 },  // Legajo
    { wch: 18 }, // Punto QR
    ...Array(dias).fill({ wch: 6 }),
    { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 6 }, { wch: 7 }, { wch: 5 }, { wch: 9 }, // totales + horas
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, NOMBRES_MES[mes - 1])
  XLSX.writeFile(wb, `novedades-${NOMBRES_MES[mes - 1].toLowerCase()}-${anio}.xlsx`)
  toast.success("Reporte exportado")
}

export function CalendarioNovedades({
  colaboradores,
  novedadesMes,
  presenciasMes,
  analisisMes,
  mes,
  anio,
  onCambiarMes,
  onCeldaClick,
  puntos,
  puntoPorColabId,
  minutosMes,
}: CalendarioNovedadesProps) {
  const [mostrarRefs, setMostrarRefs] = useState(false)
  const [filtroBusqueda, setFiltroBusqueda] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroPunto, setFiltroPunto] = useState("")

  const dias = diasEnMes(mes, anio)
  const hoy = new Date()
  const esHoy = (dia: number) =>
    dia === hoy.getDate() && mes === hoy.getMonth() + 1 && anio === hoy.getFullYear()
  const esFuturo = (dia: number) => new Date(anio, mes - 1, dia) > hoy

  // Lookup: colaborador_id -> { dia: tipo }
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
    if (filtroPunto && puntoPorColabId[c.id]?.id !== filtroPunto) return false
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

        {puntos.length > 0 && (
          <select
            value={filtroPunto}
            onChange={(e) => setFiltroPunto(e.target.value)}
            className="h-9 text-sm px-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
          >
            <option value="">Todos los puntos</option>
            {puntos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        )}

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
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Fichadas automáticas</p>
          <div className="flex flex-wrap gap-2">
            {([
              { label: "P",      cls: "bg-green-50 text-green-600 border border-green-200",    desc: "Presente (sin salida aún)" },
              { label: "P-S",    cls: "bg-green-100 text-green-700 border border-green-300",   desc: "Jornada completa a tiempo" },
              { label: "P-T",    cls: "bg-orange-50 text-orange-600 border border-orange-200", desc: "Llegada tarde" },
              { label: "PT-S",   cls: "bg-orange-50 text-orange-500 border border-orange-200", desc: "Llegada tarde + salida a tiempo" },
              { label: "P--ST",  cls: "bg-purple-50 text-purple-700 border border-purple-200", desc: "Salida tarde" },
              { label: "P--STP", cls: "bg-yellow-50 text-yellow-700 border border-yellow-200", desc: "Salida temprana" },
              { label: "PT--ST", cls: "bg-red-100 text-red-700 border border-red-300",         desc: "Llegada tarde + salida tarde" },
              { label: "PT--STP",cls: "bg-orange-100 text-orange-700 border border-orange-300",desc: "Llegada tarde + salida temprana" },
            ] as { label: string; cls: string; desc: string }[]).map(({ label, cls, desc }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`inline-flex items-center justify-center rounded font-bold ${cls}`}
                  style={{ fontSize: labelFontSize(label), width: "40px", height: "24px" }}>
                  {label}
                </span>
                <span className="text-xs text-gray-600">{desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-1">Novedades manuales</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(ETIQUETAS_NOVEDAD) as [TipoNovedad, string][])
              .filter(([k]) => k !== "P" && k !== "PT")
              .map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-xs font-bold ${COLORES_BG[k]}`}>
                    {LABEL_CELDA[k] ?? k}
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
          <table className="w-full border-collapse" style={{ minWidth: `${200 + dias * 38}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 z-10 bg-gray-50 text-left text-xs font-medium text-gray-500 px-4 py-2.5 min-w-[200px] border-r border-gray-200">
                  Colaborador
                </th>
                <th className="text-xs font-medium text-gray-500 px-2 py-2.5 min-w-[52px] border-r border-gray-200">
                  Legajo
                </th>
                {Array.from({ length: dias }, (_, i) => i + 1).map((dia) => (
                  <th
                    key={dia}
                    className={`text-xs font-medium px-0 py-2.5 w-9 text-center ${
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
                  <tr key={c.id} className="hover:bg-gray-50/40">
                    <td className="sticky left-0 z-10 bg-white px-4 py-1 border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                          {(c.nombre[0] ?? "") + (c.apellido[0] ?? "")}
                        </div>
                        <span className="text-xs font-medium text-gray-800 truncate max-w-[140px]">
                          {c.apellido} {c.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs text-gray-400 px-2 py-1 text-center border-r border-gray-200">
                      {c.legajo ?? "—"}
                    </td>
                    {Array.from({ length: dias }, (_, i) => i + 1).map((dia) => {
                      const tipo = mapa[c.id]?.[dia]
                      const key = `${c.id}|${dia}`
                      const presente = presenciasMes.has(key)
                      const analisis = analisisMes[key]

                      // Para P y PT combinamos con análisis de salida; el resto usa el color fijo del tipo
                      const esPT = tipo === "P" || tipo === "PT"
                      const badge = (esPT || (!tipo && presente))
                        ? badgeEntradaSalida(
                            tipo === "PT" || (!tipo && (analisis?.tarde ?? false)),
                            analisis
                          )
                        : null

                      return (
                        <td key={dia} className="p-0.5">
                          {badge ? (
                            <button
                              onClick={() => onCeldaClick(c, dia)}
                              className={`w-full h-7 rounded font-bold transition-opacity hover:opacity-75 ${badge.cls}`}
                              style={{ fontSize: labelFontSize(badge.label) }}
                              title={badge.label}
                            >
                              {badge.label}
                            </button>
                          ) : tipo ? (
                            <button
                              onClick={() => onCeldaClick(c, dia)}
                              className={`w-full h-7 rounded text-xs font-bold transition-opacity hover:opacity-75 ${COLORES_BG[tipo]}`}
                              title={ETIQUETAS_NOVEDAD[tipo]}
                            >
                              {LABEL_CELDA[tipo] ?? tipo}
                            </button>
                          ) : esFuturo(dia) ? (
                            <div className="w-full h-7 rounded bg-gray-50" />
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
                                  borderWidth: "0 0 7px 7px",
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
          onClick={() =>
            exportarExcel(
              colaboradoresFiltrados,
              novedadesMes,
              presenciasMes,
              analisisMes,
              mes,
              anio,
              puntoPorColabId,
              minutosMes
            )
          }
        >
          <Download size={14} />
          Exportar reporte a Excel
        </Button>
      </div>
    </div>
  )
}
