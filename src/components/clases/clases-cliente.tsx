"use client"

import { useEffect, useState } from "react"
import * as XLSX from "xlsx"
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, Dumbbell, Download, Repeat2, Clock, CheckCircle2, XCircle, PlayCircle, CalendarClock,
} from "lucide-react"
import { Button } from "@/components/ui/button"

type EstadoClase = "DICTADA" | "EN_CURSO" | "NO_DICTADA" | "PENDIENTE"

interface Dictado {
  profe: string
  colaborador_id: string
  entrada: string
  salida: string | null
  minutos: number | null
  tarde: boolean
  reemplazo_de: string | null
}

interface ClaseDelDia {
  id: string
  nombre: string
  hora_inicio: string
  hora_fin: string
  punto_nombre: string
  titulares: { id: string; nombre: string; apellido: string }[]
  estado: EstadoClase
  dictados: Dictado[]
}

interface DatosDia {
  fecha: string
  es_hoy: boolean
  clases: ClaseDelDia[]
}

interface LiquidacionProfe {
  colaborador_id: string
  profe: string
  dictadas: number
  como_reemplazo: number
  tarde: number
  minutos: number
  reemplazado: number
  no_dictadas: number
}

interface DatosMes {
  mes: string
  profes: LiquidacionProfe[]
}

interface Resultado<T> {
  clave: string
  datos: T | null
  error: string
}

const TZ = "America/Argentina/Buenos_Aires"

function hoyARG(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ })
}

