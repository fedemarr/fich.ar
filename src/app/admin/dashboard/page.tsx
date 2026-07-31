"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Building2, Users, Fingerprint, DollarSign, RefreshCw,
  AlertTriangle, Wifi, WifiOff, CheckCircle, Clock,
  ShieldAlert, Activity, ExternalLink, TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// ─── Types ───────────────────────────────────────────────────────────────────

interface KPIs {
  empresas: number
  colaboradores: number
  fichadasMes: number
  pendiente: number
  mes: number
  anio: number
}

interface EmpresaStat {
  id: string
  nombre: string
  slug: string
  activa: boolean
  colaboradores: number
  fichadasMes: number
  pendiente: number
}

interface ErrorWA {
  id: string
  from_number: string
  body: string
  error: string | null
  created_at: string
  procesado: boolean
}

interface AuditSospechoso {
  id: string
  empresa_id: string | null
  usuario_id: string | null
  rol: string
  accion: string
  entidad: string | null
  ip: string | null
  created_at: string
  motivos: string[]
}

interface DashboardData {
  kpis: KPIs
  empresas: EmpresaStat[]
  erroresWA: ErrorWA[]
  sospechosos: AuditSospechoso[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

function formatFecha(iso: string) {
  const d = new Date(iso)
  const argD = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const hh = String(argD.getUTCHours()).padStart(2, "0")
  const mm = String(argD.getUTCMinutes()).padStart(2, "0")
  const dd = String(argD.getUTCDate()).padStart(2, "0")
  const mo = String(argD.getUTCMonth() + 1).padStart(2, "0")
  return `${dd}/${mo} ${hh}:${mm}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardAdminPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/dashboard")
    if (res.ok) {
      setData(await res.json())
      setLastUpdate(new Date())
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const kpis = data?.kpis
  const mesLabel = kpis ? `${MESES[kpis.mes - 1]} ${kpis.anio}` : ""

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Dashboard</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {lastUpdate
              ? `Actualizado ${formatFecha(lastUpdate.toISOString())}`
              : "Cargando…"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={cargar}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          label="Empresas activas"
          value={kpis?.empresas ?? "-"}
          color="blue"
        />
        <KpiCard
          icon={Users}
          label="Colaboradores"
          value={kpis?.colaboradores ?? "-"}
          sub="activos"
          color="purple"
        />
        <KpiCard
          icon={Fingerprint}
          label="Fichadas"
          value={kpis?.fichadasMes ?? "-"}
          sub={mesLabel}
          color="coral"
        />
        <KpiCard
          icon={DollarSign}
          label="Por cobrar"
          value={kpis ? `$ ${kpis.pendiente.toLocaleString("es-AR")}` : "-"}
          sub="cobros pendientes"
          color="yellow"
        />
      </div>

      {/* Tabla empresas */}
      <Section
        title="Uso por empresa"
        icon={TrendingUp}
        count={data?.empresas.length}
      >
        {!data ? (
          <Skeleton rows={3} />
        ) : data.empresas.length === 0 ? (
          <Empty texto="Sin empresas registradas" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <Th>Empresa</Th>
                  <Th>Estado</Th>
                  <Th align="right">Colaboradores</Th>
                  <Th align="right">Fichadas {mesLabel}</Th>
                  <Th align="right">Pendiente cobro</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {data.empresas.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#111827]">
                      <div>{e.nombre}</div>
                      <div className="text-xs text-[#9CA3AF]">/{e.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      {e.activa ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" /> Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          <Clock className="w-3 h-3" /> Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#111827]">{e.colaboradores}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${e.fichadasMes > 0 ? "text-[#111827]" : "text-[#9CA3AF]"}`}>
                        {e.fichadasMes.toLocaleString("es-AR")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.pendiente > 0 ? (
                        <span className="font-semibold text-yellow-700">
                          $ {e.pendiente.toLocaleString("es-AR")}
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF] text-xs">Al día</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${e.slug}/resumen`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-[#E8593C] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Fila: Errores WA + Auditorías sospechosas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Errores bot WA */}
        <Section
          title="Errores bot WhatsApp"
          icon={WifiOff}
          count={data?.erroresWA.length}
          danger={!!data?.erroresWA.length}
        >
          {!data ? (
            <Skeleton rows={4} />
          ) : data.erroresWA.length === 0 ? (
            <EmptyOk texto="Sin errores recientes" />
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {data.erroresWA.map((e) => (
                <li key={e.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#111827]">{e.from_number}</span>
                    <span className="text-xs text-[#9CA3AF]">{formatFecha(e.created_at)}</span>
                  </div>
                  <p className="text-xs text-red-600 line-clamp-2">{e.error}</p>
                  {e.body && (
                    <p className="text-xs text-[#9CA3AF] truncate">Msg: {e.body.slice(0, 80)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Auditorías sospechosas */}
        <Section
          title="Auditorías sospechosas"
          icon={ShieldAlert}
          count={data?.sospechosos.length}
          danger={!!(data?.sospechosos.length)}
        >
          {!data ? (
            <Skeleton rows={4} />
          ) : data.sospechosos.length === 0 ? (
            <EmptyOk texto="Sin actividad sospechosa detectada" />
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {data.sospechosos.map((s) => (
                <li key={s.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-[#F3F4F6] px-1.5 py-0.5 rounded text-[#374151]">
                        {s.rol}
                      </span>
                      <span className="text-sm font-medium text-[#111827]">{s.accion}</span>
                      {s.entidad && (
                        <span className="text-xs text-[#6B7280]">› {s.entidad}</span>
                      )}
                    </div>
                    <span className="text-xs text-[#9CA3AF] shrink-0">{formatFecha(s.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.motivos.map((m, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        {m}
                      </span>
                    ))}
                  </div>
                  {s.ip && (
                    <p className="text-xs text-[#9CA3AF]">IP: {s.ip}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: "blue" | "purple" | "coral" | "yellow"
}) {
  const colors = {
    blue:   { bg: "bg-blue-50",   icon: "text-blue-600"   },
    purple: { bg: "bg-purple-50", icon: "text-purple-600" },
    coral:  { bg: "bg-[#FEF3F0]", icon: "text-[#E8593C]" },
    yellow: { bg: "bg-yellow-50", icon: "text-yellow-600" },
  }
  const c = colors[color]
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        <span className="text-sm font-medium text-[#6B7280]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#111827]">{value}</p>
      {sub && <p className="text-xs text-[#9CA3AF] mt-1">{sub}</p>}
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  count,
  danger,
  children,
}: {
  title: string
  icon: React.ElementType
  count?: number
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${danger && count ? "text-orange-500" : "text-[#6B7280]"}`} />
          <span className="text-sm font-semibold text-[#111827]">{title}</span>
        </div>
        {count !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            danger && count > 0
              ? "bg-orange-100 text-orange-700"
              : "bg-[#F3F4F6] text-[#6B7280]"
          }`}>
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Th({ children, align }: { children?: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  )
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-[#F3F4F6] rounded animate-pulse" />
      ))}
    </div>
  )
}

function Empty({ texto }: { texto: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-sm text-[#9CA3AF]">
      {texto}
    </div>
  )
}

function EmptyOk({ texto }: { texto: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-green-600">
      <CheckCircle className="w-4 h-4" />
      {texto}
    </div>
  )
}
