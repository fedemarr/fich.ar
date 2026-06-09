"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Calendar, AlertCircle, FileText, Plus, Pencil, Trash2, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { NovedadDialog } from "@/components/novedades/novedad-dialog"
import { ETIQUETAS_NOVEDAD } from "@/types"
import type { Colaborador, Novedad, TipoNovedad } from "@/generated/prisma/client"
import { toast } from "sonner"

type NovedadConColaborador = Novedad & { colaborador: Colaborador }

interface NovedadesClienteProps {
  slug: string
  colaboradores: Colaborador[]
  novedades: NovedadConColaborador[]
  inasistentes: Colaborador[]
  tabInicial: string
  fechaInicial: string
  desdeInicial: string
  hastaInicial: string
}

const COLORES_NOVEDAD: Partial<Record<TipoNovedad, string>> = {
  AU: "text-red-700 border-red-200 bg-red-50",
  EN: "text-orange-700 border-orange-200 bg-orange-50",
  VAC: "text-blue-700 border-blue-200 bg-blue-50",
  VIR: "text-purple-700 border-purple-200 bg-purple-50",
  FR: "text-gray-700 border-gray-200 bg-gray-50",
  FE: "text-gray-700 border-gray-200 bg-gray-50",
  P: "text-green-700 border-green-200 bg-green-50",
  PT: "text-yellow-700 border-yellow-200 bg-yellow-50",
  C: "text-cyan-700 border-cyan-200 bg-cyan-50",
  HDO: "text-pink-700 border-pink-200 bg-pink-50",
  DES: "text-slate-700 border-slate-200 bg-slate-50",
}

