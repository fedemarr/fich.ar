"use client"

import { useEffect, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RefreshCw, Search, Shield, LogIn, AlertTriangle, Globe, Monitor } from "lucide-react"

interface GeoInfo {
  ciudad: string
  region: string
  pais: string
  bandera: string
  isp: string
}

interface LogRow {
  id: string
  created_at: string
  accion: string
  rol: string
  empresa_id: string | null
  usuario_id: string | null
  entidad: string | null
  entidad_id: string | null
  detalle: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  geo?: GeoInfo
}

interface RespuestaLogs {
  logs: LogRow[]
  total: number
}

const COLOR_ACCION: Record<string, string> = {
  LOGIN: "bg-green-100 text-green-700",
  LOGIN_FALLIDO: "bg-red-100 text-red-700",
  CREAR_COLABORADOR: "bg-blue-100 text-blue-700",
  EDITAR_COLABORADOR: "bg-sky-100 text-sky-700",
  DESACTIVAR_COLABORADOR: "bg-orange-100 text-orange-700",
  FICHADA_MANUAL: "bg-purple-100 text-purple-700",
  CREAR_NOVEDAD: "bg-yellow-100 text-yellow-700",
  CREAR_COMUNICACION: "bg-teal-100 text-teal-700",
  IMPORTAR_COLABORADORES: "bg-indigo-100 text-indigo-700",
  RESET_NOMINA: "bg-red-200 text-red-800",
  IMPORTAR_PROYECCION: "bg-violet-100 text-violet-700",
}

function parsearNavegador(ua: string | null): string {
  if (!ua) return "Desconocido"
  if (ua.includes("Chrome") && !ua.includes("Edg")) {
    const v = ua.match(/Chrome\/([\d.]+)/)?.[1]?.split(".")[0]
    const so = ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "Mac" : ua.includes("Android") ? "Android" : "Linux"
    return `Chrome ${v} / ${so}`
  }
  if (ua.includes("Firefox")) {
    const v = ua.match(/Firefox\/([\d.]+)/)?.[1]?.split(".")[0]
    return `Firefox ${v}`
  }
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari / Mac"
  if (ua.includes("Edg")) return "Edge"
  if (ua.includes("python") || ua.includes("curl") || ua.includes("axios")) return "Bot/Script"
  return ua.slice(0, 40)
}

