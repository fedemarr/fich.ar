"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { RefreshCw, Settings, ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle, AlertTriangle, Circle, ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type EstadoTarea = "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "OMITIDA" | "NO_REALIZADA"
type ValidacionEstado = "PENDIENTE" | "APROBADA" | "RECHAZADA"
type EstadoProc = "PENDIENTE" | "EN_CURSO" | "COMPLETADO"

interface Foto {
  id: string
  key: string | null
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

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Validar tarea: {tarea.tarea.nombre}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
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
            <span className={cn("font-medium truncate", et.tarea.es_critica && "text-red-600")}>
              {et.tarea.nombre}
            </span>
            {et.tarea.es_critica && (
              <Badge variant="destructive" className="text-[10px] py-0 px-1">crítica</Badge>
            )}
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
          {puedeValidar && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setValidandoOpen(true)}>
              Validar
            </Button>
          )}
        </div>
      </div>
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
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {ep.tareas.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">Sin tareas configuradas.</p>
          ) : (
            ep.tareas.map((et) => (
              <TareaRow key={et.id} et={et} ejecucionId={ep.id} onRefresh={onRefresh} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function OperacionesDashboard() {
  const router = useRouter()
  const pathname = usePathname()
  const slug = pathname.split("/")[1]

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
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {format(new Date(fecha + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
    </div>
  )
}
