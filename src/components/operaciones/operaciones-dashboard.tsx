"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { RefreshCw, Settings, ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle, AlertTriangle, Circle, ClipboardCheck, BarChart2, Download, Camera } from "lucide-react"
import { exportarHistorialOperacionesExcel } from "@/lib/export"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// ─── Historial ────────────────────────────────────────────────────────────────

interface DiaReporte {
  fecha: string
  total: number
  completados: number
  en_curso: number
  pendientes: number
  tareas_total: number
  tareas_completadas: number
  tareas_criticas_no_completadas: number
  compliance_pct: number
}

function HistorialTab() {
  const [dias, setDias] = useState<DiaReporte[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [rango, setRango] = useState(7)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/operaciones/reporte?dias=${rango}`)
    if (res.ok) {
      const d = await res.json() as { dias: DiaReporte[] }
      setDias(d.dias)
    }
    setLoading(false)
  }, [rango])

  useEffect(() => { cargar() }, [cargar])

  const totalDias = dias?.length ?? 0
  const diasConDatos = dias?.filter((d) => d.total > 0).length ?? 0
  const promedio = diasConDatos > 0
    ? Math.round(
        (dias ?? []).filter((d) => d.total > 0).reduce((acc, d) => acc + d.compliance_pct, 0) / diasConDatos
      )
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">
            {diasConDatos > 0
              ? `${diasConDatos} de ${totalDias} días con actividad · promedio ${promedio}% completado`
              : "Sin actividad en el período"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dias && dias.some((d) => d.total > 0) && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => exportarHistorialOperacionesExcel(dias)}
            >
              <Download size={13} />
              Excel
            </Button>
          )}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[7, 14, 30].map((n) => (
              <button
                key={n}
                onClick={() => setRango(n)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  rango === n ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {n} días
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : !dias || dias.every((d) => d.total === 0) ? (
        <div className="text-center py-12 text-gray-400">
          <BarChart2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin ejecuciones en los últimos {rango} días.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...dias].reverse().map((d) => {
            const label = format(parseISO(d.fecha), "EEE d MMM", { locale: es })
            const esHoy = d.fecha === new Date().toISOString().slice(0, 10)
            const sinDatos = d.total === 0

            return (
              <div
                key={d.fecha}
                className={cn(
                  "bg-white border rounded-xl px-4 py-3",
                  esHoy ? "border-[#E8593C]/40" : "border-gray-200",
                  sinDatos && "opacity-50"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <p className={cn("text-sm font-medium capitalize", esHoy && "text-[#E8593C]")}>{label}</p>
                    {esHoy && <span className="text-[10px] text-[#E8593C] font-semibold">hoy</span>}
                  </div>

                  {sinDatos ? (
                    <p className="text-xs text-gray-400 flex-1">Sin procedimientos</p>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={cn(
                                "h-1.5 rounded-full transition-all",
                                d.compliance_pct >= 90 ? "bg-green-500" :
                                d.compliance_pct >= 70 ? "bg-amber-400" : "bg-red-400"
                              )}
                              style={{ width: `${d.compliance_pct}%` }}
                            />
                          </div>
                          <span className={cn(
                            "text-xs font-bold w-9 text-right",
                            d.compliance_pct >= 90 ? "text-green-600" :
                            d.compliance_pct >= 70 ? "text-amber-600" : "text-red-600"
                          )}>
                            {d.compliance_pct}%
                          </span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-gray-400">
                          <span>{d.tareas_completadas}/{d.tareas_total} tareas</span>
                          {d.tareas_criticas_no_completadas > 0 && (
                            <span className="text-red-500 font-medium">
                              {d.tareas_criticas_no_completadas} crítica{d.tareas_criticas_no_completadas !== 1 ? "s" : ""} pendiente{d.tareas_criticas_no_completadas !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 text-xs">
                        {d.completados > 0 && (
                          <span className="bg-green-100 text-green-700 rounded px-1.5 py-0.5">{d.completados} ✓</span>
                        )}
                        {d.en_curso > 0 && (
                          <span className="bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">{d.en_curso} ⟳</span>
                        )}
                        {d.pendientes > 0 && (
                          <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{d.pendientes} —</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type EstadoTarea = "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "OMITIDA" | "NO_REALIZADA"
type ValidacionEstado = "PENDIENTE" | "APROBADA" | "RECHAZADA"
type EstadoProc = "PENDIENTE" | "EN_CURSO" | "COMPLETADO"

interface Foto {
  id: string
  key: string | null
  imagen_url: string | null
  verificacion_ia: unknown
  estado_subida: string
  created_at: string
}

interface EjecucionTareaItem {
  id: string
  estado: EstadoTarea
  hora_inicio: string | null
  hora_fin: string | null
  colaborador: { id: string; nombre: string; apellido: string } | null
  comentario: string | null
  checklist_completado: unknown
  se_salteo_orden: boolean
  motivo_salteo: string | null
  validacion_estado: ValidacionEstado
  motivo_rechazo: string | null
  fotos: Foto[]
  tarea: {
    id: string
    nombre: string
    seccion: string | null
    orden: number
    es_critica: boolean
    es_omitible: boolean
    foto_min: number
    foto_max: number
    requiere_comentario: boolean
    checklist_items: unknown
    tiempo_estimado_min: number | null
    punto_fichaje: { id: string; nombre: string } | null
  }
}

interface EjecucionProc {
  id: string
  estado: EstadoProc
  fecha: string
  procedimiento: { id: string; nombre: string }
  turno: { id: string; nombre: string; hora_inicio: string; hora_fin: string }
  tareas: EjecucionTareaItem[]
}

const ESTADO_TAREA_LABEL: Record<EstadoTarea, string> = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  OMITIDA: "Omitida",
  NO_REALIZADA: "No realizada",
}

const ESTADO_PROC_COLOR: Record<EstadoProc, string> = {
  PENDIENTE: "bg-gray-100 text-gray-600",
  EN_CURSO: "bg-blue-100 text-blue-700",
  COMPLETADO: "bg-green-100 text-green-700",
}

function TareaEstadoIcon({ estado }: { estado: EstadoTarea }) {
  if (estado === "COMPLETADA") return <CheckCircle2 size={16} className="text-green-500" />
  if (estado === "EN_CURSO") return <Clock size={16} className="text-blue-500" />
  if (estado === "OMITIDA") return <XCircle size={16} className="text-orange-400" />
  if (estado === "NO_REALIZADA") return <AlertTriangle size={16} className="text-red-500" />
  return <Circle size={16} className="text-gray-300" />
}

function ProgresoBar({ tareas }: { tareas: EjecucionTareaItem[] }) {
  const total = tareas.length
  if (total === 0) return null
  const completadas = tareas.filter((t) => t.estado === "COMPLETADA" || t.estado === "OMITIDA").length
  const pct = Math.round((completadas / total) * 100)
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-[#E8593C] h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span>{completadas}/{total}</span>
    </div>
  )
}

function AprobarRechazarDialog({
  tarea,
  ejecucionId,
  onClose,
  onSuccess,
}: {
  tarea: EjecucionTareaItem
  ejecucionId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [motivo, setMotivo] = useState("")
  const [loading, setLoading] = useState(false)
  const [accion, setAccion] = useState<"aprobar" | "rechazar" | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!accion) return
    if (accion === "rechazar" && !motivo.trim()) return
    setLoading(true)
    try {
      const body: Record<string, unknown> = { accion }
      if (accion === "rechazar") body.motivo_rechazo = motivo.trim()
      await fetch(`/api/operaciones/ejecuciones/${ejecucionId}/tareas/${tarea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }, [accion, motivo, ejecucionId, tarea.id, onClose, onSuccess])

  const fotoConImagen = tarea.fotos.find((f) => f.imagen_url)
  const iaResult = fotoConImagen?.verificacion_ia as {
    aprobada?: boolean; confianza?: string; observacion?: string; requiere_revision_humana?: boolean
  } | null ?? null

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Validar tarea: {tarea.tarea.nombre}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        {/* Foto subida por el colaborador */}
        {fotoConImagen?.imagen_url && (
          <div className="rounded-xl overflow-hidden border border-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoConImagen.imagen_url}
              alt="Foto de la tarea"
              className="w-full max-h-64 object-cover"
            />
          </div>
        )}

        {/* Resultado IA */}
        {iaResult && (
          <div className={`rounded-lg px-3 py-2 text-sm border ${
            iaResult.aprobada
              ? "bg-green-50 border-green-100 text-green-700"
              : "bg-amber-50 border-amber-100 text-amber-700"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-xs uppercase">IA:</span>
              <span className="text-xs font-medium">
                {iaResult.aprobada ? "Aprobó automáticamente" : "Requiere revisión manual"}
              </span>
              {iaResult.confianza && (
                <span className="text-xs text-gray-400">· confianza {iaResult.confianza}</span>
              )}
            </div>
            {iaResult.observacion && (
              <p className="text-xs">{iaResult.observacion}</p>
            )}
          </div>
        )}

        {tarea.comentario && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">
            Comentario: {tarea.comentario}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant={accion === "aprobar" ? "default" : "outline"}
            className={accion === "aprobar" ? "bg-green-600 hover:bg-green-700 flex-1" : "flex-1"}
            onClick={() => setAccion("aprobar")}
          >
            Aprobar
          </Button>
          <Button
            variant={accion === "rechazar" ? "destructive" : "outline"}
            className="flex-1"
            onClick={() => setAccion("rechazar")}
          >
            Rechazar
          </Button>
        </div>
        {accion === "rechazar" && (
          <Textarea
            placeholder="Motivo del rechazo..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
          />
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button
          disabled={!accion || (accion === "rechazar" && !motivo.trim()) || loading}
          onClick={handleSubmit}
        >
          {loading ? "Guardando..." : "Confirmar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function VerFotoDialog({
  tarea,
  onClose,
}: {
  tarea: EjecucionTareaItem
  onClose: () => void
}) {
  const fotoConImagen = tarea.fotos.find((f) => f.imagen_url)
  const iaResult = fotoConImagen?.verificacion_ia as {
    aprobada?: boolean
    confianza?: string
    observacion?: string
    requiere_revision_humana?: boolean
  } | null ?? null

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="text-base">{tarea.tarea.nombre}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-1">
        {/* Foto */}
        {fotoConImagen?.imagen_url ? (
          <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoConImagen.imagen_url}
              alt="Foto de la tarea"
              className="w-full max-h-72 object-contain"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-gray-50 py-10 text-center text-sm text-gray-400">
            Sin foto disponible
          </div>
        )}

        {/* Observación IA */}
        {iaResult && (
          <div className={`rounded-lg px-3 py-2.5 text-sm border ${
            iaResult.aprobada
              ? "bg-green-50 border-green-100 text-green-700"
              : "bg-amber-50 border-amber-100 text-amber-700"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-[11px] uppercase tracking-wide">
                {iaResult.aprobada ? "✓ IA aprobó" : "⚠ IA no aprobó"}
              </span>
              {iaResult.confianza && (
                <span className="text-[11px] text-gray-400">· confianza {iaResult.confianza}</span>
              )}
            </div>
            {iaResult.observacion && (
              <p className="text-xs leading-relaxed">{iaResult.observacion}</p>
            )}
          </div>
        )}

        {/* Motivo rechazo manual */}
        {tarea.motivo_rechazo && (
          <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-700">
            <span className="font-semibold text-[11px] uppercase tracking-wide block mb-1">Motivo de rechazo</span>
            <p className="text-xs">{tarea.motivo_rechazo}</p>
          </div>
        )}

        {/* Info operario */}
        {tarea.colaborador && (
          <p className="text-xs text-gray-400 text-center">
            Enviado por {tarea.colaborador.nombre} {tarea.colaborador.apellido}
            {tarea.hora_fin && ` · ${format(new Date(tarea.hora_fin), "HH:mm")}`}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function TareaRow({
  et,
  ejecucionId,
  onRefresh,
}: {
  et: EjecucionTareaItem
  ejecucionId: string
  onRefresh: () => void
}) {
  const [validandoOpen, setValidandoOpen] = useState(false)
  const [fotoOpen, setFotoOpen] = useState(false)

  const puedeValidar =
    et.estado === "COMPLETADA" && et.validacion_estado === "PENDIENTE"

  const validLabel =
    et.validacion_estado === "APROBADA"
      ? "Aprobada"
      : et.validacion_estado === "RECHAZADA"
      ? "Rechazada"
      : null

  return (
    <>
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
        <TareaEstadoIcon estado={et.estado} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {et.tarea.nombre}
            </span>
            {et.tarea.punto_fichaje && (
              <span className="text-xs text-gray-400">{et.tarea.punto_fichaje.nombre}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
            {et.colaborador && (
              <span>{et.colaborador.nombre} {et.colaborador.apellido}</span>
            )}
            {et.hora_inicio && (
              <span>· inicio {format(new Date(et.hora_inicio), "HH:mm")}</span>
            )}
            {et.hora_fin && (
              <span>· fin {format(new Date(et.hora_fin), "HH:mm")}</span>
            )}
            {et.fotos.length > 0 && (
              <span>· {et.fotos.length} foto{et.fotos.length !== 1 ? "s" : ""}</span>
            )}
            {et.motivo_salteo && (
              <span className="text-orange-500">· {et.motivo_salteo}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {validLabel && (
            <Badge
              className={cn(
                "text-xs",
                et.validacion_estado === "APROBADA" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}
            >
              {validLabel}
            </Badge>
          )}
          {et.fotos.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => setFotoOpen(true)}
            >
              <Camera size={11} />
              Ver foto
            </Button>
          )}
          {puedeValidar && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setValidandoOpen(true)}>
              Validar
            </Button>
          )}
        </div>
      </div>
      {fotoOpen && (
        <Dialog open onOpenChange={() => setFotoOpen(false)}>
          <VerFotoDialog
            tarea={et}
            onClose={() => setFotoOpen(false)}
          />
        </Dialog>
      )}
      {validandoOpen && (
        <Dialog open onOpenChange={() => setValidandoOpen(false)}>
          <AprobarRechazarDialog
            tarea={et}
            ejecucionId={ejecucionId}
            onClose={() => setValidandoOpen(false)}
            onSuccess={onRefresh}
          />
        </Dialog>
      )}
    </>
  )
}

function EjecucionCard({ ep, onRefresh }: { ep: EjecucionProc; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(ep.estado !== "PENDIENTE")

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{ep.procedimiento.nombre}</span>
            <span className="text-xs text-gray-400">{ep.turno.nombre} · {ep.turno.hora_inicio}–{ep.turno.hora_fin}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ESTADO_PROC_COLOR[ep.estado])}>
              {ep.estado === "PENDIENTE" ? "Pendiente" : ep.estado === "EN_CURSO" ? "En curso" : "Completado"}
            </span>
          </div>
          <div className="mt-1.5">
            <ProgresoBar tareas={ep.tareas} />
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {ep.tareas.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">Sin tareas configuradas.</p>
          ) : (() => {
            const secciones = Array.from(new Set(ep.tareas.map((t) => t.tarea.seccion ?? "")))
            const tienesSecciones = secciones.some((s) => s !== "")
            if (!tienesSecciones) {
              return (
                <div className="divide-y divide-gray-50">
                  {ep.tareas.map((et) => (
                    <TareaRow key={et.id} et={et} ejecucionId={ep.id} onRefresh={onRefresh} />
                  ))}
                </div>
              )
            }
            return secciones.map((sec) => {
              const tareasDeSec = ep.tareas.filter((t) => (t.tarea.seccion ?? "") === sec)
              const completadasSec = tareasDeSec.filter((t) => t.estado === "COMPLETADA" || t.estado === "OMITIDA").length
              return (
                <div key={sec} className="border-t border-gray-100 first:border-t-0">
                  <div className="px-4 py-1.5 bg-gray-50 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex-1">
                      {sec || "General"}
                    </span>
                    <span className="text-[10px] text-gray-400">{completadasSec}/{tareasDeSec.length}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {tareasDeSec.map((et) => (
                      <TareaRow key={et.id} et={et} ejecucionId={ep.id} onRefresh={onRefresh} />
                    ))}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}

export function OperacionesDashboard() {
  const router = useRouter()
  const pathname = usePathname()
  const slug = pathname.split("/")[1]

  const [tab, setTab] = useState<"hoy" | "historial">("hoy")
  const [fecha, setFecha] = useState(() => {
    const d = new Date()
    d.setTime(d.getTime() - 3 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const [ejecuciones, setEjecuciones] = useState<EjecucionProc[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const cargar = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const res = await fetch(`/api/operaciones/ejecuciones?fecha=${fecha}`)
      if (res.ok) {
        const data = await res.json() as { ejecuciones: EjecucionProc[] }
        setEjecuciones(data.ejecuciones)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fecha])

  useEffect(() => {
    setLoading(true)
    cargar()
  }, [cargar])

  // Auto-refresh cada 60s
  useEffect(() => {
    const t = setInterval(() => cargar(), 60_000)
    return () => clearInterval(t)
  }, [cargar])

  const kpis = ejecuciones
    ? {
        total: ejecuciones.length,
        completados: ejecuciones.filter((e) => e.estado === "COMPLETADO").length,
        enCurso: ejecuciones.filter((e) => e.estado === "EN_CURSO").length,
        tareasPendValidacion: ejecuciones
          .flatMap((e) => e.tareas)
          .filter((t) => t.estado === "COMPLETADA" && t.validacion_estado === "PENDIENTE").length,
      }
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operaciones</h1>
          {tab === "hoy" && (
            <p className="text-sm text-gray-500 mt-0.5 capitalize">
              {format(new Date(fecha + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tab === "hoy" && (
            <>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => cargar(true)}
                disabled={refreshing}
                className="gap-1.5"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                Actualizar
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/${slug}/operaciones/configuracion`)}
            className="gap-1.5"
          >
            <Settings size={14} />
            Configurar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("hoy")}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
            tab === "hoy" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          )}
        >
          Hoy
        </button>
        <button
          onClick={() => setTab("historial")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
            tab === "historial" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <BarChart2 size={14} />
          Historial
        </button>
      </div>

      {tab === "historial" && <HistorialTab />}

      {tab === "hoy" && <>
      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Procedimientos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.total}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-600">Completados</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{kpis.completados}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-600">En curso</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{kpis.enCurso}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-600">Pend. validación</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{kpis.tareasPendValidacion}</p>
          </div>
        </div>
      )}

      {/* Lista de ejecuciones */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : ejecuciones === null ? (
        <p className="text-sm text-gray-500">Error al cargar datos.</p>
      ) : ejecuciones.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay procedimientos programados para este día.</p>
          <p className="text-xs mt-1">Configurá turnos y procedimientos para comenzar.</p>
          <Button
            size="sm"
            className="mt-4 bg-[#E8593C] hover:bg-[#D04828]"
            onClick={() => router.push(`/${slug}/operaciones/configuracion`)}
          >
            Ir a Configuración
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {ejecuciones.map((ep) => (
            <EjecucionCard key={ep.id} ep={ep} onRefresh={() => cargar()} />
          ))}
        </div>
      )}
      </>}
    </div>
  )
}