function formatFecha(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<"todos" | "logins" | "fallidos" | "cambios">("todos")
  const [geoMap, setGeoMap] = useState<Record<string, GeoInfo>>({})
  const [geoLoading, setGeoLoading] = useState(false)

  const cargarLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/auditoria")
      const data: RespuestaLogs = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [])

  const geolocalizarIPs = useCallback(async (rows: LogRow[]) => {
    const ips = [...new Set(rows.map((r) => r.ip).filter(Boolean))] as string[]
    const pendientes = ips.filter((ip) => !geoMap[ip] && ip !== "unknown" && ip !== "127.0.0.1" && !ip.startsWith("192.168"))
    if (pendientes.length === 0) return

    setGeoLoading(true)
    try {
      const res = await fetch("http://ip-api.com/batch?fields=status,country,countryCode,regionName,city,isp,query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendientes.slice(0, 100)),
      })
      const data: Array<{ status: string; query: string; country: string; countryCode: string; regionName: string; city: string; isp: string }> = await res.json()
      const nuevos: Record<string, GeoInfo> = {}
      for (const item of data) {
        if (item.status === "success") {
          const bandera = item.countryCode
            ? String.fromCodePoint(...item.countryCode.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
            : "🌐"
          nuevos[item.query] = {
            ciudad: item.city,
            region: item.regionName,
            pais: item.country,
            bandera,
            isp: item.isp,
          }
        }
      }
      setGeoMap((prev) => ({ ...prev, ...nuevos }))
    } catch {
      // ip-api no disponible — seguimos sin geo
    } finally {
      setGeoLoading(false)
    }
  }, [geoMap])

  useEffect(() => {
    cargarLogs()
  }, [cargarLogs])

  useEffect(() => {
    if (logs.length > 0) geolocalizarIPs(logs)
  }, [logs]) // eslint-disable-line react-hooks/exhaustive-deps

  const logsFiltrados = logs.filter((log) => {
    if (filtro === "logins") return log.accion === "LOGIN"
    if (filtro === "fallidos") return log.accion === "LOGIN_FALLIDO"
    if (filtro === "cambios") return !log.accion.startsWith("LOGIN")
    return true
  }).filter((log) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      log.accion.toLowerCase().includes(q) ||
      log.ip?.toLowerCase().includes(q) ||
      (log.detalle as Record<string, string>)?.email?.toLowerCase().includes(q) ||
      log.rol.toLowerCase().includes(q)
    )
  })

  const fallidos = logs.filter((l) => l.accion === "LOGIN_FALLIDO").length
  const exitosos = logs.filter((l) => l.accion === "LOGIN").length

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#E8593C]" />
            Auditoría de Seguridad
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">{total} eventos registrados</p>
        </div>
        <Button variant="outline" size="sm" onClick={cargarLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
          <p className="text-xs text-[#6B7280] uppercase tracking-wide">Ingresos exitosos</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{exitosos}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
          <p className="text-xs text-[#6B7280] uppercase tracking-wide">Intentos fallidos</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{fallidos}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
          <p className="text-xs text-[#6B7280] uppercase tracking-wide">IPs únicas</p>
          <p className="text-3xl font-bold text-[#111827] mt-1">
            {new Set(logs.map((l) => l.ip).filter(Boolean)).size}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {(["todos", "logins", "fallidos", "cambios"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtro === f
                  ? "bg-[#E8593C] text-white"
                  : "bg-[#F9FAFB] text-[#6B7280] hover:bg-[#FEF3F0] hover:text-[#E8593C]"
              }`}
            >
              {f === "todos" && "Todos"}
              {f === "logins" && "Ingresos"}
              {f === "fallidos" && "Fallidos"}
              {f === "cambios" && "Cambios"}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder="Buscar IP, email, acción…"
            className="pl-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {geoLoading && (
          <span className="text-xs text-[#6B7280] flex items-center gap-1">
            <Globe className="w-3 h-3 animate-pulse" /> Geolocalizando IPs…
          </span>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> IP / Ubicación</span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                  <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Dispositivo</span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#6B7280]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Cargando…
                  </td>
                </tr>
              ) : logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#6B7280]">No hay eventos que coincidan</td>
                </tr>
              ) : (
                logsFiltrados.map((log) => {
                  const geo = log.ip ? geoMap[log.ip] : undefined
                  const esFallido = log.accion === "LOGIN_FALLIDO"
                  const detalle = log.detalle as Record<string, string> | null
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-[#F9FAFB] transition-colors ${esFallido ? "bg-red-50/50" : ""}`}
                    >
                      <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap text-xs">
                        {formatFecha(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${COLOR_ACCION[log.accion] ?? "bg-gray-100 text-gray-700"}`}>
                          {esFallido && <AlertTriangle className="w-3 h-3" />}
                          {log.accion === "LOGIN" && <LogIn className="w-3 h-3" />}
                          {log.accion.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <p className="font-medium text-[#111827]">{detalle?.email ?? log.usuario_id?.slice(0, 8) ?? "—"}</p>
                          <p className="text-[#6B7280]">{log.rol}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <p className="font-mono text-[#111827]">{log.ip ?? "—"}</p>
                          {geo ? (
                            <p className="text-[#6B7280]">
                              {geo.bandera} {geo.ciudad}, {geo.pais}
                            </p>
                          ) : log.ip && log.ip !== "unknown" ? (
                            <p className="text-[#6B7280] italic">localizando…</p>
                          ) : null}
                          {geo?.isp && <p className="text-[#6B7280] truncate max-w-[180px]">{geo.isp}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[#6B7280] max-w-[200px] truncate" title={log.user_agent ?? ""}>
                          {parsearNavegador(log.user_agent)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B7280] max-w-[200px]">
                        {detalle
                          ? Object.entries(detalle)
                              .filter(([k]) => k !== "email")
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ") || "—"
                          : "—"}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
