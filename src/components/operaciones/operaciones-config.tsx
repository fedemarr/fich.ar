"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ArrowLeft, Plus, Pencil, Trash2, GripVertical, ChevronDown, ChevronRight, QrCode, Download } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const DIAS_LABELS = [
  { key: "lunes", label: "L" },
  { key: "martes", label: "M" },
  { key: "miercoles", label: "Mi" },
  { key: "jueves", label: "J" },
  { key: "viernes", label: "V" },
  { key: "sabado", label: "S" },
  { key: "domingo", label: "D" },
]

interface Turno {
  id: string
  nombre: string
  hora_inicio: string
  hora_fin: string
  activo: boolean
  punto_nombre: string | null
  punto_id: string | null
}

interface Tarea {
  id: string
  nombre: string
  descripcion: string | null
  seccion: string | null
  orden: number
  foto_min: number
  foto_max: number
  requiere_comentario: boolean
  tiempo_estimado_min: number | null
  punto_fichaje: { id: string; nombre: string } | null
  criterio_verificacion: string | null
  activo: boolean
}

interface Procedimiento {
  id: string
  nombre: string
  turno: { id: string; nombre: string; hora_inicio: string; hora_fin: string }
  lunes: boolean; martes: boolean; miercoles: boolean; jueves: boolean; viernes: boolean; sabado: boolean; domingo: boolean
  activo: boolean
  _count: { tareas: number }
}

interface ProcedimientoDetalle extends Procedimiento {
  tareas: Tarea[]
}

interface PuntoFichaje {
  id: string
  nombre: string
  operaciones_token: string
}

// ─── Turnos ───────────────────────────────────────────────────────────────────

