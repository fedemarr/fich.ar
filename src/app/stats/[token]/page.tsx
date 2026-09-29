"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Users, CheckCircle2, Clock, LogOut, TrendingUp,
  Loader2, ClipboardCheck, Sparkles, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsData {
  empresa: { nombre: string; logo_url: string | null }
  periodo: "hoy" | "semana" | "mes"
  avance: { dias_mes: number; dias_transcurridos: number; porcentaje: number }
  totales: {
    colaboradores: number
    entradas: number
    esperadas: number
    tardanzas: number
    anticipadas: number
    score_asistencia: number | null
  }
  actividades: {
    disponible: boolean
    pct_limpieza: number | null
    pct_rondas: number | null
    pct_total: number | null
  }
  combinado: number | null
}

type Periodo = "hoy" | "semana" | "mes"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colorScore(score: number) {
  return score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444"
}

function ScoreRing({ score, size = 108, color }: { score: number | null; size?: number; color?: string }) {
  const r = size / 2 - 9
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.max(0, Math.min(100, score ?? 0)) / 100) * circ
  const c = score === null ? "#D1D5DB" : color ?? colorScore(score)

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black leading-none" style={{ color: c }}>
          {score === null ? "—" : `${score}%`}
        </span>
      </div>
    </div>
  )
}

function StatChip({ label, value, hint, icon: Icon, color }: {
  label: string; value: number | string; hint?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className={cn("rounded-2xl p-3.5 flex flex-col gap-1", color)}>
      <Icon size={16} className="opacity-70" />
      <p className="text-xl font-black leading-none">{value}</p>
      <p className="text-[11px] font-semibold opacity-80 leading-tight">{label}</p>
      {hint && <p className="text-[10px] opacity-60 leading-tight">{hint}</p>}
    </div>
  )
}

function BarraAvance({ porcentaje, dias }: { porcentaje: number; dias: { transcurridos: number; mes: number } }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 tracking-wider">AVANCE DEL MES</p>
        <p className="text-xs font-bold text-gray-600">{dias.transcurridos} de {dias.mes} días</p>
      </div>
      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#E8593C] to-[#F59E0B] transition-all duration-700"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5">
        {porcentaje}% del mes transcurrido — los números son acumulados a hoy
      </p>
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

  const act = data?.actividades

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

      <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-[#E8593C] animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* Avance del mes */}
            {periodo === "mes" && (
              <BarraAvance
                porcentaje={data.avance.porcentaje}
                dias={{ transcurridos: data.avance.dias_transcurridos, mes: data.avance.dias_mes }}
              />
            )}

            {/* Score combinado — protagonista */}
            <div className="bg-gradient-to-br from-[#E8593C] to-[#D04828] rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} />
                <p className="font-bold">Resultado general</p>
              </div>
              <div className="flex items-center gap-5">
                <ScoreRing score={data.combinado} size={104} color="#FFFFFF" />
                <div className="flex-1">
                  {data.combinado === null ? (
                    <>
                      <p className="text-white/80 text-sm leading-snug">Sin datos suficientes</p>
                      <p className="text-white/60 text-xs mt-2">Configurá jornadas o actividades para ver el resultado</p>
                    </>
                  ) : (
                    <>
                      <p className="text-white/80 text-sm leading-snug">
                        {data.combinado >= 80 ? "Excelente rendimiento 🏆"
                          : data.combinado >= 60 ? "Rendimiento aceptable"
                          : "Requiere atención"}
                      </p>
                      <p className="text-white/60 text-xs mt-2">
                        Combina asistencia{act?.disponible && act.pct_total !== null ? " y actividades" : ""}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Asistencia */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-400 tracking-wider mb-4">ASISTENCIA</p>
              <div className="flex items-center gap-5">
                <ScoreRing score={data.totales.score_asistencia} size={88} />
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-gray-800">Asistencias</p>
                  <p className="text-xs text-gray-400">
                    {data.totales.esperadas > 0
                      ? `${data.totales.entradas} de ${data.totales.esperadas} esperadas`
                      : `${data.totales.entradas} ingresos · sin jornadas cargadas`}
                  </p>
                  <p className="text-xs text-gray-400 inline-flex items-center gap-1">
                    <Users size={11} /> {data.totales.colaboradores} colaboradores activos
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <StatChip label="Ingresos" value={data.totales.entradas} icon={CheckCircle2} color="bg-emerald-50 text-emerald-700" />
                <StatChip label="Tardanzas" value={data.totales.tardanzas} icon={Clock} color="bg-amber-50 text-amber-700" />
                <StatChip label="Salidas anticip." value={data.totales.anticipadas} icon={LogOut} color="bg-orange-50 text-orange-600" />
              </div>
            </div>

            {/* Actividades */}
            {act?.disponible ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardCheck size={16} className="text-[#E8593C]" />
                  <p className="text-xs font-semibold text-gray-400 tracking-wider">ACTIVIDADES</p>
                </div>

                {act.pct_total !== null ? (
                  <div className="flex items-center gap-5">
                    <ScoreRing score={act.pct_total} size={88} />
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-gray-800">Cumplimiento operativo</p>
                      <p className="text-xs text-gray-400">Limpieza e inspecciones</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    Todavía no hay actividades registradas en este período
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className={cn("rounded-xl p-3 text-center", (act.pct_limpieza ?? 0) >= 80 ? "bg-emerald-50" : "bg-amber-50")}>
                    <p className={cn("text-xl font-black", (act.pct_limpieza ?? 0) >= 80 ? "text-emerald-700" : "text-amber-700")}>
                      {act.pct_limpieza !== null ? `${act.pct_limpieza}%` : "—"}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-500">limpieza</p>
                  </div>
                  <div className={cn("rounded-xl p-3 text-center",
                    act.pct_rondas === null ? "bg-gray-50" : act.pct_rondas >= 80 ? "bg-emerald-50" : "bg-amber-50")}>
                    <p className={cn("text-xl font-black",
                      act.pct_rondas === null ? "text-gray-400" : act.pct_rondas >= 80 ? "text-emerald-700" : "text-amber-700")}>
                      {act.pct_rondas !== null ? `${act.pct_rondas}%` : "—"}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-500">inspecciones</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-5 text-center">
                <ClipboardCheck size={22} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  Este servicio todavía no tiene el módulo de operaciones activo
                </p>
              </div>
            )}

            {/* Fórmula combinada */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 text-center">
              <TrendingUp size={13} className="shrink-0" />
              <span>
                Resultado = promedio de asistencia
                {act?.disponible && act.pct_total !== null ? " y actividades" : ""}
                {data.totales.score_asistencia !== null &&
                  ` (${data.totales.score_asistencia}%${act?.disponible && act.pct_total !== null ? ` + ${act.pct_total}%` : ""})`}
              </span>
            </div>
          </>
        ) : null}
      </div>

      <p className="text-center text-xs text-gray-300 pb-8">
        Powered by <span className="font-semibold">Fich.ar</span>
      </p>
    </div>
  )
}
