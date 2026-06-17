"use client"

import { useState } from "react"

interface AsignacionMensual {
  id: string
  servicio_nombre: string
  nro_socio: string | null
  categoria: string | null
  total_horas: number | null
  colaborador: { id: string; nombre: string; apellido: string; legajo: string | null }
}

interface Props {
  asignaciones: AsignacionMensual[]
  mes: number
  anio: number
}

const MESES_DIAS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function diasEnMes(mes: number, anio: number): number {
  if (mes === 2 && ((anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0)) return 29
  return MESES_DIAS[mes - 1]
}

function celda(val: unknown): string {
  if (val === null || val === undefined) return ""
  if (Number(val) === 0) return "F"
  return String(val)
}

function claseCelda(val: unknown): string {
  if (val === null || val === undefined) return "text-gray-200"
  if (Number(val) === 0) return "text-gray-400 font-medium"
  return "text-gray-700"
}

export function TablaProyeccion({ asignaciones, mes, anio }: Props) {
  const [servicioFiltro, setServicioFiltro] = useState("")
  const dias = diasEnMes(mes, anio)

  const servicios = Array.from(new Set(asignaciones.map((a) => a.servicio_nombre))).sort()

  const filtradas = servicioFiltro
    ? asignaciones.filter((a) => a.servicio_nombre === servicioFiltro)
    : asignaciones

  const hoy = new Date().getDate()
  const mesActual = new Date().getMonth() + 1
  const anioActual = new Date().getFullYear()
  const esEsteMes = mes === mesActual && anio === anioActual

  return (
    <div className="space-y-3">
      {/* Filtro por servicio */}
      {servicios.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setServicioFiltro("")}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !servicioFiltro
                ? "bg-[#2563EB] text-white border-[#2563EB]"
                : "border-gray-200 text-gray-600 hover:border-[#2563EB]"
            }`}
          >
            Todos
          </button>
          {servicios.map((s) => (
            <button
              key={s}
              onClick={() => setServicioFiltro(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                servicioFiltro === s
                  ? "bg-[#2563EB] text-white border-[#2563EB]"
                  : "border-gray-200 text-gray-600 hover:border-[#2563EB]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="text-xs w-full">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Legajo</th>
              <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Colaborador</th>
              <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Servicio</th>
              <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Cat.</th>
              {Array.from({ length: dias }, (_, i) => i + 1).map((d) => (
                <th
                  key={d}
                  className={`px-1.5 py-2 font-medium text-center w-6 ${
                    esEsteMes && d === hoy ? "bg-blue-100 text-[#2563EB]" : "text-gray-400"
                  }`}
                >
                  {d}
                </th>
              ))}
              <th className="text-right px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Hs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtradas.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 text-gray-400">{a.nro_socio ?? a.colaborador.legajo ?? "—"}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-gray-700">
                  {a.colaborador.apellido} {a.colaborador.nombre}
                </td>
                <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap max-w-[120px] truncate">
                  {a.servicio_nombre}
                </td>
                <td className="px-3 py-1.5 text-gray-400">{a.categoria ?? "—"}</td>
                {Array.from({ length: dias }, (_, i) => i + 1).map((d) => {
                  const key = `dia_${String(d).padStart(2, "0")}`
                  const val = (a as unknown as Record<string, unknown>)[key]
                  return (
                    <td
                      key={d}
                      className={`px-1.5 py-1.5 text-center w-6 ${claseCelda(val)} ${
                        esEsteMes && d === hoy ? "bg-blue-50" : ""
                      }`}
                    >
                      {celda(val)}
                    </td>
                  )
                })}
                <td className="px-3 py-1.5 text-right font-medium text-gray-700">
                  {a.total_horas ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