function moverDia(fecha: string, dias: number): string {
  const d = new Date(fecha + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number)
  const d = new Date(Date.UTC(a, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

function fechaLarga(fecha: string): string {
  return new Date(fecha + "T12:00:00Z").toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  })
}

function mesLargo(mes: string): string {
  return new Date(mes + "-15T12:00:00Z").toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
}

function horas(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, "0")}`
}

// Carga una URL y guarda el resultado por clave (sin setState síncrono en el efecto)
function useDatos<T>(url: string): { cargando: boolean; datos: T | null; error: string } {
  const [resultado, setResultado] = useState<Resultado<T> | null>(null)
  useEffect(() => {
    let cancelado = false
    fetch(url)
      .then(async (r) => {
        const data = await r.json() as T & { error?: string }
        if (cancelado) return
        setResultado(r.ok
          ? { clave: url, datos: data, error: "" }
          : { clave: url, datos: null, error: data.error ?? "No se pudieron cargar los datos" })
      })
      .catch(() => { if (!cancelado) setResultado({ clave: url, datos: null, error: "Error de conexión" }) })
    return () => { cancelado = true }
  }, [url])
  const actual = resultado && resultado.clave === url ? resultado : null
  return { cargando: actual === null, datos: actual?.datos ?? null, error: actual?.error ?? "" }
}

const ESTADO: Record<EstadoClase, { label: string; className: string; icon: React.ElementType }> = {
  DICTADA:    { label: "Dictada",    className: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  EN_CURSO:   { label: "En curso",   className: "bg-blue-50 text-blue-700 border-blue-200",    icon: PlayCircle },
  NO_DICTADA: { label: "No dictada", className: "bg-red-50 text-red-700 border-red-200",       icon: XCircle },
  PENDIENTE:  { label: "Pendiente",  className: "bg-gray-50 text-gray-600 border-gray-200",    icon: CalendarClock },
}

function Navegador({ titulo, subtitulo, onAnterior, onSiguiente, siguienteDeshabilitado }: {
  titulo: string
  subtitulo?: string
  onAnterior: () => void
  onSiguiente: () => void
  siguienteDeshabilitado?: boolean
}) {
  return (
    <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-xl px-2 py-1.5">
      <button type="button" onClick={onAnterior} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-800" title="Anterior">
        <ChevronLeft size={16} />
      </button>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-800 capitalize">{titulo}</p>
        {subtitulo && <p className="text-[11px] text-gray-400 capitalize">{subtitulo}</p>}
      </div>
      <button
        type="button"
        onClick={onSiguiente}
        disabled={siguienteDeshabilitado}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
        title="Siguiente"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

function Cargando() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
      <Loader2 size={18} className="animate-spin" /> Cargando...
    </div>
  )
}

function ErrorCaja({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 rounded-xl p-4 text-sm">
      <AlertCircle size={16} /> {mensaje}
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl p-10 text-center space-y-2">
      <Dumbbell size={28} className="text-gray-300 mx-auto" />
      <p className="text-sm text-gray-500">{texto}</p>
    </div>
  )
}

function VistaDia() {
  const [fecha, setFecha] = useState(hoyARG())
  const { cargando, datos, error } = useDatos<DatosDia>(`/api/clases?fecha=${fecha}`)
  const esHoy = fecha === hoyARG()

  const conteo = (e: EstadoClase) => datos?.clases.filter((c) => c.estado === e).length ?? 0
  const reemplazos = datos?.clases.reduce((n, c) => n + c.dictados.filter((d) => d.reemplazo_de).length, 0) ?? 0

  return (
    <div className="space-y-4">
      <Navegador
        titulo={esHoy ? "Hoy" : fechaLarga(fecha)}
        subtitulo={esHoy ? fechaLarga(fecha) : undefined}
        onAnterior={() => setFecha((f) => moverDia(f, -1))}
        onSiguiente={() => setFecha((f) => moverDia(f, 1))}
      />

      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} /> : datos && datos.clases.length === 0 ? (
        <Vacio texto="No hay clases programadas este día. Cargalas desde Puntos QR → Turnos, marcando “Es una clase”." />
      ) : datos && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Dictadas", valor: conteo("DICTADA") + conteo("EN_CURSO"), color: "text-green-700" },
              { label: "No dictadas", valor: conteo("NO_DICTADA"), color: "text-red-600" },
              { label: "Pendientes", valor: conteo("PENDIENTE"), color: "text-gray-700" },
              { label: "Reemplazos", valor: reemplazos, color: "text-purple-700" },
            ].map((k) => (
              <div key={k.label} className="bg-white border border-[#E5E7EB] rounded-xl p-3">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.valor}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl divide-y divide-[#E5E7EB]">
            {datos.clases.map((c) => {
              const est = ESTADO[c.estado]
              const Icono = est.icon
              const titulares = c.titulares.map((t) => `${t.apellido} ${t.nombre}`).join(", ")
              return (
                <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-16 shrink-0">
                      <p className="text-base font-bold text-gray-900 leading-none">{c.hora_inicio}</p>
                      <p className="text-xs text-gray-400 mt-1">{c.hora_fin}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{c.nombre}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {c.punto_nombre} · Titular: {titulares || "sin asignar"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-1.5 sm:min-w-[220px]">
                    <span className={`inline-flex items-center gap-1 self-start sm:self-end text-xs font-semibold px-2 py-0.5 rounded-full border ${est.className}`}>
                      <Icono size={12} /> {est.label}
                    </span>
                    {c.dictados.map((d, i) => (
                      <div key={i} className="text-xs text-gray-600 sm:text-right">
                        <span className="font-medium text-gray-800">{d.profe}</span>
                        {" · "}{d.entrada} → {d.salida ?? "en curso"}
                        {d.tarde && <span className="ml-1.5 text-amber-600 font-medium">· tarde</span>}
                        {d.reemplazo_de && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-purple-700 font-medium">
                            <Repeat2 size={11} /> reemplazó a {d.reemplazo_de}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function VistaMes() {
  const mesActual = hoyARG().slice(0, 7)
  const [mes, setMes] = useState(mesActual)
  const { cargando, datos, error } = useDatos<DatosMes>(`/api/clases/liquidacion?mes=${mes}`)

  function exportar() {
    if (!datos) return
    const filas = datos.profes.map((p) => ({
      Profe: p.profe,
      "Clases dictadas": p.dictadas,
      "Como reemplazo": p.como_reemplazo,
      "Llegó tarde": p.tarde,
      "Horas dictadas": Math.round((p.minutos / 60) * 100) / 100,
      "Lo reemplazaron": p.reemplazado,
      "Clases no dictadas": p.no_dictadas,
    }))
    const ws = XLSX.utils.json_to_sheet(filas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Liquidación")
    XLSX.writeFile(wb, `liquidacion-clases-${mes}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1">
          <Navegador
            titulo={mesLargo(mes)}
            onAnterior={() => setMes((m) => moverMes(m, -1))}
            onSiguiente={() => setMes((m) => moverMes(m, 1))}
            siguienteDeshabilitado={mes >= mesActual}
          />
        </div>
        <Button
          onClick={exportar}
          disabled={!datos || datos.profes.length === 0}
          className="gap-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white"
        >
          <Download size={15} /> Exportar a Excel
        </Button>
      </div>

      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} /> : datos && datos.profes.length === 0 ? (
        <Vacio texto="Todavía no hay clases dictadas en este mes." />
      ) : datos && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F9FAFB] text-xs text-gray-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Profe</th>
                <th className="text-right font-medium px-3 py-2.5">Dictadas</th>
                <th className="text-right font-medium px-3 py-2.5">Como reemplazo</th>
                <th className="text-right font-medium px-3 py-2.5">Llegó tarde</th>
                <th className="text-right font-medium px-3 py-2.5">Horas</th>
                <th className="text-right font-medium px-3 py-2.5">Lo reemplazaron</th>
                <th className="text-right font-medium px-4 py-2.5">No dictadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {datos.profes.map((p) => (
                <tr key={p.colaborador_id}>
                  <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{p.profe}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{p.dictadas}</td>
                  <td className="px-3 py-2.5 text-right text-purple-700">{p.como_reemplazo || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-amber-600">{p.tarde || "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1"><Clock size={12} className="text-gray-400" />{horas(p.minutos)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{p.reemplazado || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{p.no_dictadas || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ClasesCliente() {
  const [vista, setVista] = useState<"dia" | "mes">("dia")
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Clases</h1>
          <p className="text-sm text-[#6B7280]">Quién dio cada clase, reemplazos y liquidación por profe</p>
        </div>
        <div className="inline-flex bg-white border border-[#E5E7EB] rounded-lg p-0.5 self-start">
          {([["dia", "Clases del día"], ["mes", "Liquidación del mes"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${vista === v ? "bg-[#2563EB] text-white" : "text-gray-600 hover:text-gray-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {vista === "dia" ? <VistaDia /> : <VistaMes />}
    </div>
  )
}
