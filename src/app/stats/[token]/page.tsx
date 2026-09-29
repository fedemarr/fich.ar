"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Users, CheckCircle2, Clock, AlertCircle, TrendingUp,
  Loader2, BarChart3, ClipboardCheck, Megaphone,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Totales {
  colaboradores: number
  entradas: number
  tardanzas: number
  ausencias: number
  score_asistencia: number
}

interface PorPunto {
  punto_id: string
  punto_nombre: string
  sede_nombre: string | null
  entradas: number
  tardanzas: number
}

interface OpsStats {
  punto_id: string
  sectores_total: number
  rutinas_completadas: number
  rondas_total: number
  rondas_aprobadas: number
  reclamos_total: number
  reclamos_cerrados: number
}

interface StatsData {
  empresa: { nombre: string; logo_url: string | null }
  periodo: string
  totales: Totales
  por_punto: PorPunto[]
  operaciones: OpsStats[]
  tiene_operaciones: boolean
}

type Periodo = "hoy" | "semana" | "mes"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444"

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <span className="absolute text-lg font-black" style={{ color }}>{score}%</span>
    </div>
  )
}

function StatChip({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: React.ElementType; color: string
}) {
  return (
    <div className={cn("rounded-2xl p-4 flex flex-col gap-1", color)}>
      <Icon size={18} className="opacity-70" />
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-medium opacity-70">{label}</p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<StatsData | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const cargar = useCallback(async (p: Periodo) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stats/${token}?periodo=${p}`)
      if (!res.ok) { setError(true); return }
      setData(await res.json() as StatsData)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void cargar(periodo) }, [periodo, cargar])

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center space-y-2">
        <AlertCircle size={40} className="text-red-400 mx-auto" />
        <p className="text-gray-600 font-medium">Link inválido o expirado</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #E8593C 0%, #D04828 100%)" }}
        className="px-5 pt-10 pb-8 text-white">
        <p className="text-xs font-semibold tracking-widest opacity-70 mb-1">ESTADÍSTICAS</p>
        {data ? (
          <>
            <h1 className="text-2xl font-black">{data.empresa.nombre}</h1>
            <p className="text-white/70 text-sm mt-1">Panel de rendimiento</p>
          </>
        ) : (
          <div className="h-8 w-40 bg-white/20 rounded-lg animate-pulse" />
        )}

        {/* Selector período */}
        <div className="flex gap-1.5 mt-5">
          {(["hoy", "semana", "mes"] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-semibold transition-all capitalize",
                periodo === p ? "bg-white text-[#E8593C]" : "bg-white/20 text-white"
              )}>
              {p === "hoy" ? "Hoy" : p === "semana" ? "7 días" : "Este mes"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-[#E8593C] animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* Score general */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-400 tracking-wider mb-4">RESUMEN GENERAL</p>
              <div className="flex items-center gap-5">
                <ScoreRing score={data.totales.score_asistencia} size={88} />
                <div className="flex-1 space-y-1.5">
                  <p className="font-bold text-gray-800 text-lg">Score de asistencia</p>
                  <p className="text-xs text-gray-400">{data.totales.colaboradores} colaboradores activos</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <StatChip label="Ingresos" value={data.totales.entradas} icon={CheckCircle2} color="bg-emerald-50 text-emerald-700" />
                <StatChip label="Tardanzas" value={data.totales.tardanzas} icon={Clock} color="bg-amber-50 text-amber-700" />
                <StatChip label="Ausencias" value={data.totales.ausencias} icon={AlertCircle} color="bg-red-50 text-red-600" />
              </div>
            </div>

            {/* Por punto/servicio */}
            {data.por_punto.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 tracking-wider px-1">POR SERVICIO</p>
                {data.por_punto.map(p => (
                  <div key={p.punto_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-800">{p.punto_nombre}</p>
                        {p.sede_nombre && <p className="text-xs text-gray-400">{p.sede_nombre}</p>}
                      </div>
                      <BarChart3 size={16} className="text-gray-300 mt-0.5" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-emerald-700">{p.entradas}</p>
                        <p className="text-xs text-emerald-600 font-medium">ingresos</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-amber-700">{p.tardanzas}</p>
                        <p className="text-xs text-amber-600 font-medium">tardanzas</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Operaciones v2 */}
            {data.tiene_operaciones && data.operaciones.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 tracking-wider px-1">LIMPIEZA Y OPERACIONES</p>
                {data.operaciones.map(o => {
                  const pctRutinas = o.sectores_total > 0
                    ? Math.round((o.rutinas_completadas / o.sectores_total) * 100)
                    : 0
                  const pctRondas = o.rondas_total > 0
                    ? Math.round((o.rondas_aprobadas / o.rondas_total) * 100)
                    : null

                  return (
                    <div key={o.punto_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck size={16} className="text-[#E8593C]" />
                        <p className="font-semibold text-gray-800 text-sm">Limpieza</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                          <p className="text-xl font-black text-emerald-700">{pctRutinas}%</p>
                          <p className="text-xs text-emerald-600 font-medium">sectores ok</p>
                        </div>
                        {pctRondas !== null ? (
                          <div className={cn("rounded-xl p-3 text-center", pctRondas >= 80 ? "bg-emerald-50" : "bg-amber-50")}>
                            <p className={cn("text-xl font-black", pctRondas >= 80 ? "text-emerald-700" : "text-amber-700")}>{pctRondas}%</p>
                            <p className={cn("text-xs font-medium", pctRondas >= 80 ? "text-emerald-600" : "text-amber-600")}>inspecciones ok</p>
                          </div>
                        ) : (
                          <div className="bg-gray-50 rounded-xl p-3 text-center">
                            <p className="text-xl font-black text-gray-400">—</p>
                            <p className="text-xs text-gray-400 font-medium">sin rondas</p>
                          </div>
                        )}
                      </div>
                      {o.reclamos_total > 0 && (
                        <div className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Megaphone size={14} className="text-red-500" />
                            <span className="text-sm font-medium text-red-700">Reclamos</span>
                          </div>
                          <span className="text-sm font-black text-red-700">
                            {o.reclamos_cerrados}/{o.reclamos_total} resueltos
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Score combinado */}
            {data.tiene_operaciones && data.operaciones.length > 0 && (
              <div className="bg-gradient-to-br from-[#E8593C] to-[#D04828] rounded-2xl p-5 text-white">
                <div className="flex items-center gap-3">
                  <TrendingUp size={22} />
                  <p className="font-bold text-lg">Score combinado</p>
                </div>
                <div className="mt-4 flex items-end gap-3">
                  {(() => {
                    const pctOps = data.operaciones.reduce((acc, o) => {
                      const p = o.sectores_total > 0 ? (o.rutinas_completadas / o.sectores_total) * 100 : 0
                      return acc + p
                    }, 0) / Math.max(1, data.operaciones.length)
                    const score = Math.round((data.totales.score_asistencia + pctOps) / 2)
                    return (
                      <>
                        <p className="text-5xl font-black">{score}%</p>
                        <p className="text-white/70 text-sm pb-1">
                          {score >= 80 ? "Excelente rendimiento 🏆" : score >= 60 ? "Rendimiento aceptable" : "Requiere atención"}
                        </p>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      <p className="text-center text-xs text-gray-300 pb-8">
        Powered by <span className="font-semibold">Fich.ar</span>
      </p>
    </div>
  )
}
