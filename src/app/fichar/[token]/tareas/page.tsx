"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  CheckCircle2, Circle, Clock, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Loader2, ArrowLeft, Camera, MessageSquare, ListChecks,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const STORAGE_ID = "fichar_colaborador_id"
const STORAGE_NOMBRE = "fichar_colaborador_nombre"
const STORAGE_APELLIDO = "fichar_colaborador_apellido"

type EstadoTarea = "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "OMITIDA" | "NO_REALIZADA"

interface ChecklistItem { texto: string; orden: number }
interface ChecklistResp { texto: string; marcado: boolean }

interface TareaInfo {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
  es_critica: boolean
  es_omitible: boolean
  foto_min: number
  foto_max: number
  foto_instruccion: string | null
  requiere_comentario: boolean
  checklist_items: ChecklistItem[] | null
  tiempo_estimado_min: number | null
}

interface EjecucionTareaItem {
  id: string
  estado: EstadoTarea
  hora_inicio: string | null
  hora_fin: string | null
  colaborador: { id: string; nombre: string; apellido: string } | null
  fotos: { id: string; estado_subida: string }[]
  tarea: TareaInfo
}

interface EjecucionProc {
  id: string
  estado: string
  procedimiento: { nombre: string }
  turno: { nombre: string; hora_inicio: string; hora_fin: string }
  tareas: EjecucionTareaItem[]
}

interface PageData {
  ejecuciones: EjecucionProc[]
  punto: { id: string; nombre: string }
  empresa_id: string
  fecha: string
}

function EstadoIcon({ estado }: { estado: EstadoTarea }) {
  if (estado === "COMPLETADA") return <CheckCircle2 size={20} className="text-green-500 shrink-0" />
  if (estado === "EN_CURSO") return <Clock size={20} className="text-blue-500 shrink-0 animate-pulse" />
  if (estado === "OMITIDA") return <XCircle size={20} className="text-orange-400 shrink-0" />
  if (estado === "NO_REALIZADA") return <AlertTriangle size={20} className="text-red-500 shrink-0" />
  return <Circle size={20} className="text-gray-300 shrink-0" />
}

