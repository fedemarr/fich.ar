"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  DollarSign, Plus, CheckCircle, Clock, AlertCircle,
  ChevronDown, X, Loader2, Building2, Trash2, TrendingUp,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Empresa {
  id: string
  nombre: string
  slug: string
}

interface Cobro {
  id: string
  empresa_id: string
  concepto: string
  monto: number
  moneda: string
  periodo: string | null
  estado: string
  fecha_emision: string
  fecha_vencimiento: string | null
  fecha_pago: string | null
  nota: string | null
  empresa: Empresa
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

const formatMonto = (monto: number, moneda: string) =>
  `${moneda === "USD" ? "USD " : "$ "}${monto.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const formatFecha = (iso: string | null) => {
  if (!iso) return "-"
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDIENTE: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  PAGADO:    { label: "Pagado",    color: "bg-green-100 text-green-800",   icon: CheckCircle },
  VENCIDO:   { label: "Vencido",   color: "bg-red-100 text-red-800",      icon: AlertCircle },
}

// Genera los últimos N meses como claves "YYYY-MM"
function ultimosMeses(n: number): string[] {
  const meses: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return meses
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanzasPage() {
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("all")
  const [filtroEstado, setFiltroEstado] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pagarId, setPagarId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/cobros")
    if (res.ok) {
      const data = await res.json()
      setCobros(data.cobros)
      setEmpresas(data.empresas)
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // KPIs
  const totalPendiente = cobros.filter(c => c.estado === "PENDIENTE").reduce((s, c) => s + c.monto, 0)
  const totalPagado    = cobros.filter(c => c.estado === "PAGADO").reduce((s, c) => s + c.monto, 0)
  const totalVencido   = cobros.filter(c => c.estado === "VENCIDO").reduce((s, c) => s + c.monto, 0)
  const countPendiente = cobros.filter(c => c.estado === "PENDIENTE").length
  const countVencido   = cobros.filter(c => c.estado === "VENCIDO").length

  // Gráfico: ingresos cobrados por mes (últimos 12 meses)
  const datosGrafico = useMemo(() => {
    const meses = ultimosMeses(12)
    const porMes: Record<string, number> = {}
    for (const key of meses) porMes[key] = 0

    for (const c of cobros) {
      if (c.estado !== "PAGADO" || !c.fecha_pago) continue
      const d = new Date(c.fecha_pago)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      if (key in porMes) porMes[key] += c.monto
    }

    return meses.map(key => {
      const [anio, mes] = key.split("-")
      return {
        key,
        label: `${MESES_CORTO[parseInt(mes) - 1]} ${anio.slice(2)}`,
        monto: porMes[key],
      }
    })
  }, [cobros])

  const mesActualKey = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })()

  // Acumulado año en curso
  const anioActual = new Date().getFullYear()
  const totalAnio = cobros
    .filter(c => c.estado === "PAGADO" && c.fecha_pago && new Date(c.fecha_pago).getUTCFullYear() === anioActual)
    .reduce((s, c) => s + c.monto, 0)

  const filtrados = cobros.filter(c => {
    if (filtroEmpresa !== "all" && c.empresa_id !== filtroEmpresa) return false
    if (filtroEstado !== "all" && c.estado !== filtroEstado) return false
    return true
  })

  async function marcarPagado(id: string) {
    setSaving(true)
    await fetch(`/api/admin/cobros?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "PAGADO" }),
    })
    setSaving(false)
    setPagarId(null)
    cargar()
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este cobro?")) return
    await fetch(`/api/admin/cobros?id=${id}`, { method: "DELETE" })
    cargar()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Finanzas</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Cobros y facturación por empresa</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-[#E8593C] hover:bg-[#D04828] text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo cobro
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-50"><TrendingUp className="w-5 h-5 text-green-600" /></div>
            <span className="text-sm font-medium text-[#6B7280]">Acumulado {anioActual}</span>
          </div>
          <p className="text-2xl font-bold text-[#111827]">$ {totalAnio.toLocaleString("es-AR")}</p>
          <p className="text-xs text-[#6B7280] mt-1">Total cobrado este año</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-50"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <span className="text-sm font-medium text-[#6B7280]">Cobrado total</span>
          </div>
          <p className="text-2xl font-bold text-[#111827]">$ {totalPagado.toLocaleString("es-AR")}</p>
          <p className="text-xs text-[#6B7280] mt-1">Histórico acumulado</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-yellow-50"><Clock className="w-5 h-5 text-yellow-600" /></div>
            <span className="text-sm font-medium text-[#6B7280]">Por cobrar</span>
          </div>
          <p className="text-2xl font-bold text-[#111827]">$ {totalPendiente.toLocaleString("es-AR")}</p>
          <p className="text-xs text-[#6B7280] mt-1">{countPendiente} cobro{countPendiente !== 1 ? "s" : ""} pendiente{countPendiente !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-50"><AlertCircle className="w-5 h-5 text-red-600" /></div>
            <span className="text-sm font-medium text-[#6B7280]">Vencido</span>
          </div>
          <p className="text-2xl font-bold text-[#111827]">$ {totalVencido.toLocaleString("es-AR")}</p>
          <p className="text-xs text-[#6B7280] mt-1">{countVencido} cobro{countVencido !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Gráfico ingresos por mes */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h2 className="text-sm font-semibold text-[#111827] mb-5">Ingresos cobrados — últimos 12 meses</h2>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-[#9CA3AF]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando…
          </div>
        ) : totalPagado === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-[#9CA3AF]">
            <DollarSign className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Sin cobros pagados aún</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={datosGrafico} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v === 0 ? "" : `$${(v / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip
                formatter={(value) => [`$ ${Number(value ?? 0).toLocaleString("es-AR")}`, "Cobrado"]}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
                contentStyle={{ border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "#F9FAFB" }}
              />
              <Bar dataKey="monto" radius={[4, 4, 0, 0]}>
                {datosGrafico.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.key === mesActualKey ? "#E8593C" : "#FBBF24"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {!loading && totalPagado > 0 && (
          <p className="text-xs text-[#9CA3AF] mt-3">
            El mes actual se muestra en coral. Los montos son en ARS.
          </p>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={filtroEmpresa} onValueChange={v => setFiltroEmpresa(v ?? "all")}>
          <SelectTrigger className="w-52">
            <Building2 className="w-4 h-4 mr-2 text-[#6B7280]" />
            <SelectValue placeholder="Todas las empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {empresas.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={v => setFiltroEstado(v ?? "all")}>
          <SelectTrigger className="w-44">
            <ChevronDown className="w-4 h-4 mr-2 text-[#6B7280]" />
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
            <SelectItem value="PAGADO">Pagado</SelectItem>
            <SelectItem value="VENCIDO">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#6B7280]">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#6B7280]">
            <DollarSign className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Sin cobros registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Concepto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Período</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Monto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Vencimiento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Pago</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filtrados.map(c => {
                  const est = ESTADO_CONFIG[c.estado] ?? ESTADO_CONFIG.PENDIENTE
                  const EstIcon = est.icon
                  return (
                    <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#111827]">{c.empresa.nombre}</td>
                      <td className="px-4 py-3 text-[#374151]">
                        {c.concepto}
                        {c.nota && <p className="text-xs text-[#9CA3AF] truncate max-w-[180px]">{c.nota}</p>}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">{c.periodo ?? "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#111827]">
                        {formatMonto(c.monto, c.moneda)}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">{formatFecha(c.fecha_vencimiento)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${est.color}`}>
                          <EstIcon className="w-3 h-3" />
                          {est.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6B7280] text-xs">{formatFecha(c.fecha_pago)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {c.estado === "PENDIENTE" && (
                            <button
                              onClick={() => setPagarId(c.id)}
                              className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors whitespace-nowrap"
                            >
                              Marcar pagado
                            </button>
                          )}
                          <button
                            onClick={() => eliminar(c.id)}
                            className="p-1.5 rounded-md text-[#9CA3AF] hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog confirmar pago */}
      <Dialog open={!!pagarId} onOpenChange={() => setPagarId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar pago</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6B7280]">
            ¿Marcar este cobro como pagado con la fecha de hoy?
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setPagarId(null)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={() => pagarId && marcarPagado(pagarId)}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog nuevo cobro */}
      {dialogOpen && (
        <NuevoCobroDialog
          empresas={empresas}
          onClose={() => setDialogOpen(false)}
          onSuccess={() => { setDialogOpen(false); cargar() }}
        />
      )}
    </div>
  )
}

