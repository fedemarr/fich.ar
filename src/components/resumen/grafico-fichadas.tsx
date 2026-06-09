"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { DatoGrafico } from "@/types"

interface GraficoFichadasProps {
  datos: DatoGrafico[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}hs</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "ingresos" ? "Entradas" : "Salidas"}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export function GraficoFichadas({ datos }: GraficoFichadasProps) {
  if (datos.every((d) => d.ingresos === 0 && d.salidas === 0)) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Sin fichadas registradas hoy
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={datos} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis
          dataKey="hora"
          tick={{ fontSize: 11, fill: "#9CA3AF" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => `${v}h`}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9CA3AF" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F9FAFB" }} />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs text-gray-500">
              {value === "ingresos" ? "Entradas" : "Salidas"}
            </span>
          )}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="ingresos" fill="#E8593C" radius={[3, 3, 0, 0]} maxBarSize={20} />
        <Bar dataKey="salidas" fill="#D04828" radius={[3, 3, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}