function TurnoDialog({
  turno,
  onClose,
  onSaved,
}: {
  turno?: Turno
  onClose: () => void
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState(turno?.nombre ?? "")
  const [inicio, setInicio] = useState(turno?.hora_inicio ?? "09:00")
  const [fin, setFin] = useState(turno?.hora_fin ?? "18:00")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSave = useCallback(async () => {
    if (!nombre.trim()) return setError("El nombre es requerido")
    setLoading(true)
    setError("")
    const url = turno ? `/api/operaciones/turnos/${turno.id}` : "/api/operaciones/turnos"
    const method = turno ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), hora_inicio: inicio, hora_fin: fin }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? "Error al guardar")
      return
    }
    onSaved()
    onClose()
  }, [nombre, inicio, fin, turno, onClose, onSaved])

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{turno ? "Editar turno" : "Nuevo turno"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Mañana" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Hora inicio</Label>
            <Input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hora fin</Label>
            <Input type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ─── Tarea Dialog ─────────────────────────────────────────────────────────────

function TareaDialog({
  tarea,
  procedimientoId,
  puntos,
  onClose,
  onSaved,
  seccionInicial,
}: {
  tarea?: Tarea
  procedimientoId: string
  puntos: PuntoFichaje[]
  onClose: () => void
  onSaved: () => void
  seccionInicial?: string
}) {
  const [nombre, setNombre] = useState(tarea?.nombre ?? "")
  const [seccion, setSeccion] = useState(tarea?.seccion ?? seccionInicial ?? "")
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? "")
  const [criterioVerificacion, setCriterioVerificacion] = useState(tarea?.criterio_verificacion ?? "")
  const [fotoMin, setFotoMin] = useState(String(tarea?.foto_min ?? 1))
  const [fotoMax, setFotoMax] = useState(String(tarea?.foto_max ?? 5))
  const [requiereComentario, setRequiereComentario] = useState(tarea?.requiere_comentario ?? false)
  const [tiempoEst, setTiempoEst] = useState(String(tarea?.tiempo_estimado_min ?? ""))
  const [puntoId, setPuntoId] = useState(tarea?.punto_fichaje?.id ?? "ninguno")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSave = useCallback(async () => {
    if (!nombre.trim()) return setError("El nombre es requerido")
    setLoading(true)
    setError("")
    const body: Record<string, unknown> = {
      nombre: nombre.trim(),
      seccion: seccion.trim() || null,
      descripcion: descripcion.trim() || null,
      criterio_verificacion: criterioVerificacion.trim() || null,
      es_critica: false,
      es_omitible: false,
      foto_min: Number(fotoMin),
      foto_max: Number(fotoMax),
      requiere_comentario: requiereComentario,
      tiempo_estimado_min: tiempoEst ? Number(tiempoEst) : null,
      punto_fichaje_id: puntoId !== "ninguno" ? puntoId : null,
    }
    const url = tarea
      ? `/api/operaciones/procedimientos/${procedimientoId}/tareas/${tarea.id}`
      : `/api/operaciones/procedimientos/${procedimientoId}/tareas`
    const method = tarea ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? "Error al guardar")
      return
    }
    onSaved()
    onClose()
  }, [nombre, descripcion, criterioVerificacion, fotoMin, fotoMax, requiereComentario, tiempoEst, puntoId, tarea, procedimientoId, onClose, onSaved])

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{tarea ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Limpiar sala" />
        </div>
        <div className="space-y-1">
          <Label>Sección / Mini-procedimiento <span className="text-gray-400 font-normal">(opcional)</span></Label>
          <Input value={seccion} onChange={(e) => setSeccion(e.target.value)} placeholder="Ej: Piso 1, Baños, Zona A..." />
          <p className="text-xs text-gray-400">Agrupa tareas bajo un mismo mini-procedimiento dentro de este procedimiento</p>
        </div>
        <div className="space-y-1">
          <Label>Descripción (opcional)</Label>
          <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
        </div>
        <div className="space-y-1">
          <Label>Criterio de verificación IA (opcional)</Label>
          <Textarea
            value={criterioVerificacion}
            onChange={(e) => setCriterioVerificacion(e.target.value)}
            rows={2}
            placeholder="Ej: El piso debe estar limpio y seco, sin residuos visibles"
          />
          <p className="text-xs text-gray-400">Le indica a la IA qué verificar en la foto del colaborador</p>
        </div>
        <div className="space-y-1">
          <Label>Punto de fichaje (opcional)</Label>
          <Select value={puntoId} onValueChange={(v) => setPuntoId(v ?? "ninguno")}>
            <SelectTrigger>
              <SelectValue placeholder="Sin punto específico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ninguno">Sin punto específico</SelectItem>
              {puntos.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Fotos mínimas</Label>
            <Input type="number" min={0} max={10} value={fotoMin} onChange={(e) => setFotoMin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fotos máximas</Label>
            <Input type="number" min={0} max={10} value={fotoMax} onChange={(e) => setFotoMax(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Tiempo estimado (min)</Label>
          <Input type="number" min={1} value={tiempoEst} onChange={(e) => setTiempoEst(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="flex items-center justify-between">
          <Label>Requiere comentario</Label>
          <Switch checked={requiereComentario} onCheckedChange={setRequiereComentario} />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ─── Procedimiento Dialog ─────────────────────────────────────────────────────

type DiaKey = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo"

function ProcedimientoDialog({
  proc,
  turnos,
  onClose,
  onSaved,
}: {
  proc?: Procedimiento
  turnos: Turno[]
  onClose: () => void
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState(proc?.nombre ?? "")
  const [turnoId, setTurnoId] = useState(proc?.turno.id ?? "")
  const [dias, setDias] = useState<Record<DiaKey, boolean>>({
    lunes: proc?.lunes ?? false,
    martes: proc?.martes ?? false,
    miercoles: proc?.miercoles ?? false,
    jueves: proc?.jueves ?? false,
    viernes: proc?.viernes ?? false,
    sabado: proc?.sabado ?? false,
    domingo: proc?.domingo ?? false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const toggleDia = (dia: DiaKey) => setDias((prev) => ({ ...prev, [dia]: !prev[dia] }))

  const handleSave = useCallback(async () => {
    if (!nombre.trim()) return setError("El nombre es requerido")
    if (!turnoId) return setError("Seleccioná una jornada")
    setLoading(true)
    setError("")
    // Auto-derivar punto_fichaje_id del turno seleccionado
    const turnoSeleccionado = turnos.find((t) => t.id === turnoId)
    const puntoFichajeId = turnoSeleccionado?.punto_id ?? null
    const url = proc ? `/api/operaciones/procedimientos/${proc.id}` : "/api/operaciones/procedimientos"
    const method = proc ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), turno_id: turnoId, punto_fichaje_id: puntoFichajeId, ...dias }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? "Error al guardar")
      return
    }
    onSaved()
    onClose()
  }, [nombre, turnoId, dias, turnos, proc, onClose, onSaved])

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{proc ? "Editar procedimiento" : "Nuevo procedimiento"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Limpieza diaria" />
        </div>
        <div className="space-y-1">
          <Label>Jornada</Label>
          <Select value={turnoId} onValueChange={(v) => setTurnoId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar jornada" />
            </SelectTrigger>
            <SelectContent>
              {turnos.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nombre} ({t.hora_inicio}–{t.hora_fin}){t.punto_nombre ? ` · ${t.punto_nombre}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Días activos</Label>
          <div className="flex gap-1 mt-1">
            {DIAS_LABELS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleDia(key as DiaKey)}
                className={cn(
                  "w-8 h-8 rounded-full text-xs font-semibold transition-colors",
                  dias[key as DiaKey]
                    ? "bg-[#E8593C] text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ─── Procedimiento Row con tareas ─────────────────────────────────────────────

function ProcedimientoRow({
  proc,
  turnos,
  puntos,
  onRefresh,
}: {
  proc: Procedimiento
  turnos: Turno[]
  puntos: PuntoFichaje[]
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [detalle, setDetalle] = useState<ProcedimientoDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [editando, setEditando] = useState(false)
  const [nuevaTarea, setNuevaTarea] = useState(false)
  const [nuevaTareaSeccion, setNuevaTareaSeccion] = useState<string | null>(null)
  const [nuevaSeccionInput, setNuevaSeccionInput] = useState(false)
  const [nuevaSeccionNombre, setNuevaSeccionNombre] = useState("")
  const [tareaEditando, setTareaEditando] = useState<Tarea | null>(null)

  const cargarDetalle = useCallback(async () => {
    setLoadingDetalle(true)
    const res = await fetch(`/api/operaciones/procedimientos/${proc.id}`)
    if (res.ok) {
      const d = await res.json() as { procedimiento: ProcedimientoDetalle }
      setDetalle(d.procedimiento)
    }
    setLoadingDetalle(false)
  }, [proc.id])

  const handleExpand = () => {
    if (!expanded && !detalle) cargarDetalle()
    setExpanded((p) => !p)
  }

  const handleDeleteTarea = useCallback(async (tareaId: string) => {
    await fetch(`/api/operaciones/procedimientos/${proc.id}/tareas/${tareaId}`, { method: "DELETE" })
    cargarDetalle()
  }, [proc.id, cargarDetalle])

  const handleDeleteProc = useCallback(async () => {
    if (!confirm(`¿Eliminar "${proc.nombre}"?`)) return
    await fetch(`/api/operaciones/procedimientos/${proc.id}`, { method: "DELETE" })
    onRefresh()
  }, [proc.id, proc.nombre, onRefresh])

  const diasActivos = DIAS_LABELS.filter(({ key }) => proc[key as DiaKey]).map(({ label }) => label)

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={handleExpand} className="flex-1 flex items-center gap-3 text-left">
            {expanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-900">{proc.nombre}</span>
                <span className="text-xs text-gray-400">{proc.turno.nombre} · {proc.turno.hora_inicio}–{proc.turno.hora_fin}</span>
                <Badge variant="secondary" className="text-xs">{proc._count.tareas} tareas</Badge>
              </div>
              {diasActivos.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {diasActivos.map((d) => (
                    <span key={d} className="text-[10px] bg-[#FEF3F0] text-[#E8593C] rounded px-1 font-semibold">{d}</span>
                  ))}
                </div>
              )}
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditando(true)}>
              <Pencil size={13} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={handleDeleteProc}>
              <Trash2 size={13} />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-gray-100">
            {loadingDetalle ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (() => {
              const tareas = detalle?.tareas ?? []
              const secciones = Array.from(new Set(tareas.map((t) => t.seccion ?? "")))
              const tienesSecciones = secciones.some((s) => s !== "")

              const renderTarea = (tarea: Tarea, indentado = false) => (
                <div key={tarea.id} className={cn("flex items-center gap-2 py-2 hover:bg-gray-50", indentado ? "px-6" : "px-4")}>
                  <GripVertical size={14} className="text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{tarea.nombre}</span>
                      {tarea.punto_fichaje && <span className="text-xs text-gray-400">{tarea.punto_fichaje.nombre}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                      {tarea.foto_min > 0 && <span>{tarea.foto_min}–{tarea.foto_max} fotos</span>}
                      {tarea.tiempo_estimado_min && <span>{tarea.tiempo_estimado_min} min</span>}
                      {tarea.requiere_comentario && <span>comentario requerido</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTareaEditando(tarea)}>
                      <Pencil size={12} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => handleDeleteTarea(tarea.id)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              )

              return (
                <div>
                  {tienesSecciones
                    ? secciones.map((sec) => {
                        const tareasDeSec = tareas.filter((t) => (t.seccion ?? "") === sec)
                        return (
                          <div key={sec} className="border-b border-gray-50 last:border-0">
                            {/* Header de sección */}
                            <div className="px-4 py-1.5 bg-gray-50 flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex-1">
                                {sec || "Sin sección"}
                              </span>
                              <span className="text-[10px] text-gray-400 mr-1">{tareasDeSec.length} tarea{tareasDeSec.length !== 1 ? "s" : ""}</span>
                              <button
                                className="text-[11px] text-[#E8593C] hover:underline font-medium flex items-center gap-0.5 px-1"
                                onClick={() => setNuevaTareaSeccion(sec)}
                              >
                                <Plus size={11} /> tarea
                              </button>
                            </div>
                            {/* Tareas de la sección */}
                            <div className="divide-y divide-gray-50">
                              {tareasDeSec.map((t) => renderTarea(t, true))}
                            </div>
                          </div>
                        )
                      })
                    : (
                      <div className="divide-y divide-gray-50">
                        {tareas.map((t) => renderTarea(t, false))}
                      </div>
                    )
                  }

                  {/* Footer con botones */}
                  <div className="px-4 py-2.5 flex items-center gap-2 border-t border-gray-50">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setNuevaTarea(true)}>
                      <Plus size={12} />
                      Agregar tarea
                    </Button>
                    {/* Input inline para nueva sección */}
                    {nuevaSeccionInput ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          autoFocus
                          className="h-7 text-xs"
                          placeholder="Nombre de la sección (ej: Piso 1)"
                          value={nuevaSeccionNombre}
                          onChange={(e) => setNuevaSeccionNombre(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && nuevaSeccionNombre.trim()) {
                              setNuevaTareaSeccion(nuevaSeccionNombre.trim())
                              setNuevaSeccionInput(false)
                              setNuevaSeccionNombre("")
                            }
                            if (e.key === "Escape") {
                              setNuevaSeccionInput(false)
                              setNuevaSeccionNombre("")
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-[#E8593C] hover:bg-[#D04828]"
                          disabled={!nuevaSeccionNombre.trim()}
                          onClick={() => {
                            if (nuevaSeccionNombre.trim()) {
                              setNuevaTareaSeccion(nuevaSeccionNombre.trim())
                              setNuevaSeccionInput(false)
                              setNuevaSeccionNombre("")
                            }
                          }}
                        >
                          Crear
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setNuevaSeccionInput(false); setNuevaSeccionNombre("") }}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs text-[#E8593C] border-[#E8593C] hover:bg-orange-50" onClick={() => setNuevaSeccionInput(true)}>
                        <Plus size={12} />
                        Nueva sección
                      </Button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {editando && (
        <Dialog open onOpenChange={() => setEditando(false)}>
          <ProcedimientoDialog proc={proc} turnos={turnos} onClose={() => setEditando(false)} onSaved={onRefresh} />
        </Dialog>
      )}

      {nuevaTarea && (
        <Dialog open onOpenChange={() => setNuevaTarea(false)}>
          <TareaDialog
            procedimientoId={proc.id}
            puntos={puntos}
            onClose={() => setNuevaTarea(false)}
            onSaved={() => { cargarDetalle(); onRefresh() }}
          />
        </Dialog>
      )}

      {nuevaTareaSeccion !== null && (
        <Dialog open onOpenChange={() => setNuevaTareaSeccion(null)}>
          <TareaDialog
            procedimientoId={proc.id}
            puntos={puntos}
            seccionInicial={nuevaTareaSeccion}
            onClose={() => setNuevaTareaSeccion(null)}
            onSaved={() => { cargarDetalle(); onRefresh(); setNuevaTareaSeccion(null) }}
          />
        </Dialog>
      )}

      {tareaEditando && (
        <Dialog open onOpenChange={() => setTareaEditando(null)}>
          <TareaDialog
            tarea={tareaEditando}
            procedimientoId={proc.id}
            puntos={puntos}
            onClose={() => setTareaEditando(null)}
            onSaved={() => { cargarDetalle(); onRefresh() }}
          />
        </Dialog>
      )}
    </>
  )
}

// ─── Main Config ──────────────────────────────────────────────────────────────

// ─── QR Operaciones Dialog ────────────────────────────────────────────────────

function QrOperacionesDialog({
  punto,
  onClose,
}: {
  punto: PuntoFichaje
  onClose: () => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fich.ar"
  const url = `${appUrl}/op/${punto.operaciones_token}`

  function svgToPngDataUrl(size: number): Promise<string> {
    return new Promise((resolve) => {
      const svg = svgRef.current
      if (!svg) { resolve(""); return }
      const xml = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement("canvas")
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext("2d")!
      const img = new Image()
      img.onload = () => {
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, 0, 0, size, size)
        resolve(canvas.toDataURL("image/png"))
      }
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)))
    })
  }

  async function descargar() {
    const dataUrl = await svgToPngDataUrl(320)
    const link = document.createElement("a")
    link.download = `qr-op-${punto.nombre.toLowerCase().replace(/\s+/g, "-")}.png`
    link.href = dataUrl
    link.click()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Operaciones — {punto.nombre}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl border border-gray-100 p-4 bg-white">
            <QRCodeSVG
              ref={svgRef}
              value={url}
              size={240}
              bgColor="#ffffff"
              fgColor="#E8593C"
              level="H"
            />
          </div>
          <p className="text-xs text-gray-400 text-center break-all">{url}</p>
          <p className="text-xs text-gray-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-center w-full">
            El asociado escanea este QR para ver y completar las tareas del día con verificación por foto
          </p>
          <Button
            className="w-full gap-2 bg-[#E8593C] hover:bg-[#D04828] text-white"
            onClick={descargar}
          >
            <Download size={15} />
            Descargar PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Config ──────────────────────────────────────────────────────────────

export function OperacionesConfig() {
  const router = useRouter()
  const pathname = usePathname()
  const slug = pathname.split("/")[1]

  const [turnos, setTurnos] = useState<Turno[]>([])
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([])
  const [puntos, setPuntos] = useState<PuntoFichaje[]>([])
  const [loading, setLoading] = useState(true)

  const [nuevoProcedimiento, setNuevoProcedimiento] = useState(false)
  const [puntoQr, setPuntoQr] = useState<PuntoFichaje | null>(null)

  const cargar = useCallback(async () => {
    // /api/operaciones/jornadas auto-sincroniza Jornadas → Turnos y devuelve los turnos enriquecidos
    const [rJornadas, rProcs, rPuntos] = await Promise.all([
      fetch("/api/operaciones/jornadas"),
      fetch("/api/operaciones/procedimientos"),
      fetch("/api/puntos"),
    ])
    const [dJornadas, dProcs, dPuntos] = await Promise.all([
      rJornadas.json() as Promise<{ turnos: Turno[] }>,
      rProcs.json() as Promise<{ procedimientos: Procedimiento[] }>,
      rPuntos.json() as Promise<{ puntos: PuntoFichaje[] }>,
    ])
    setTurnos(dJornadas.turnos ?? [])
    setProcedimientos(dProcs.procedimientos ?? [])
    setPuntos(dPuntos.puntos ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${slug}/operaciones`)}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurar Operaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Turnos, procedimientos y tareas</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Jornadas sincronizadas como turnos */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Jornadas disponibles</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Se sincronizan desde las jornadas de Puntos QR. Podés quitar las que no uses en operaciones.
              </p>
            </div>
            {turnos.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                No hay jornadas configuradas. Creá una en <strong>Puntos QR → Jornadas</strong> primero.
              </p>
            ) : (
              <div className="space-y-2">
                {turnos.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                    <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{t.nombre}</p>
                      <p className="text-xs text-gray-400">
                        {t.hora_inicio} – {t.hora_fin}
                        {t.punto_nombre && <span className="ml-2">· {t.punto_nombre}</span>}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-600"
                      onClick={async () => {
                        if (!confirm(`¿Quitar "${t.nombre}" de operaciones?`)) return
                        await fetch(`/api/operaciones/turnos/${t.id}`, { method: "DELETE" })
                        cargar()
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* QRs de Operaciones por punto */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">QR Operaciones por punto</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Imprimí y pegá el QR en cada punto. El asociado lo escanea para ver sus tareas del día.
              </p>
            </div>
            {puntos.length === 0 ? (
              <p className="text-sm text-gray-400">Sin puntos de fichaje activos.</p>
            ) : (
              <div className="space-y-2">
                {puntos.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                      <p className="text-xs text-gray-400 font-mono">/op/{p.operaciones_token.slice(0, 8)}…</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-[#E8593C] text-[#E8593C] hover:bg-orange-50"
                      onClick={() => setPuntoQr(p)}
                    >
                      <QrCode size={13} />
                      Ver QR
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Procedimientos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">Procedimientos</h2>
              <Button
                size="sm"
                className="gap-1.5 bg-[#E8593C] hover:bg-[#D04828]"
                onClick={() => setNuevoProcedimiento(true)}
                disabled={turnos.length === 0}
              >
                <Plus size={14} />
                Nuevo procedimiento
              </Button>
            </div>
            {turnos.length === 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Primero configurá jornadas en <strong>Puntos QR</strong> para poder agregar procedimientos.
              </p>
            )}
            {procedimientos.length === 0 && turnos.length > 0 ? (
              <p className="text-sm text-gray-400">Sin procedimientos configurados.</p>
            ) : (
              <div className="space-y-2">
                {procedimientos.map((p) => (
                  <ProcedimientoRow
                    key={p.id}
                    proc={p}
                    turnos={turnos}
                    puntos={puntos}
                    onRefresh={cargar}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {nuevoProcedimiento && (
        <Dialog open onOpenChange={() => setNuevoProcedimiento(false)}>
          <ProcedimientoDialog turnos={turnos} onClose={() => setNuevoProcedimiento(false)} onSaved={cargar} />
        </Dialog>
      )}

      {puntoQr && (
        <QrOperacionesDialog punto={puntoQr} onClose={() => setPuntoQr(null)} />
      )}
    </div>
  )
}