function TareaCard({
  et,
  ejecucionId,
  colaboradorId,
  empresaId,
  onRefresh,
}: {
  et: EjecucionTareaItem
  ejecucionId: string
  colaboradorId: string
  empresaId: string
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(et.estado === "EN_CURSO")
  const [comentario, setComentario] = useState("")
  const [motivo, setMotivo] = useState("")
  const [checklist, setChecklist] = useState<ChecklistResp[]>(
    (et.tarea.checklist_items ?? []).map((i) => ({ texto: i.texto, marcado: false }))
  )
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")

  const patchTarea = useCallback(async (body: Record<string, unknown>) => {
    setCargando(true)
    setError("")
    try {
      const res = await fetch(
        `/api/operaciones/ejecuciones/${ejecucionId}/tareas/${et.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, colaborador_id: colaboradorId }),
        }
      )
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? "Error al guardar")
        return
      }
      onRefresh()
    } catch {
      setError("Error de conexión")
    } finally {
      setCargando(false)
    }
  }, [ejecucionId, et.id, colaboradorId, onRefresh])

  const iniciar = () => patchTarea({ accion: "iniciar" })

  const completar = useCallback(async () => {
    if (et.tarea.requiere_comentario && !comentario.trim()) {
      setError("El comentario es requerido")
      return
    }
    const body: Record<string, unknown> = {
      accion: "completar",
      comentario: comentario.trim() || null,
    }
    if (checklist.length > 0) body.checklist_completado = checklist

    // Intentar GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          body.latitud = pos.coords.latitude
          body.longitud = pos.coords.longitude
          patchTarea(body)
        },
        () => patchTarea(body),
        { timeout: 5000 }
      )
    } else {
      patchTarea(body)
    }
  }, [comentario, checklist, et.tarea.requiere_comentario, patchTarea])

  const omitir = () => {
    if (!motivo.trim()) { setError("Indicá el motivo"); return }
    patchTarea({ accion: "omitir", motivo_salteo: motivo.trim() })
  }

  const registrarFotoStub = useCallback(async () => {
    const res = await fetch("/api/operaciones/fotos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ejecucion_tarea_id: et.id,
        empresa_id: empresaId,
        colaborador_id: colaboradorId,
      }),
    })
    if (res.ok) {
      setError("Foto registrada (upload real pendiente con R2)")
      onRefresh()
    }
  }, [et.id, empresaId, colaboradorId, onRefresh])

  const hecho = et.estado === "COMPLETADA" || et.estado === "OMITIDA" || et.estado === "NO_REALIZADA"

  return (
    <div className={cn(
      "bg-white rounded-2xl border overflow-hidden transition-all",
      et.estado === "EN_CURSO" ? "border-blue-300 shadow-md" : "border-gray-200",
      hecho && "opacity-75"
    )}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        <EstadoIcon estado={et.estado} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "font-semibold text-sm",
              et.tarea.es_critica ? "text-red-700" : "text-gray-900"
            )}>
              {et.tarea.nombre}
            </span>
            {et.tarea.es_critica && (
              <span className="text-[10px] bg-red-100 text-red-600 rounded px-1.5 py-0.5 font-bold">CRÍTICA</span>
            )}
            {et.tarea.tiempo_estimado_min && (
              <span className="text-xs text-gray-400">{et.tarea.tiempo_estimado_min} min</span>
            )}
          </div>
          {et.tarea.descripcion && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{et.tarea.descripcion}</p>
          )}
          {et.estado === "EN_CURSO" && et.hora_inicio && (
            <p className="text-xs text-blue-500 mt-0.5">
              Iniciada a las {new Date(et.hora_inicio).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {expanded && !hecho && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          {/* Indicadores */}
          <div className="flex gap-3 mt-3 text-xs text-gray-500">
            {et.tarea.foto_min > 0 && (
              <span className="flex items-center gap-1">
                <Camera size={12} />
                {et.fotos.filter((f) => f.estado_subida === "COMPLETA").length}/{et.tarea.foto_min} fotos
              </span>
            )}
            {et.tarea.requiere_comentario && (
              <span className="flex items-center gap-1">
                <MessageSquare size={12} />
                Comentario requerido
              </span>
            )}
            {et.tarea.checklist_items && et.tarea.checklist_items.length > 0 && (
              <span className="flex items-center gap-1">
                <ListChecks size={12} />
                {et.tarea.checklist_items.length} pasos
              </span>
            )}
          </div>

          {/* Checklist */}
          {checklist.length > 0 && et.estado === "EN_CURSO" && (
            <div className="space-y-2 bg-gray-50 rounded-xl p-3">
              {checklist.map((item, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.marcado}
                    onChange={(e) => {
                      const next = [...checklist]
                      next[i] = { ...next[i], marcado: e.target.checked }
                      setChecklist(next)
                    }}
                    className="w-4 h-4 rounded accent-[#E8593C]"
                  />
                  <span className={cn("text-sm", item.marcado && "line-through text-gray-400")}>
                    {item.texto}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Comentario */}
          {et.estado === "EN_CURSO" && (
            <Textarea
              placeholder={et.tarea.requiere_comentario ? "Comentario (requerido)..." : "Comentario opcional..."}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              className="text-sm"
            />
          )}

          {/* Fotos stub */}
          {et.estado === "EN_CURSO" && et.tarea.foto_max > 0 && (
            <div className="space-y-1">
              {et.tarea.foto_instruccion && (
                <p className="text-xs text-gray-500">{et.tarea.foto_instruccion}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 w-full"
                onClick={registrarFotoStub}
                disabled={et.fotos.length >= et.tarea.foto_max}
              >
                <Camera size={14} />
                Agregar foto ({et.fotos.length}/{et.tarea.foto_max})
              </Button>
            </div>
          )}

          {/* Motivo omisión */}
          {et.tarea.es_omitible && et.estado === "EN_CURSO" && (
            <div className="space-y-1">
              <Textarea
                placeholder="Motivo para omitir..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 w-full"
                onClick={omitir}
                disabled={cargando}
              >
                Omitir tarea
              </Button>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Acciones */}
          <div className="flex gap-2">
            {et.estado === "PENDIENTE" && (
              <Button
                className="flex-1 bg-[#E8593C] hover:bg-[#D04828]"
                onClick={iniciar}
                disabled={cargando}
              >
                {cargando ? <Loader2 size={16} className="animate-spin" /> : "Iniciar"}
              </Button>
            )}
            {et.estado === "EN_CURSO" && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={completar}
                disabled={cargando}
              >
                {cargando ? <Loader2 size={16} className="animate-spin" /> : "Marcar completada"}
              </Button>
            )}
          </div>
        </div>
      )}

      {expanded && hecho && (
        <div className="px-4 pb-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mt-2">
            {et.estado === "COMPLETADA" && "Tarea completada"}
            {et.estado === "OMITIDA" && `Omitida: ${et.tarea.es_omitible ? "permitido" : ""}`}
            {et.estado === "NO_REALIZADA" && "No realizada"}
            {et.hora_fin && ` · ${new Date(et.hora_fin).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
      )}
    </div>
  )
}

export default function TareasPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [colaboradorId, setColaboradorId] = useState<string | null>(null)
  const [colaboradorNombre, setColaboradorNombre] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_ID)
    const nombre = localStorage.getItem(STORAGE_NOMBRE)
    const apellido = localStorage.getItem(STORAGE_APELLIDO)
    if (!id || !nombre) {
      router.replace(`/fichar/${token}`)
      return
    }
    setColaboradorId(id)
    setColaboradorNombre(`${nombre} ${apellido ?? ""}`.trim())
  }, [token, router])

  const cargar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/operaciones/tareas-pwa?token=${token}`)
      if (!res.ok) { setError("No se pudieron cargar las tareas"); return }
      const d = await res.json() as PageData
      setData(d)
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (colaboradorId) cargar()
  }, [colaboradorId, cargar])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#E8593C]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-gray-500 text-sm">{error}</p>
        <Button variant="outline" onClick={() => router.replace(`/fichar/${token}`)}>
          Volver
        </Button>
      </div>
    )
  }

  const todasTareas = data?.ejecuciones.flatMap((e) => e.tareas) ?? []
  const completadas = todasTareas.filter((t) => t.estado === "COMPLETADA" || t.estado === "OMITIDA").length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">
              {data?.punto.nombre ?? "Tareas del día"}
            </h1>
            <p className="text-xs text-gray-500 truncate">{colaboradorNombre}</p>
          </div>
          {todasTareas.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-1 shrink-0">
              {completadas}/{todasTareas.length}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {!data || data.ejecuciones.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">No hay tareas asignadas para hoy en este punto.</p>
          </div>
        ) : (
          data.ejecuciones.map((ep) => (
            <div key={ep.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {ep.procedimiento.nombre}
                </h2>
                <span className="text-xs text-gray-400">
                  {ep.turno.hora_inicio}–{ep.turno.hora_fin}
                </span>
              </div>
              {ep.tareas.map((et) => (
                <TareaCard
                  key={et.id}
                  et={et}
                  ejecucionId={ep.id}
                  colaboradorId={colaboradorId!}
                  empresaId={data.empresa_id}
                  onRefresh={cargar}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
