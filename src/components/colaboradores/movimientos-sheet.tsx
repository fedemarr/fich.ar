"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, LogIn, LogOut, MapPin, Coffee, Loader2, AlertCircle, CalendarOff, Clock } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"

type EstadoServicio = "COMPLETO" | "EN_CURSO" | "SIN_SALIDA" | "SIN_ENTRADA"
type EstadoSinFichar = "NO_FICHO" | "PENDIENTE" | "FRANCO"

interface Movimientos {
  fecha: string
  es_hoy: boolean
  colaborador: { nombre: string; apellido: string }
  servicios: {
    punto: string
    entrada: string | null
    salida: string | null
    estado: EstadoServicio
    duracion_min: number | null
    cobertura: boolean
    tarde: boolean
    salida_anticipada: boolean
    cierre_automatico: boolean
    manual: boolean
  }[]
  sin_fichar: { punto: string; turno: string; horario: string; estado: EstadoSinFichar }[]
  novedad: { tipo: string; etiqueta: string; observacion: string | null } | null
  descansos: { inicio: string | null; fin: string | null; duracion_min: number | null }[]
}

interface Props {
  colaborador: { id: string; nombre: string; apellido: string } | null
  onClose: () => void
}

function hoyARG(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
}

function moverDia(fecha: string, dias: number): string {
  const d = new Date(fecha + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function fechaLarga(fecha: string): string {
  return new Date(fecha + "T12:00:00Z").toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  })
}

function duracion(min: number | null): string {
  if (min === null) return ""
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`
}

const COLOR_NOVEDAD: Record<string, string> = {
  P: "bg-green-50 text-green-700 border-green-200",
  PT: "bg-amber-50 text-amber-700 border-amber-200",
  AU: "bg-red-50 text-red-700 border-red-200",
  FR: "bg-rose-50 text-rose-700 border-rose-200",
}

function Etiqueta({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${className}`}>{children}</span>
}

interface Resultado {
  clave: string
  datos: Movimientos | null
  error: string
}

