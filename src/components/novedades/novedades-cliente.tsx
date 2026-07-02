"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Calendar, AlertCircle, FileText, Plus, RefreshCw, CheckCircle2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CalendarioNovedades } from "@/components/novedades/calendario-novedades"
import { NovedadDialog } from "@/components/novedades/novedad-dialog"
import { AutoRefresh } from "@/components/resumen/auto-refresh"
import { ETIQUETAS_NOVEDAD } from "@/types"
import { toast } from "sonner"
import type { Colaborador, Novedad, TipoNovedad } from "@/generated/prisma/client"
import type { InasistenciaDetectada, AnalisisDia } from "@/app/(dashboard)/[slug]/novedades/page"

type NovedadConColaborador = Novedad & { colaborador: Colaborador }

interface NovedadesClienteProps {
  slug: string
  colaboradores: Colaborador[]
  novedadesMes: NovedadConColaborador[]
  inasistencias: InasistenciaDetectada[]
  presenciasMes: Set<string>
  analisisMes: Record<string, AnalisisDia>
  tabInicial: string
  mesInicial: number
  anioInicial: number
}

function avatarLetras(nombre: string, apellido: string) {
  return `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase()
}

function SelectorTipoNovedad({
  value,
  onChange,
  disabled,
}: {
  value: TipoNovedad | null
  onChange: (tipo: TipoNovedad) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => { if (e.target.value) onChange(e.target.value as TipoNovedad) }}
      disabled={disabled}
      className={`h-9 px-3 pr-8 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 appearance-none bg-white ${
        value
          ? "border-gray-300 text-gray-800 font-medium"
          : "border-gray-200 text-gray-400"
      }`}
      style={{ minWidth: "160px" }}
    >
      <option value="" disabled>Seleccionar</option>
      {(Object.entries(ETIQUETAS_NOVEDAD) as [TipoNovedad, string][]).map(([k, v]) => (
        <option key={k} value={k}>{k} — {v}</option>
      ))}
    </select>
  )
}

export function NovedadesCliente({
  slug,
  colaboradores,
  novedadesMes,
  inasistencias: inasistenciasIniciales,
  presenciasMes,
  analisisMes,
  tabInicial,
  mesInicial,
  anioInicial,
}: NovedadesClienteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<"inasistencias" | "reporte">(
    tabInicial === "reporte" ? "reporte" : "inasistencias"
  )
  const [mes, setMes] = useState(mesInicial)
  const [anio, setAnio] = useState(anioInicial)
  const [busqueda, setBusqueda] = useState("")
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [colaboradorDialog, setColaboradorDialog] = useState<Colaborador | null>(null)
  const [fechaDialog, setFechaDialog] = useState("")
  const [novedadEditando, setNovedadEditando] = useState<NovedadConColaborador | null>(null)

  // Local state for inasistencias (optimistic updates)
  const [inasistencias, setInasistencias] = useState<InasistenciaDetectada[]>(inasistenciasIniciales)

  function cambiarTab(t: "inasistencias" | "reporte") {
    setTab(t)
    const params = new URLSearchParams()
    params.set("tab", t)
    params.set("mes", String(mes))
    params.set("anio", String(anio))
    router.push(`${pathname}?${params.toString()}`)
  }

  function cambiarMes(nuevoMes: number, nuevoAnio: number) {
    setMes(nuevoMes)
    setAnio(nuevoAnio)
    const params = new URLSearchParams()
    params.set("tab", "reporte")
    params.set("mes", String(nuevoMes))
    params.set("anio", String(nuevoAnio))
    router.push(`${pathname}?${params.toString()}`)
  }

  async function asignarTipo(item: InasistenciaDetectada, tipo: TipoNovedad) {
    const esEdicion = !!item.novedadId

    // Optimistic update
    setInasistencias((prev) =>
      prev.map((i) =>
        i.colaborador.id === item.colaborador.id && i.fecha === item.fecha
          ? { ...i, novedadTipo: tipo }
          : i
      )
    )

    const url = esEdicion ? `/api/novedades/${item.novedadId}` : "/api/novedades"
    const method = esEdicion ? "PUT" : "POST"
    const body = esEdicion
      ? { tipo }
      : { colaborador_id: item.colaborador.id, fecha: item.fecha, tipo }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      toast.error("Error al guardar")
      setInasistencias(inasistenciasIniciales)
      return
    }

    const data = await res.json() as { id?: string }
    if (!esEdicion && data.id) {
      setInasistencias((prev) =>
        prev.map((i) =>
          i.colaborador.id === item.colaborador.id && i.fecha === item.fecha
            ? { ...i, novedadId: data.id ?? null, novedadTipo: tipo }
            : i
        )
      )
    }
  }

  async function aprobar(item: InasistenciaDetectada) {
    if (!item.novedadId) {
      toast.error("Primero asigná un tipo de novedad")
      return
    }
    setInasistencias((prev) =>
      prev.map((i) =>
        i.colaborador.id === item.colaborador.id && i.fecha === item.fecha
          ? { ...i, aprobada: true }
          : i
      )
    )
    await fetch(`/api/novedades/${item.novedadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aprobada: true }),
    })
  }

  async function eliminar(item: InasistenciaDetectada) {
    if (item.novedadId) {
      await fetch(`/api/novedades/${item.novedadId}`, { method: "DELETE" })
    }
    setInasistencias((prev) =>
      prev.filter((i) => !(i.colaborador.id === item.colaborador.id && i.fecha === item.fecha))
    )
  }

  function abrirDesdeCalendario(colaborador: Colaborador, dia: number) {
    const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
    setColaboradorDialog(colaborador)
    setFechaDialog(fecha)
    setNovedadEditando(null)
    setDialogoAbierto(true)
  }

  const inasistenciasFiltradas = inasistencias.filter((i) => {
    if (!busqueda) return true
    const texto = `${i.colaborador.apellido} ${i.colaborador.nombre}`.toLowerCase()
    return texto.includes(busqueda.toLowerCase())
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar size={20} className="text-[#2563EB]" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Novedades</h1>
          <p className="text-xs text-gray-400">Gestión de todos los colaboradores</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <AutoRefresh intervalSeconds={30} />
          <Button
            className="h-9 gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            onClick={() => {
              setColaboradorDialog(null)
              setFechaDialog("")
              setNovedadEditando(null)
              setDialogoAbierto(true)
            }}
          >
            <Plus size={15} />
            Nueva novedad
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => cambiarTab("inasistencias")}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "inasistencias"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <AlertCircle size={14} />
          Inasistencias
        </button>
        <button
          onClick={() => cambiarTab("reporte")}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "reporte"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <FileText size={14} />
          Reporte
        </button>
      </div>

      {/* INASISTENCIAS TAB */}
      {tab === "inasistencias" && (
        <div className="space-y-3">
          {/* Barra de búsqueda + refresh */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar colaborador..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-9 pl-9 pr-4 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 w-64"
              />
            </div>
          </div>

          {/* Lista */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {inasistenciasFiltradas.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 size={32} className="text-green-400 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  {busqueda ? "Sin resultados" : "Sin inasistencias en los últimos días hábiles"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {inasistenciasFiltradas.map((item) => (
                  <div
                    key={`${item.colaborador.id}-${item.fecha}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Avatar + nombre */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                        item.conFichada
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-[#EFF6FF] border-[#2563EB]/20 text-[#2563EB]"
                      }`}>
                        {avatarLetras(item.colaborador.nombre, item.colaborador.apellido)}
                      </div>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {item.colaborador.apellido} {item.colaborador.nombre}
                      </span>
                      {item.conFichada && (
                        <span className="text-xs text-green-600 font-medium shrink-0">fichó ✓</span>
                      )}
                    </div>

                    {/* Fecha */}
                    <span className="text-sm text-gray-500 shrink-0 w-28">{item.fecha}</span>

                    {/* Selector tipo */}
                    <SelectorTipoNovedad
                      value={item.novedadTipo}
                      onChange={(tipo) => void asignarTipo(item, tipo)}
                    />

                    {/* Delete */}
                    <button
                      onClick={() => void eliminar(item)}
                      className="text-[#2563EB] hover:text-[#1D4ED8] transition-colors shrink-0"
                      title="Eliminar"
                    >
                      <Trash2 size={17} />
                    </button>

                    {/* Approve */}
                    <button
                      onClick={() => void aprobar(item)}
                      className={`shrink-0 transition-colors ${
                        item.aprobada
                          ? "text-green-500"
                          : "text-gray-300 hover:text-green-400"
                      }`}
                      title={item.aprobada ? "Aprobada" : "Aprobar"}
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORTE TAB — Calendario */}
      {tab === "reporte" && (
        <CalendarioNovedades
          colaboradores={colaboradores}
          novedadesMes={novedadesMes}
          presenciasMes={presenciasMes}
          analisisMes={analisisMes}
          mes={mes}
          anio={anio}
          onCambiarMes={cambiarMes}
          onCeldaClick={abrirDesdeCalendario}
        />
      )}

      {/* Dialog */}
      <NovedadDialog
        open={dialogoAbierto}
        novedad={novedadEditando}
        colaboradores={colaboradores}
        colaboradorPreseleccionado={colaboradorDialog}
        fechaDefault={fechaDialog || new Date().toISOString().split("T")[0]}
        onClose={() => {
          setDialogoAbierto(false)
          setNovedadEditando(null)
          setColaboradorDialog(null)
        }}
        onSuccess={() => {
          setDialogoAbierto(false)
          setNovedadEditando(null)
          setColaboradorDialog(null)
          router.refresh()
        }}
      />
    </div>
  )
}
