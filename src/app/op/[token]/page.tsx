"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Camera,
  ChevronRight,
  AlertTriangle,
  ClipboardList,
  User,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// ── Tipos ──────────────────────────────────────────────────────────────
interface Tarea {
  id: string
  nombre: string
  descripcion: string | null
  orden: number
  foto_min: number
  foto_max: number
  foto_instruccion: string | null
  requiere_comentario: boolean
  checklist_items: string[] | null
  tiempo_estimado_min: number | null
  criterio_verificacion: string | null
}

interface EjecucionTarea {
  id: string
  estado: string
  tarea: Tarea
  fotos: { id: string; estado_subida: string; verificacion_ia: unknown }[]
}

interface EjecucionProcedimiento {
  id: string
  estado: string
  procedimiento: { nombre: string }
  turno: { nombre: string; hora_inicio: string; hora_fin: string }
  tareas: EjecucionTarea[]
}

interface PuntoData {
  punto: { id: string; nombre: string }
  empresa: { nombre: string; logo_url: string | null }
  ejecuciones: EjecucionProcedimiento[]
  fecha: string
}

interface Colaborador {
  id: string
  nombre: string
  apellido: string
}

interface VerificacionIA {
  aprobada: boolean
  confianza: string
  observacion: string
  requiere_revision_humana: boolean
}

type Fase =
  | "cargando"
  | "invalido"
  | "modulo-desactivado"
  | "sin-tareas"
  | "identificar"
  | "bienvenida"
  | "tarea-intro"
  | "tarea-camera"
  | "tarea-preview"
  | "analizando"
  | "tarea-ok"
  | "tarea-rechazo"
  | "revision-humana"
  | "comentario"
  | "completado"

const STORAGE_OP_ID = "op_colab_id"
const STORAGE_OP_NOMBRE = "op_colab_nombre"
const STORAGE_OP_APELLIDO = "op_colab_apellido"