function avatarLetras(nombre: string, apellido: string) {
  return `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase()
}

function formatFecha(date: Date | string) {
  const d = new Date(date)
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function NovedadesCliente({
  colaboradores,
  novedades: novedadesIniciales,
  inasistentes,
  tabInicial,
  fechaInicial,
  desdeInicial,
  hastaInicial,
}: NovedadesClienteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<"inasistencias" | "reporte">(
    tabInicial === "reporte" ? "reporte" : "inasistencias"
  )
  const [fecha, setFecha] = useState(fechaInicial)
  const [desde, setDesde] = useState(desdeInicial)
  const [hasta, setHasta] = useState(hastaInicial)
  const [busqueda, setBusqueda] = useState("")
  const [filtroTipo, setFiltroTipo] = useState<string>("")
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<NovedadConColaborador | null>(null)
  const [colaboradorPreseleccionado, setColaboradorPreseleccionado] = useState<Colaborador | null>(null)

  const novedades = novedadesIniciales

  function aplicarFiltroFecha() {
    const params = new URLSearchParams()
    if (tab === "inasistencias") params.set("fecha", fecha)
    else { params.set("desde", desde); params.set("hasta", hasta) }
    params.set("tab", tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  function cambiarTab(t: "inasistencias" | "reporte") {
    setTab(t)
    const params = new URLSearchParams()
    params.set("tab", t)
    if (t === "inasistencias") params.set("fecha", fecha)
    else { params.set("desde", desde); params.set("hasta", hasta) }
    router.push(`${pathname}?${params.toString()}`)
  }

  async function eliminarNovedad(id: string) {
    if (!confirm("¿Eliminar esta novedad?")) return
    const res = await fetch(`/api/novedades/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Error al eliminar"); return }
    toast.success("Novedad eliminada")
    router.refresh()
  }

  function abrirCrear(colaborador?: Colaborador) {
    setEditando(null)
    setColaboradorPreseleccionado(colaborador ?? null)
    setDialogoAbierto(true)
  }

  const inasistentesVisibles = inasistentes.filter((c) => {
    if (!busqueda) return true
    const texto = `${c.nombre} ${c.apellido}`.toLowerCase()
    return texto.includes(busqueda.toLowerCase())
  })

  const novedadesFiltradas = novedades.filter((n) => {
    if (filtroTipo && n.tipo !== filtroTipo) return false
    if (busqueda) {
      const texto = `${n.colaborador.nombre} ${n.colaborador.apellido}`.toLowerCase()
      if (!texto.includes(busqueda.toLowerCase())) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar size={20} className="text-[#E8593C]" />
        <h1 className="text-xl font-semibold text-gray-900">Novedades</h1>
        <Button
          className="ml-auto h-9 gap-1.5 bg-[#E8593C] hover:bg-[#D04828] text-white"
          onClick={() => abrirCrear()}
        >
          <Plus size={15} />
          Nueva novedad
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => cambiarTab("inasistencias")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "inasistencias"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <AlertCircle size={14} />
          Inasistencias
        </button>
        <button
          onClick={() => cambiarTab("reporte")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "reporte"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileText size={14} />
          Reporte
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {tab === "inasistencias" ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Fecha</p>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-9 text-sm w-44"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Desde</p>
                <Input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="h-9 text-sm w-44"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Hasta</p>
                <Input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="h-9 text-sm w-44"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Tipo</p>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="h-9 text-sm px-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#E8593C]/20"
                >
                  <option value="">Todos</option>
                  {(Object.entries(ETIQUETAS_NOVEDAD) as [TipoNovedad, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Buscar</p>
            <Input
              placeholder="Nombre o apellido..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-9 text-sm w-52"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 self-end"
            onClick={aplicarFiltroFecha}
          >
            Aplicar
          </Button>
        </div>
      </div>

      {/* Contenido */}
      {tab === "inasistencias" ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Sin fichada — {formatFecha(fecha + "T12:00:00")}
            </p>
            <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">
              {inasistentesVisibles.length} ausentes
            </Badge>
          </div>

          {inasistentesVisibles.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 size={32} className="text-green-400 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                {busqueda ? "Sin resultados" : "Todos los colaboradores ficharon hoy"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {inasistentesVisibles.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                      {avatarLetras(c.nombre, c.apellido)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {c.apellido}, {c.nombre}
                      </p>
                      {c.legajo && (
                        <p className="text-xs text-gray-400">Legajo {c.legajo}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 text-[#E8593C] border-[#E8593C] hover:bg-[#FEF3F0]"
                    onClick={() => abrirCrear(c)}
                  >
                    <Plus size={11} />
                    Registrar novedad
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Novedades registradas
            </p>
            <Badge variant="outline" className="text-gray-600 border-gray-200">
              {novedadesFiltradas.length}
            </Badge>
          </div>

          {novedadesFiltradas.length === 0 ? (
            <div className="p-12 text-center">
              <Clock size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Sin novedades en el período seleccionado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-2.5 font-medium">Colaborador</th>
                  <th className="px-3 py-2.5 font-medium">Fecha</th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 font-medium">Observación</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                  <th className="px-3 py-2.5 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {novedadesFiltradas.map((n) => (
                  <tr key={n.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                          {avatarLetras(n.colaborador.nombre, n.colaborador.apellido)}
                        </div>
                        <span className="font-medium text-gray-800">
                          {n.colaborador.apellido}, {n.colaborador.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                      {formatFecha(n.fecha)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${COLORES_NOVEDAD[n.tipo] ?? "text-gray-600 border-gray-200"}`}
                      >
                        {ETIQUETAS_NOVEDAD[n.tipo]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-gray-500 max-w-[200px] truncate">
                      {n.observacion ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      {n.aprobada ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 size={12} /> Aprobada
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Pendiente</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-[#E8593C]"
                          onClick={() => { setEditando(n); setColaboradorPreseleccionado(null); setDialogoAbierto(true) }}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                          onClick={() => eliminarNovedad(n.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <NovedadDialog
        open={dialogoAbierto}
        novedad={editando}
        colaboradores={colaboradores}
        colaboradorPreseleccionado={colaboradorPreseleccionado}
        fechaDefault={tab === "inasistencias" ? fecha : desdeInicial}
        onClose={() => { setDialogoAbierto(false); setEditando(null); setColaboradorPreseleccionado(null) }}
        onSuccess={() => { setDialogoAbierto(false); setEditando(null); setColaboradorPreseleccionado(null); router.refresh() }}
      />
    </div>
  )
}