// Montar con key={colaborador.id} para que cada colaborador abra en "hoy"
export function MovimientosSheet({ colaborador, onClose }: Props) {
  const [fecha, setFecha] = useState(hoyARG())
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const colaboradorId = colaborador?.id ?? null
  const clave = colaboradorId ? `${colaboradorId}|${fecha}` : null

  useEffect(() => {
    if (!colaboradorId || !clave) return
    let cancelado = false
    fetch(`/api/colaboradores/${colaboradorId}/movimientos?fecha=${fecha}`)
      .then(async (r) => {
        const data = await r.json() as Movimientos & { error?: string }
        if (cancelado) return
        setResultado(r.ok
          ? { clave, datos: data, error: "" }
          : { clave, datos: null, error: data.error ?? "No se pudieron cargar los movimientos" })
      })
      .catch(() => { if (!cancelado) setResultado({ clave, datos: null, error: "Error de conexión" }) })
    return () => { cancelado = true }
  }, [colaboradorId, clave, fecha])

  const actual = resultado && resultado.clave === clave ? resultado : null
  const cargando = clave !== null && actual === null
  const datos = actual?.datos ?? null
  const error = actual?.error ?? ""

  const esHoy = fecha === hoyARG()
  const vacio = datos && datos.servicios.length === 0 && datos.sin_fichar.length === 0 && datos.descansos.length === 0

  return (
    <Sheet open={!!colaborador} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-0">
          <SheetTitle>{colaborador ? `${colaborador.apellido} ${colaborador.nombre}` : ""}</SheetTitle>
          <SheetDescription>Movimientos del día</SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-4 pb-6">
          {/* Selector de día */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-2 py-1.5">
            <button
              type="button"
              onClick={() => setFecha((f) => moverDia(f, -1))}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-gray-800"
              title="Día anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800 capitalize">{esHoy ? "Hoy" : fechaLarga(fecha)}</p>
              {esHoy && <p className="text-[11px] text-gray-400 capitalize">{fechaLarga(fecha)}</p>}
            </div>
            <button
              type="button"
              onClick={() => setFecha((f) => moverDia(f, 1))}
              disabled={esHoy}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Día siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {cargando && (
            <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#2563EB]" /></div>
          )}

          {!cargando && error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0" />{error}
            </div>
          )}

          {!cargando && datos && (
            <>
              {datos.novedad && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Novedad:</span>
                  <Etiqueta className={COLOR_NOVEDAD[datos.novedad.tipo] ?? "bg-gray-50 text-gray-600 border-gray-200"}>
                    {datos.novedad.etiqueta}
                  </Etiqueta>
                </div>
              )}

              {datos.servicios.some((s) => s.duracion_min !== null) && (
                <div className="flex items-center justify-between rounded-xl bg-[#EFF6FF] border border-blue-100 px-3 py-2">
                  <span className="text-xs font-medium text-gray-600">Total trabajado</span>
                  <span className="text-sm font-bold text-[#2563EB]">
                    {duracion(datos.servicios.reduce((acc, s) => acc + (s.duracion_min ?? 0), 0))}
                    {datos.servicios.some((s) => s.estado === "EN_CURSO") && (
                      <span className="ml-1 text-[11px] font-medium text-gray-400">+ turno en curso</span>
                    )}
                  </span>
                </div>
              )}

              {vacio && (
                <div className="text-center py-10 text-sm text-gray-400">
                  Sin movimientos ni servicios asignados este día
                </div>
              )}

              {/* Servicios fichados */}
              {datos.servicios.length > 0 && (
                <div className="space-y-2">
                  {datos.servicios.map((s, i) => (
                    <div key={i} className={`rounded-xl border p-3 ${s.estado === "EN_CURSO" ? "border-green-200 bg-green-50/40" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 min-w-0">
                          <MapPin size={13} className="text-[#2563EB] shrink-0" />
                          <span className="truncate">{s.punto}</span>
                        </p>
                        {s.estado === "EN_CURSO" && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-green-700 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Trabajando
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-gray-700">
                          <LogIn size={13} className="text-green-600" />
                          {s.entrada ?? <span className="text-gray-300">—</span>}
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-700">
                          <LogOut size={13} className="text-red-500" />
                          {s.salida ?? (
                            <span className={s.estado === "EN_CURSO" ? "text-green-700 text-xs font-medium" : "text-amber-600 text-xs font-medium"}>
                              {s.estado === "EN_CURSO" ? "Todavía no salió" : "Sin salida"}
                            </span>
                          )}
                        </span>
                        {s.duracion_min !== null && (
                          <span className="ml-auto text-xs text-gray-400">{duracion(s.duracion_min)}</span>
                        )}
                      </div>

                      {(s.estado === "SIN_ENTRADA" || s.cobertura || s.tarde || s.salida_anticipada || s.cierre_automatico || s.manual) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.estado === "SIN_ENTRADA" && <Etiqueta className="bg-amber-50 text-amber-700 border-amber-200">Salida sin entrada hoy</Etiqueta>}
                          {s.cobertura && <Etiqueta className="bg-indigo-50 text-indigo-700 border-indigo-200">Cobertura</Etiqueta>}
                          {s.tarde && <Etiqueta className="bg-amber-50 text-amber-700 border-amber-200">Llegó tarde</Etiqueta>}
                          {s.salida_anticipada && <Etiqueta className="bg-amber-50 text-amber-700 border-amber-200">Salida anticipada</Etiqueta>}
                          {s.cierre_automatico && <Etiqueta className="bg-gray-50 text-gray-600 border-gray-200">Salida automática</Etiqueta>}
                          {s.manual && <Etiqueta className="bg-gray-50 text-gray-600 border-gray-200">Manual</Etiqueta>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Servicios del turno sin fichar */}
              {datos.sin_fichar.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Servicios del día sin fichar</p>
                  {datos.sin_fichar.map((s, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border border-dashed p-3 flex items-center justify-between gap-2 ${
                        s.estado === "NO_FICHO" ? "border-red-200 bg-red-50/40" : "border-gray-200"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{s.punto}</p>
                        <p className="text-xs text-gray-400">{s.horario}</p>
                      </div>
                      {s.estado === "NO_FICHO" && <span className="text-xs font-semibold text-red-600 shrink-0">No fichó</span>}
                      {s.estado === "FRANCO" && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 shrink-0"><CalendarOff size={12} /> Franco</span>
                      )}
                      {s.estado === "PENDIENTE" && (
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-500 shrink-0"><Clock size={12} /> Todavía no empieza</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Descansos */}
              {datos.descansos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Descanso</p>
                  {datos.descansos.map((d, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-sm text-gray-700">
                      <Coffee size={13} className="text-amber-500" />
                      {d.inicio} – {d.fin ?? <span className="text-amber-600 text-xs font-medium">en curso</span>}
                      {d.duracion_min !== null && <span className="text-xs text-gray-400 ml-1">({d.duracion_min} min)</span>}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