export default function OpPage() {
  const { token } = useParams<{ token: string }>()

  const [fase, setFase] = useState<Fase>("cargando")
  const [data, setData] = useState<PuntoData | null>(null)
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [tareasFlat, setTareasFlat] = useState<{ et: EjecucionTarea; procNombre: string }[]>([])
  const [tareaIdx, setTareaIdx] = useState(0)
  const [foto, setFoto] = useState<{ base64: string; preview: string; mime: string } | null>(null)
  const [verificacion, setVerificacion] = useState<VerificacionIA | null>(null)
  const [comentario, setComentario] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [dni, setDni] = useState("")
  const [dniError, setDniError] = useState("")
  const [horaActual, setHoraActual] = useState("")

  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function tick() {
      setHoraActual(
        new Date().toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires",
        })
      )
    }
    tick()
    const t = setInterval(tick, 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!token) return
    fetch(`/api/op/${token}`)
      .then((r) => r.json())
      .then((d: PuntoData & { error?: string }) => {
        if (d.error) { setFase("invalido"); return }
        setData(d)

        // Aplanar todas las tareas en orden (por procedimiento y luego por orden de tarea)
        const flat: { et: EjecucionTarea; procNombre: string }[] = []
        for (const ep of d.ejecuciones) {
          for (const et of ep.tareas) {
            // Solo incluir tareas que no están completadas u omitidas
            if (et.estado !== "COMPLETADA" && et.estado !== "OMITIDA") {
              flat.push({ et, procNombre: ep.procedimiento.nombre })
            }
          }
        }

        if (flat.length === 0) {
          // Verificar si hay tareas pero todas completadas
          const totalTareas = d.ejecuciones.reduce((acc, ep) => acc + ep.tareas.length, 0)
          setFase(totalTareas === 0 ? "sin-tareas" : "completado")
          return
        }

        setTareasFlat(flat)

        const savedId = localStorage.getItem(STORAGE_OP_ID)
        const savedNombre = localStorage.getItem(STORAGE_OP_NOMBRE)
        const savedApellido = localStorage.getItem(STORAGE_OP_APELLIDO)
        if (savedId && savedNombre) {
          setColaborador({ id: savedId, nombre: savedNombre, apellido: savedApellido ?? "" })
          setFase("bienvenida")
        } else {
          setFase("identificar")
        }
      })
      .catch(() => setFase("invalido"))
  }, [token])

  // Polling: verifica cada 30s si el módulo sigue activo
  useEffect(() => {
    if (!token) return
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/op/${token}`)
        if (r.status === 403) {
          setFase("modulo-desactivado")
        } else if (r.status === 404) {
          setFase("invalido")
        }
      } catch {
        // silencioso — no interrumpir si hay error de red puntual
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [token])

  async function identificar() {
    const dniLimpio = dni.replace(/\./g, "").trim()
    if (!dniLimpio) { setDniError("Ingresá tu DNI"); return }
    setDniError("")
    const res = await fetch(`/api/op/${token}/identificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni: dniLimpio }),
    })
    const d = await res.json() as { colaborador?: Colaborador; error?: string }
    if (!res.ok || !d.colaborador) {
      setDniError(d.error ?? "DNI no encontrado. Probá con tu número de celular.")
      return
    }
    localStorage.setItem(STORAGE_OP_ID, d.colaborador.id)
    localStorage.setItem(STORAGE_OP_NOMBRE, d.colaborador.nombre)
    localStorage.setItem(STORAGE_OP_APELLIDO, d.colaborador.apellido)
    setColaborador(d.colaborador)
    setFase("bienvenida")
  }

  function empezar() {
    setTareaIdx(0)
    setFoto(null)
    setVerificacion(null)
    setComentario("")
    setFase("tarea-intro")
  }

  function abrirCamara() {
    cameraRef.current?.click()
    setFase("tarea-camera")
  }

  function onFotoSeleccionada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) { setFase("tarea-intro"); return }
    e.target.value = ""
    comprimirImagen(file).then((result) => {
      setFoto(result)
      setFase("tarea-preview")
    }).catch(() => setFase("tarea-intro"))
  }

  async function analizarFoto() {
    if (!foto || !colaborador) return
    const et = tareasFlat[tareaIdx]?.et
    if (!et) return

    setFase("analizando")
    setVerificacion(null)
    setErrorMsg("")

    try {
      const res = await fetch(`/api/op/${token}/verificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ejecucion_tarea_id: et.id,
          colaborador_id: colaborador.id,
          foto_base64: foto.base64,
          tipo_mime: foto.mime,
        }),
      })
      const d = await res.json() as {
        verificacion?: VerificacionIA
        tarea_completada?: boolean
        error?: string
      }

      if (!res.ok || !d.verificacion) {
        setErrorMsg(d.error ?? "Error al analizar la foto")
        setFase("tarea-rechazo")
        return
      }

      setVerificacion(d.verificacion)

      if (d.verificacion.requiere_revision_humana) {
        setFase("revision-humana")
      } else if (d.tarea_completada) {
        if (et.tarea.requiere_comentario) {
          setFase("comentario")
        } else {
          setFase("tarea-ok")
        }
      } else {
        setFase("tarea-rechazo")
      }
    } catch {
      setErrorMsg("Error de red. Intentá de nuevo.")
      setFase("tarea-rechazo")
    }
  }

  function siguienteTarea() {
    const siguiente = tareaIdx + 1
    if (siguiente >= tareasFlat.length) {
      setFase("completado")
    } else {
      setTareaIdx(siguiente)
      setFoto(null)
      setVerificacion(null)
      setComentario("")
      setFase("tarea-intro")
    }
  }

  function olvidarIdentidad() {
    localStorage.removeItem(STORAGE_OP_ID)
    localStorage.removeItem(STORAGE_OP_NOMBRE)
    localStorage.removeItem(STORAGE_OP_APELLIDO)
    setColaborador(null)
    setDni("")
    setFase("identificar")
  }

  const tareaActual = tareasFlat[tareaIdx]
  const progreso = tareasFlat.length > 0 ? Math.round((tareaIdx / tareasFlat.length) * 100) : 0
  const fechaDisplay = data?.fecha
    ? new Date(data.fecha + "T12:00:00").toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : ""

  return (
    <div className="min-h-screen bg-[#FFF8F6] flex flex-col">

      {/* Header */}
      <div
        style={{ background: "linear-gradient(135deg, #E8593C 0%, #F4804A 100%)" }}
        className="px-6 pt-10 pb-8 text-white text-center"
      >
        <div className="mb-1">
          <span className="text-2xl font-black tracking-tighter">FICH</span>
          <span className="text-2xl font-black tracking-tighter text-orange-200">.AR</span>
        </div>
        {data && (
          <>
            <p className="text-lg font-semibold mt-2">{data.punto.nombre}</p>
            <p className="text-orange-200 text-sm mt-0.5">{data.empresa.nombre}</p>
          </>
        )}
        <p className="text-orange-100 text-xs mt-2 capitalize">{fechaDisplay} · {horaActual}</p>

        {/* Barra de progreso */}
        {(fase === "tarea-intro" || fase === "tarea-camera" || fase === "tarea-preview" || fase === "analizando" || fase === "tarea-ok" || fase === "tarea-rechazo" || fase === "revision-humana" || fase === "comentario") && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-orange-200 mb-1">
              <span>Tarea {tareaIdx + 1} de {tareasFlat.length}</span>
              <span>{progreso}%</span>
            </div>
            <div className="h-1.5 bg-orange-400/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Input cámara oculto */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFotoSeleccionada}
      />

      <div className="flex-1 flex items-start justify-center px-5 py-8">
        <div className="w-full max-w-sm space-y-4">

          {/* ── CARGANDO ── */}
          {fase === "cargando" && (
            <Card>
              <Loader2 size={36} className="text-[#E8593C] animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium text-center">Cargando tareas...</p>
            </Card>
          )}

          {/* ── MÓDULO DESACTIVADO ── */}
          {fase === "modulo-desactivado" && (
            <Card>
              <XCircle size={44} className="text-orange-400 mx-auto mb-4" />
              <p className="text-gray-800 font-semibold text-lg text-center">Módulo desactivado</p>
              <p className="text-gray-400 text-sm mt-2 text-center">
                El módulo de operaciones fue desactivado por el administrador. Consultá con tu supervisor.
              </p>
            </Card>
          )}

          {/* ── INVÁLIDO ── */}
          {fase === "invalido" && (
            <Card>
              <XCircle size={44} className="text-red-400 mx-auto mb-4" />
              <p className="text-gray-800 font-semibold text-lg text-center">Código QR inválido</p>
              <p className="text-gray-400 text-sm mt-2 text-center">
                Este código no existe, fue desactivado, o el módulo de operaciones no está activo.
              </p>
            </Card>
          )}

          {/* ── SIN TAREAS ── */}
          {fase === "sin-tareas" && (
            <Card>
              <ClipboardList size={44} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-800 font-semibold text-lg text-center">Sin tareas hoy</p>
              <p className="text-gray-400 text-sm mt-2 text-center">
                No hay procedimientos programados para este punto hoy.
              </p>
            </Card>
          )}

          {/* ── IDENTIFICAR ── */}
          {fase === "identificar" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-3">
                  <User size={28} className="text-[#E8593C]" />
                </div>
                <p className="text-gray-800 font-semibold text-lg">¿Quién sos?</p>
                <p className="text-gray-400 text-sm mt-1">Ingresá tu DNI para continuar</p>
              </div>
              <div className="space-y-2">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="DNI sin puntos"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void identificar()}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                />
                {dniError && <p className="text-red-500 text-sm">{dniError}</p>}
              </div>
              <Button
                onClick={() => void identificar()}
                disabled={!dni}
                className="w-full h-12 bg-[#E8593C] hover:bg-[#D04828] text-white font-semibold rounded-xl"
              >
                Continuar
              </Button>
            </div>
          )}

          {/* ── BIENVENIDA / RESUMEN ── */}
          {fase === "bienvenida" && colaborador && data && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center mx-auto mb-3">
                  <ClipboardList size={20} className="text-[#E8593C]" />
                </div>
                <p className="text-gray-800 font-semibold">
                  Hola, {colaborador.nombre} 👋
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Tenés <strong className="text-gray-700">{tareasFlat.length}</strong> {tareasFlat.length === 1 ? "tarea" : "tareas"} pendientes hoy
                </p>
              </div>

              {/* Lista de procedimientos */}
              <div className="space-y-2">
                {data.ejecuciones.map((ep) => (
                  <div key={ep.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-gray-800 font-medium text-sm">{ep.procedimiento.nombre}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {ep.turno.hora_inicio} – {ep.turno.hora_fin} · {ep.tareas.length} tarea{ep.tareas.length !== 1 ? "s" : ""}
                    </p>
                    <div className="mt-2 space-y-1">
                      {ep.tareas.map((et) => (
                        <div key={et.id} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            et.estado === "COMPLETADA" ? "bg-green-400" : "bg-orange-300"
                          }`} />
                          <span className="text-xs text-gray-600 truncate">{et.tarea.nombre}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={empezar}
                className="w-full h-14 bg-[#E8593C] hover:bg-[#D04828] text-white font-bold text-lg rounded-2xl"
              >
                Empezar
                <ChevronRight size={20} className="ml-1" />
              </Button>

              <button
                onClick={olvidarIdentidad}
                className="w-full text-xs text-gray-400 hover:text-gray-600 underline text-center"
              >
                No soy {colaborador.nombre} {colaborador.apellido}
              </button>
            </div>
          )}

          {/* ── TAREA: INTRO ── */}
          {(fase === "tarea-intro" || fase === "tarea-camera") && tareaActual && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {tareaActual.et.tarea.foto_instruccion && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tareaActual.et.tarea.foto_instruccion}
                    alt="Instrucción"
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-6">
                  <p className="text-xs font-medium text-[#E8593C] uppercase tracking-wide mb-1">
                    {tareaActual.procNombre}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900">{tareaActual.et.tarea.nombre}</h2>

                  {tareaActual.et.tarea.descripcion && (
                    <p className="text-gray-600 text-sm mt-3 leading-relaxed">
                      {tareaActual.et.tarea.descripcion}
                    </p>
                  )}

                  {tareaActual.et.tarea.checklist_items && tareaActual.et.tarea.checklist_items.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Checklist</p>
                      {tareaActual.et.tarea.checklist_items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-4 h-4 rounded border border-gray-300 mt-0.5 shrink-0" />
                          <span className="text-sm text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {tareaActual.et.tarea.tiempo_estimado_min && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
                        ~{tareaActual.et.tarea.tiempo_estimado_min} min
                      </span>
                    )}
                    {tareaActual.et.tarea.foto_min > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-xs">
                        {tareaActual.et.tarea.foto_min === tareaActual.et.tarea.foto_max
                          ? `${tareaActual.et.tarea.foto_min} foto${tareaActual.et.tarea.foto_min !== 1 ? "s" : ""}`
                          : `${tareaActual.et.tarea.foto_min}–${tareaActual.et.tarea.foto_max} fotos`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {fase === "tarea-camera" ? (
                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-8 text-center space-y-4">
                  <Camera size={48} className="text-[#E8593C] mx-auto" />
                  <p className="text-gray-700 font-medium">Abriendo la cámara...</p>
                  <p className="text-gray-400 text-sm">
                    Sacá una foto que muestre que la tarea está completada
                  </p>
                  <Button
                    onClick={abrirCamara}
                    className="w-full h-12 bg-[#E8593C] hover:bg-[#D04828] text-white font-semibold rounded-xl"
                  >
                    <Camera size={18} className="mr-2" />
                    Abrir cámara
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={abrirCamara}
                  className="w-full h-14 bg-[#E8593C] hover:bg-[#D04828] text-white font-bold text-lg rounded-2xl"
                >
                  <Camera size={22} className="mr-2" />
                  Tomar foto
                </Button>
              )}

            </div>
          )}

          {/* ── TAREA: PREVIEW ── */}
          {fase === "tarea-preview" && foto && tareaActual && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.preview} alt="Foto tomada" className="w-full object-cover max-h-72" />
                <div className="p-4">
                  <p className="text-gray-700 font-medium text-sm">{tareaActual.et.tarea.nombre}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    La IA va a analizar si la tarea está correctamente completada
                  </p>
                </div>
              </div>

              <Button
                onClick={() => void analizarFoto()}
                className="w-full h-14 bg-[#E8593C] hover:bg-[#D04828] text-white font-bold text-lg rounded-2xl"
              >
                Analizar con IA
                <ChevronRight size={20} className="ml-1" />
              </Button>

              <button
                onClick={abrirCamara}
                className="w-full text-xs text-gray-400 hover:text-gray-600 underline text-center flex items-center justify-center gap-1"
              >
                <RefreshCw size={12} />
                Sacar otra foto
              </button>
            </div>
          )}

          {/* ── ANALIZANDO ── */}
          {fase === "analizando" && (
            <Card>
              <Loader2 size={36} className="text-[#E8593C] animate-spin mx-auto mb-4" />
              <p className="text-gray-800 font-semibold text-center">Analizando foto...</p>
              <p className="text-gray-400 text-sm mt-2 text-center">
                La IA está verificando que la tarea esté completa
              </p>
            </Card>
          )}

          {/* ── APROBADA ── */}
          {fase === "tarea-ok" && verificacion && tareaActual && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-8 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={48} className="text-green-500" />
                </div>
                <div>
                  <p className="text-green-700 font-bold text-xl">¡Tarea completada!</p>
                  <p className="text-gray-600 text-sm mt-2 font-medium">{tareaActual.et.tarea.nombre}</p>
                </div>
                {verificacion.observacion && (
                  <div className="bg-green-50 rounded-xl px-4 py-3 text-green-700 text-sm text-left">
                    {verificacion.observacion}
                  </div>
                )}
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-xs text-gray-400">Confianza IA:</span>
                  <span className={`text-xs font-medium ${
                    verificacion.confianza === "alta" ? "text-green-600" :
                    verificacion.confianza === "media" ? "text-amber-600" : "text-red-500"
                  }`}>{verificacion.confianza}</span>
                </div>
              </div>

              <Button
                onClick={siguienteTarea}
                className="w-full h-14 bg-[#E8593C] hover:bg-[#D04828] text-white font-bold text-lg rounded-2xl"
              >
                {tareaIdx + 1 >= tareasFlat.length ? "Finalizar" : "Siguiente tarea"}
                <ChevronRight size={20} className="ml-1" />
              </Button>
            </div>
          )}

          {/* ── RECHAZADA ── */}
          {fase === "tarea-rechazo" && tareaActual && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                  <XCircle size={48} className="text-red-400" />
                </div>
                <div>
                  <p className="text-red-700 font-bold text-xl">No aprobada</p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">{tareaActual.et.tarea.nombre}</p>
                </div>
                {(verificacion?.observacion || errorMsg) && (
                  <div className="bg-red-50 rounded-xl px-4 py-3 text-red-700 text-sm text-left">
                    {verificacion?.observacion ?? errorMsg}
                  </div>
                )}
              </div>

              <Button
                onClick={abrirCamara}
                className="w-full h-14 bg-[#E8593C] hover:bg-[#D04828] text-white font-bold text-lg rounded-2xl"
              >
                <Camera size={22} className="mr-2" />
                Reintentar
              </Button>

            </div>
          )}

          {/* ── REVISIÓN HUMANA ── */}
          {fase === "revision-humana" && verificacion && tareaActual && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-8 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                  <AlertTriangle size={44} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-amber-700 font-bold text-xl">Foto enviada para revisión</p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">{tareaActual.et.tarea.nombre}</p>
                </div>
                {verificacion.observacion && (
                  <div className="bg-amber-50 rounded-xl px-4 py-3 text-amber-700 text-sm text-left">
                    {verificacion.observacion}
                  </div>
                )}
                <p className="text-gray-400 text-xs">
                  Un supervisor va a revisar tu foto y confirmar la tarea.
                </p>
              </div>

              <Button
                onClick={siguienteTarea}
                className="w-full h-14 bg-[#E8593C] hover:bg-[#D04828] text-white font-bold text-lg rounded-2xl"
              >
                {tareaIdx + 1 >= tareasFlat.length ? "Finalizar" : "Siguiente tarea"}
                <ChevronRight size={20} className="ml-1" />
              </Button>
            </div>
          )}

          {/* ── COMENTARIO ── */}
          {fase === "comentario" && tareaActual && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <p className="text-gray-800 font-semibold">{tareaActual.et.tarea.nombre}</p>
                <p className="text-gray-500 text-sm">Dejá un comentario antes de continuar:</p>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  placeholder="¿Algo que quieras aclarar?"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                />
              </div>
              <Button
                onClick={siguienteTarea}
                className="w-full h-14 bg-[#E8593C] hover:bg-[#D04828] text-white font-bold text-lg rounded-2xl"
              >
                {tareaIdx + 1 >= tareasFlat.length ? "Finalizar" : "Siguiente tarea"}
                <ChevronRight size={20} className="ml-1" />
              </Button>
            </div>
          )}

          {/* ── COMPLETADO ── */}
          {fase === "completado" && (
            <Card>
              <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={56} className="text-green-500" />
              </div>
              <p className="text-gray-900 font-bold text-2xl text-center">
                ¡Todo listo!
              </p>
              <p className="text-gray-400 text-sm mt-2 text-center">
                Completaste todas las tareas del día en {data?.punto.nombre}.
              </p>
              <p className="text-gray-300 text-xs mt-4 text-center">Podés cerrar esta página</p>
            </Card>
          )}

        </div>
      </div>

      <p className="text-center text-xs text-gray-300 pb-6">
        Powered by <span className="font-semibold">FMCODE</span>
      </p>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      {children}
    </div>
  )
}

function comprimirImagen(file: File): Promise<{ base64: string; preview: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (ev) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const MAX = 1200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width >= height) {
            height = Math.round((height * MAX) / width)
            width = MAX
          } else {
            width = Math.round((width * MAX) / height)
            height = MAX
          }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("canvas")); return }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82)
        resolve({ base64: dataUrl.split(",")[1], preview: dataUrl, mime: "image/jpeg" })
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}