// ─── Dialog nuevo cobro ───────────────────────────────────────────────────────

function NuevoCobroDialog({
  empresas,
  onClose,
  onSuccess,
}: {
  empresas: Empresa[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    empresa_id: "",
    concepto: "",
    monto: "",
    moneda: "ARS",
    periodo: "",
    fecha_vencimiento: "",
    nota: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.empresa_id || !form.concepto || !form.monto) {
      setError("Completá empresa, concepto y monto")
      return
    }
    const monto = parseFloat(form.monto.replace(/\./g, "").replace(",", "."))
    if (isNaN(monto) || monto <= 0) { setError("Monto inválido"); return }

    setSaving(true)
    setError(null)
    const res = await fetch("/api/admin/cobros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresa_id: form.empresa_id,
        concepto: form.concepto,
        monto,
        moneda: form.moneda,
        periodo: form.periodo || undefined,
        fecha_vencimiento: form.fecha_vencimiento || undefined,
        nota: form.nota || undefined,
      }),
    })
    setSaving(false)
    if (!res.ok) { setError("Error al guardar"); return }
    onSuccess()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo cobro</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Empresa *</Label>
            <Select value={form.empresa_id} onValueChange={v => set("empresa_id", v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Concepto *</Label>
            <Input
              placeholder="Ej: Suscripción mensual agosto 2026"
              value={form.concepto}
              onChange={e => set("concepto", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto *</Label>
              <Input
                placeholder="15000"
                value={form.monto}
                onChange={e => set("monto", e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={form.moneda} onValueChange={v => set("moneda", v ?? "ARS")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS $</SelectItem>
                  <SelectItem value="USD">USD $</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Período</Label>
              <Input
                placeholder="Agosto 2026"
                value={form.periodo}
                onChange={e => set("periodo", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimiento</Label>
              <Input
                type="date"
                value={form.fecha_vencimiento}
                onChange={e => set("fecha_vencimiento", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nota interna</Label>
            <Input
              placeholder="Opcional…"
              value={form.nota}
              onChange={e => set("nota", e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              type="submit"
              className="bg-[#E8593C] hover:bg-[#D04828] text-white gap-2"
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar cobro
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
