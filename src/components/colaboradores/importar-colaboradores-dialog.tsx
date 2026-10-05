"use client"

import { useState, useRef } from "react"
import {
  Upload, CheckCircle2, AlertCircle, Loader2, ChevronLeft, RefreshCw, Layers,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { CAMPOS_MAPEO, mapeoValido, separarNombreCompleto, type CampoMapeo, type Mapeo } from "@/lib/mapeo-colaboradores"

type Tipo = "asociados" | "servicios"
type Step = "upload" | "processing" | "mapeo" | "preview" | "confirming" | "done"

interface FilaAsociado {
  legajo: string
  apellido: string
  nombre: string
  identificacion: string
  domicilio: string
  celular: string
  email: string
  sector: string
  fecha_ingreso: string
  punto_qr_nombre?: string
  punto_qr_id?: string | null
  hora_entrada?: string
  hora_salida?: string
}

interface FilaExistente extends FilaAsociado {
  titular: string
}

interface ColabDesactivado {
  id: string
  legajo: string
  apellido: string
  nombre: string
}

interface DuplicadoArchivo {
  legajo: string
  nombre: string
}

interface PreviewAsociados {
  tipo: "asociados"
  sheets: string[]
  sheet_actual: string
  columnas: string[]
  muestra: Record<string, string>[]
  mapeo: Mapeo
  creados: FilaAsociado[]
  actualizados: FilaExistente[]
  sinCambios: number
  duplicados_archivo: DuplicadoArchivo[]
  desactivados: ColabDesactivado[]
  sinPuntoQr: string[]
}

interface FilaServicio {
  legajo: string
  apellido: string
  nombre: string
  objetivos: string[]
}

interface PreviewServicios {
  tipo: "servicios"
  sheets: string[]
  sheet_actual: string
  asignaciones: FilaServicio[]
  sinColaborador: string[]
  sinPunto: string[]
}

type Preview = PreviewAsociados | PreviewServicios

interface ErrorFila { fila: string; motivo: string }

interface ResultadoAsociados {
  ok: boolean
  exitosos: number
  creados: number
  actualizados: number
  desactivados: number
  omitidos_duplicados: number
  legajos_omitidos: string[]
  errores: ErrorFila[]
}

// Lo que se omitió antes de confirmar (ya existentes sin "Actualizar" y repetidos en el archivo)
interface OmitidosPreview {
  existentes: FilaExistente[]
  repetidos: DuplicadoArchivo[]
}
interface ResultadoServicios { ok: boolean; actualizados: number }
type Resultado = ResultadoAsociados | ResultadoServicios

interface JornadaOpcion {
  id: string
  nombre: string
  punto_fichaje: { nombre: string }
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  jornadas: JornadaOpcion[]
}

export function ImportarColaboradoresDialog({ open, onClose, onSuccess, jornadas }: Props) {
  const [step, setStep] = useState<Step>("upload")
  const [tipo, setTipo] = useState<Tipo>("asociados")
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [jornadaId, setJornadaId] = useState<string | null>(null)
  const [desactivarAusentes, setDesactivarAusentes] = useState(false)
  const [cambiandoHoja, setCambiandoHoja] = useState(false)
  const [mapeo, setMapeo] = useState<Mapeo>({})
  const [actualizarExistentes, setActualizarExistentes] = useState(false)
  const [omitidosPreview, setOmitidosPreview] = useState<OmitidosPreview>({ existentes: [], repetidos: [] })
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload"); setArchivo(null); setPreview(null); setResultado(null)
    setErrorMsg(""); setJornadaId(null); setDesactivarAusentes(false); setCambiandoHoja(false)
    setMapeo({}); setActualizarExistentes(false); setOmitidosPreview({ existentes: [], repetidos: [] })
  }

  function handleClose() {
    if (step === "done") onSuccess()
    else onClose()
    setTimeout(reset, 300)
  }

  async function fetchPreview(file: File, tipoParam: Tipo, sheetName?: string, mapeoParam?: Mapeo) {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("tipo", tipoParam)
    if (sheetName) fd.append("sheet_name", sheetName)
    if (mapeoParam) fd.append("mapeo", JSON.stringify(mapeoParam))
    const res = await fetch("/api/colaboradores/sincronizar/preview", { method: "POST", body: fd })
    const data = (await res.json()) as { error?: string } & Partial<Preview>
    if (!res.ok || data.error) throw new Error(data.error ?? "Error al procesar el archivo")
    return data as Preview
  }

  // Primera pasada: el servidor sugiere el mapeo de columnas y el usuario lo revisa
  async function procesarArchivo() {
    if (!archivo) return
    setStep("processing"); setErrorMsg("")
    try {
      const data = await fetchPreview(archivo, tipo)
      setPreview(data)
      if (data.tipo === "asociados") {
        setMapeo(data.mapeo)
        setStep("mapeo")
      } else {
        setStep("preview")
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al procesar"); setStep("upload")
    }
  }

  async function aplicarMapeo() {
    if (!archivo || !preview) return
    const problema = mapeoValido(mapeo)
    if (problema) { toast.error(problema); return }
    setStep("processing")
    try {
      const data = await fetchPreview(archivo, tipo, preview.sheet_actual, mapeo)
      setPreview(data); setActualizarExistentes(false); setStep("preview")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al procesar"); setStep("mapeo")
    }
  }

  async function cambiarHoja(sheetName: string) {
    if (!archivo || !preview) return
    setCambiandoHoja(true)
    try {
      // Otra hoja puede tener otras columnas: se vuelve a sugerir el mapeo
      const data = await fetchPreview(archivo, tipo, sheetName)
      setPreview(data)
      if (data.tipo === "asociados") {
        setMapeo(data.mapeo)
        setStep("mapeo")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cambiar hoja")
    } finally {
      setCambiandoHoja(false)
    }
  }

  async function confirmar() {
    if (!preview) return
    setStep("confirming")
    let body: unknown
    if (preview.tipo === "asociados") {
      setOmitidosPreview({
        existentes: actualizarExistentes ? [] : preview.actualizados,
        repetidos: preview.duplicados_archivo,
      })
      body = {
        tipo: "asociados",
        creados: preview.creados,
        actualizados: actualizarExistentes ? preview.actualizados : [],
        desactivarIds: desactivarAusentes ? preview.desactivados.map((d) => d.id) : [],
        jornada_id: jornadaId ?? undefined,
      }
    } else {
      body = { tipo: "servicios", asignaciones: preview.asignaciones }
    }

    // Abort si el servidor no responde en 45 segundos — evita que el dialog quede colgado para siempre
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45_000)

    try {
      const res = await fetch("/api/colaboradores/sincronizar/confirmar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = (await res.json()) as { error?: string } & Partial<Resultado>
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error al sincronizar"); setStep("preview"); return
      }
      setResultado(data as Resultado); setStep("done")
    } catch (e) {
      clearTimeout(timeoutId)
      const esTimeout = e instanceof DOMException && e.name === "AbortError"
      toast.error(esTimeout ? "La operación tardó demasiado. Intentá de nuevo con menos filas." : "Error de conexión")
      setStep("preview")
    }
  }

  const esPreview = step === "preview" || step === "mapeo"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className={esPreview
        ? "max-w-4xl max-h-[88vh] flex flex-col overflow-hidden"
        : "max-w-lg"
      }>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw size={17} className="text-[#2563EB]" />
            Importar colaboradores
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-5 mt-1">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Tipo de archivo</p>
              <div className="space-y-2">
                {(["asociados", "servicios"] as const).map((t) => (
                  <label key={t} className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                    tipo === t ? "border-[#2563EB] bg-blue-50" : "border-gray-200 hover:border-[#2563EB] hover:bg-blue-50"
                  }`}>
                    <input type="radio" name="tipo-sync" value={t} checked={tipo === t}
                      onChange={() => { setTipo(t); setArchivo(null); setErrorMsg("") }} className="accent-[#2563EB]" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {t === "asociados" ? "Lista de asociados" : "Servicios por operario"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t === "asociados" ? "Columnas: N° de asociado, Apellido, Nombre, DNI, Celular, Sector... (opcional: Punto QR, Hora Entrada, Horas). En el paso siguiente elegís qué columna es cada dato." : "Columnas: NRO SOC, NOMBRE, OBJETIVO"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                archivo ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-[#2563EB] hover:bg-blue-50"
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setArchivo(f); setErrorMsg("") } }}
            >
              {archivo ? (
                <><CheckCircle2 size={28} className="mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium text-gray-700 truncate px-4">{archivo.name}</p>
                  <p className="text-xs text-gray-400 mt-1">Click para cambiar</p></>
              ) : (
                <><Upload size={28} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">Arrastrá el archivo .xlsx acá</p>
                  <p className="text-xs text-gray-400 mt-1">.xlsx o .xls</p></>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setArchivo(f); setErrorMsg("") } }} />
            {errorMsg && <div className="flex items-center gap-2 text-sm text-red-600"><AlertCircle size={14} className="shrink-0" />{errorMsg}</div>}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
              <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={!archivo} onClick={procesarArchivo}>Procesar →</Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-14">
            <Loader2 size={36} className="animate-spin text-[#2563EB]" />
            <p className="text-sm text-gray-600">Analizando archivo...</p>
          </div>
        )}

        {step === "mapeo" && preview?.tipo === "asociados" && (
          <div className="flex flex-col min-h-0 flex-1 relative mt-1">
            {cambiandoHoja && (
              <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-lg">
                <Loader2 size={24} className="animate-spin text-[#2563EB]" />
              </div>
            )}
            <MapeoStep
              preview={preview}
              mapeo={mapeo}
              onMapeoChange={setMapeo}
              onCambiarHoja={cambiarHoja}
              onVolver={() => setStep("upload")}
              onContinuar={aplicarMapeo}
            />
          </div>
        )}

        {step === "preview" && preview && (
          <div className="flex flex-col min-h-0 flex-1 relative mt-1">
            {cambiandoHoja && (
              <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-lg">
                <Loader2 size={24} className="animate-spin text-[#2563EB]" />
              </div>
            )}
            {preview.tipo === "asociados"
              ? <PreviewAsociadosStep
                  preview={preview}
                  jornadas={jornadas}
                  jornadaId={jornadaId}
                  desactivarAusentes={desactivarAusentes}
                  actualizarExistentes={actualizarExistentes}
                  onJornadaChange={setJornadaId}
                  onDesactivarChange={setDesactivarAusentes}
                  onActualizarChange={setActualizarExistentes}
                  onVolver={() => setStep("mapeo")}
                  onConfirmar={confirmar}
                />
              : <PreviewServiciosStep
                  preview={preview}
                  onCambiarHoja={cambiarHoja}
                  onVolver={() => setStep("upload")}
                  onConfirmar={confirmar}
                />
            }
          </div>
        )}

        {step === "confirming" && (
          <div className="flex flex-col items-center gap-4 py-14">
            <Loader2 size={36} className="animate-spin text-[#2563EB]" />
            <p className="text-sm text-gray-600">Sincronizando colaboradores...</p>
          </div>
        )}

        {step === "done" && resultado && <DoneStep resultado={resultado} omitidos={omitidosPreview} onClose={handleClose} />}
      </DialogContent>
    </Dialog>
  )
}

// ── Mapeo de columnas ─────────────────────────────────────────────────────────

const SIN_COLUMNA = "__none__"

function MapeoStep({
  preview, mapeo, onMapeoChange, onCambiarHoja, onVolver, onContinuar,
}: {
  preview: PreviewAsociados
  mapeo: Mapeo
  onMapeoChange: (m: Mapeo) => void
  onCambiarHoja: (name: string) => void
  onVolver: () => void
  onContinuar: () => void
}) {
  const { columnas, muestra, sheets, sheet_actual } = preview
  const primera = muestra[0] ?? {}
  const problema = mapeoValido(mapeo)
  const usaSeparado = Boolean(mapeo.apellido && mapeo.nombre)
  const palabras = mapeo.palabras_apellido ?? 2

  function setCampo(campo: CampoMapeo, columna: string | null) {
    const nuevo: Mapeo = { ...mapeo }
    if (!columna || columna === SIN_COLUMNA) delete nuevo[campo]
    else nuevo[campo] = columna
    onMapeoChange(nuevo)
  }

  // Vista de cómo queda el nombre con la primera fila, para detectar errores tipo "González González"
  const ejemplo = (() => {
    if (usaSeparado) return { apellido: primera[mapeo.apellido!] ?? "", nombre: primera[mapeo.nombre!] ?? "" }
    if (mapeo.nombre_completo) return separarNombreCompleto(primera[mapeo.nombre_completo] ?? "", palabras)
    return null
  })()

  return (
    <div className="flex flex-col min-h-0 gap-3">
      {sheets.length > 1 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 shrink-0">
          <Layers size={14} className="text-[#2563EB] shrink-0" />
          <span className="text-xs text-gray-600 font-medium">Hoja:</span>
          <Select value={sheet_actual} onValueChange={(v) => v && onCambiarHoja(v)}>
            <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="shrink-0">
        <p className="text-sm font-medium text-gray-800">¿Qué columna del Excel corresponde a cada dato?</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Ya sugerimos las columnas que reconocimos. Revisalas, sobre todo N° de asociado, Apellido y Nombre.
        </p>
      </div>

      <div className="overflow-auto flex-1 min-h-0 border border-gray-100 rounded-xl">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-gray-400 font-medium w-56">Dato</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">Columna del Excel</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium w-48">Ejemplo (1ra fila)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {CAMPOS_MAPEO.map(({ key, label }) => {
              const columna = mapeo[key]
              const principal = key === "legajo" || key === "apellido" || key === "nombre" || key === "nombre_completo"
              const ignorado = key === "nombre_completo" && usaSeparado
              return (
                <tr key={key} className={ignorado ? "opacity-50" : ""}>
                  <td className={`px-3 py-1.5 ${principal ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                    {label}
                    {ignorado && <span className="block text-[10px] font-normal text-gray-400">No se usa: ya elegiste Apellido y Nombre por separado</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    <Select value={columna ?? SIN_COLUMNA} onValueChange={(v) => setCampo(key, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_COLUMNA}>— No usar —</SelectItem>
                        {columnas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 truncate max-w-[12rem]" title={columna ? primera[columna] : ""}>
                    {columna ? (primera[columna] || <span className="text-gray-300">vacío</span>) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!usaSeparado && mapeo.nombre_completo && (
        <div className="flex items-center gap-2 text-xs text-gray-600 shrink-0">
          <span>En la columna combinada, el apellido son las primeras</span>
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onMapeoChange({ ...mapeo, palabras_apellido: n })}
              className={`px-2 py-0.5 rounded border font-medium ${palabras === n ? "bg-[#2563EB] text-white border-[#2563EB]" : "bg-white text-gray-500 border-gray-200"}`}
            >
              {n}
            </button>
          ))}
          <span>palabra{palabras === 1 ? "" : "s"}</span>
        </div>
      )}

      {ejemplo && (
        <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs shrink-0">
          <span className="text-gray-400">Así queda la 1ra fila: </span>
          <span className="text-gray-700">Apellido <strong>{ejemplo.apellido || "—"}</strong> · Nombre <strong>{ejemplo.nombre || "—"}</strong></span>
        </div>
      )}

      {!mapeo.legajo && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shrink-0">
          <AlertCircle size={13} className="shrink-0" />
          Sin columna de N° de asociado no se pueden detectar duplicados por legajo (se usará el DNI).
        </div>
      )}

      {problema && (
        <div className="flex items-center gap-2 text-xs text-red-600 shrink-0">
          <AlertCircle size={13} className="shrink-0" />{problema}
        </div>
      )}

      <div className="flex gap-2 pt-1 shrink-0">
        <Button variant="outline" className="flex-1" onClick={onVolver}><ChevronLeft size={15} className="mr-1" /> Volver</Button>
        <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={!!problema} onClick={onContinuar}>
          Ver vista previa →
        </Button>
      </div>
    </div>
  )
}

// ── Preview Asociados ──────────────────────────────────────────────────────────

type TabId = "creados" | "actualizados" | "repetidos" | "desactivados"

function PreviewAsociadosStep({
  preview, jornadas, jornadaId, desactivarAusentes, actualizarExistentes,
  onJornadaChange, onDesactivarChange, onActualizarChange, onVolver, onConfirmar,
}: {
  preview: PreviewAsociados
  jornadas: JornadaOpcion[]
  jornadaId: string | null
  desactivarAusentes: boolean
  actualizarExistentes: boolean
  onJornadaChange: (id: string | null) => void
  onDesactivarChange: (v: boolean) => void
  onActualizarChange: (v: boolean) => void
  onVolver: () => void
  onConfirmar: () => void
}) {
  const { creados, actualizados, sinCambios, duplicados_archivo, desactivados, sinPuntoQr } = preview

  const tabs: { id: TabId; label: string; color: string; count: number }[] = [
    ...(creados.length > 0 ? [{ id: "creados" as TabId, label: "Nuevos", color: "green", count: creados.length }] : []),
    ...(actualizados.length > 0 ? [{ id: "actualizados" as TabId, label: "Ya existen", color: "amber", count: actualizados.length }] : []),
    ...(duplicados_archivo.length > 0 ? [{ id: "repetidos" as TabId, label: "Repetidos en el archivo", color: "amber", count: duplicados_archivo.length }] : []),
    ...(desactivados.length > 0 ? [{ id: "desactivados" as TabId, label: "Ausentes", color: "red", count: desactivados.length }] : []),
  ]
  const [tabActiva, setTabActiva] = useState<TabId>(tabs[0]?.id ?? "creados")
  const aplicarActualizados = actualizarExistentes ? actualizados.length : 0
  const totalCambios = creados.length + aplicarActualizados
  const totalParaAsignar = totalCambios

  const tabColors: Record<string, { active: string; inactive: string }> = {
    green: { active: "bg-green-50 text-green-700 border-green-200", inactive: "text-gray-500 hover:text-green-600" },
    amber: { active: "bg-amber-50 text-amber-700 border-amber-200", inactive: "text-gray-500 hover:text-amber-600" },
    red: { active: "bg-red-50 text-red-700 border-red-200", inactive: "text-gray-500 hover:text-red-600" },
  }

  const conDetalle = tabActiva === "creados" || tabActiva === "actualizados"

  return (
    <div className="flex flex-col min-h-0 gap-3">
      {/* Resumen rápido */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {creados.length > 0 && <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">+{creados.length} nuevos</span>}
        {actualizados.length > 0 && (
          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
            {actualizados.length} ya existen {actualizarExistentes ? "(se actualizan)" : "(se omiten)"}
          </span>
        )}
        {duplicados_archivo.length > 0 && <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">{duplicados_archivo.length} repetidos en el archivo (se omiten)</span>}
        {sinCambios > 0 && <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{sinCambios} sin cambios</span>}
        {desactivados.length > 0 && <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">{desactivados.length} ausentes</span>}
        {creados.length + actualizados.length === 0 && sinCambios === 0 && <span className="text-xs text-gray-400">No se encontraron datos</span>}
      </div>

      {sinPuntoQr.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shrink-0">
          <p className="text-xs font-semibold text-amber-700 mb-0.5">
            {sinPuntoQr.length} fila{sinPuntoQr.length !== 1 ? "s" : ""} con Punto QR no encontrado (no se asignó jornada)
          </p>
          <p className="text-xs text-amber-600">{sinPuntoQr.slice(0, 5).join(", ")}{sinPuntoQr.length > 5 ? ` y ${sinPuntoQr.length - 5} más` : ""}</p>
        </div>
      )}

      {/* Tabs + tabla */}
      {tabs.length > 0 && (
        <div className="flex flex-col min-h-0 flex-1 border border-gray-100 rounded-xl overflow-hidden">
          <div className="flex border-b border-gray-100 shrink-0 bg-gray-50">
            {tabs.map((t) => {
              const isActive = tabActiva === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTabActiva(t.id)}
                  className={`flex-1 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    isActive ? tabColors[t.color].active + " border-current" : "border-transparent " + tabColors[t.color].inactive
                  }`}
                >
                  {t.label} <span className="ml-1 font-bold">{t.count}</span>
                </button>
              )
            })}
          </div>

          {tabActiva === "actualizados" && (
            <div className="border-b border-gray-100 px-4 py-3 bg-amber-50/60 shrink-0">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={actualizarExistentes} onChange={(e) => onActualizarChange(e.target.checked)} className="mt-0.5 accent-[#2563EB]" />
                <div>
                  <p className="text-sm text-gray-800 font-medium">Actualizar los datos de estos {actualizados.length} colaboradores</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Su N° de asociado ya está cargado. Si no lo tildás, se omiten y quedan en el reporte.
                  </p>
                </div>
              </label>
            </div>
          )}

          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-400 font-medium w-16">Legajo</th>
                  <th className="px-3 py-2 text-left text-gray-400 font-medium">Apellido</th>
                  <th className="px-3 py-2 text-left text-gray-400 font-medium">Nombre</th>
                  {tabActiva === "actualizados" && <th className="px-3 py-2 text-left text-gray-400 font-medium">Hoy en el sistema</th>}
                  {conDetalle && <>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium w-24">DNI</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium w-32">Celular</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium w-36">Punto QR / Horario</th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tabActiva === "repetidos" && duplicados_archivo.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-mono text-gray-400">{d.legajo}</td>
                    <td colSpan={2} className="px-3 py-1.5 text-gray-700">{d.nombre} <span className="text-amber-600">— legajo repetido, se usa solo la primera fila</span></td>
                  </tr>
                ))}
                {tabActiva === "desactivados" && desactivados.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-1.5 font-mono text-gray-400">{d.legajo || "—"}</td>
                    <td className="px-3 py-1.5 text-gray-700 font-medium">{d.apellido}</td>
                    <td className="px-3 py-1.5 text-gray-600">{d.nombre}</td>
                  </tr>
                ))}
                {conDetalle && (tabActiva === "creados" ? creados : actualizados).map((f, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-3 py-1.5 font-mono text-gray-400">{f.legajo || "—"}</td>
                    <td className="px-3 py-1.5 text-gray-700 font-medium">{f.apellido}</td>
                    <td className="px-3 py-1.5 text-gray-600">{f.nombre || <span className="text-gray-300">—</span>}</td>
                    {tabActiva === "actualizados" && <td className="px-3 py-1.5 text-gray-500">{(f as FilaExistente).titular}</td>}
                    <td className="px-3 py-1.5 text-gray-500">{f.identificacion || "—"}</td>
                    <td className="px-3 py-1.5 text-gray-400 text-xs">{f.celular || "—"}</td>
                    <td className="px-3 py-1.5 text-xs">
                      {f.punto_qr_nombre ? (
                        f.punto_qr_id ? (
                          <span className="text-gray-600">
                            {f.punto_qr_nombre}
                            {f.hora_entrada && <span className="text-gray-400"> · {f.hora_entrada}–{f.hora_salida}</span>}
                          </span>
                        ) : (
                          <span className="text-amber-600">{f.punto_qr_nombre} (no encontrado)</span>
                        )
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tabActiva === "desactivados" && desactivados.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 bg-white shrink-0">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={desactivarAusentes} onChange={(e) => onDesactivarChange(e.target.checked)} className="mt-0.5 accent-red-500" />
                <div>
                  <p className="text-sm text-red-700 font-medium">Desactivar estos {desactivados.length} colaboradores ausentes del archivo</p>
                  <p className="text-xs text-gray-400 mt-0.5">Solo si subiste la lista completa del grupo</p>
                </div>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Jornada */}
      {totalParaAsignar > 0 && (
        <div className="space-y-1.5 shrink-0">
          <p className="text-sm font-medium text-gray-700">Asignar jornada a los {totalParaAsignar} colaboradores (opcional)</p>
          <Select value={jornadaId ?? "none"} onValueChange={(v) => onJornadaChange(v === "none" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Sin asignar jornada" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar jornada</SelectItem>
              {jornadas.map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.nombre} — {j.punto_fichaje.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2 pt-1 shrink-0">
        <Button variant="outline" className="flex-1" onClick={onVolver}><ChevronLeft size={15} className="mr-1" /> Columnas</Button>
        <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={onConfirmar} disabled={totalCambios === 0 && !desactivarAusentes}>
          Confirmar importación
        </Button>
      </div>
    </div>
  )
}


// ── Preview Servicios ──────────────────────────────────────────────────────────

function PreviewServiciosStep({
  preview, onCambiarHoja, onVolver, onConfirmar,
}: {
  preview: PreviewServicios
  onCambiarHoja: (name: string) => void
  onVolver: () => void
  onConfirmar: () => void
}) {
  const { asignaciones, sinColaborador, sinPunto, sheets, sheet_actual } = preview
  const [expandido, setExpandido] = useState<string | null>(null)

  return (
    <div className="flex flex-col min-h-0 gap-3">
      {sheets.length > 1 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 shrink-0">
          <Layers size={14} className="text-[#2563EB] shrink-0" />
          <span className="text-xs text-gray-600 font-medium">Hoja:</span>
          <Select value={sheet_actual} onValueChange={(v) => v && onCambiarHoja(v)}>
            <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none px-1 focus:ring-0"><SelectValue /></SelectTrigger>
            <SelectContent>{sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">{asignaciones.length} colaboradores con servicios</span>
        {sinColaborador.length > 0 && <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">{sinColaborador.length} no encontrados</span>}
        {sinPunto.length > 0 && <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">{sinPunto.length} objetivos sin punto QR</span>}
      </div>

      {/* Tabla de colaboradores con servicios */}
      <div className="flex flex-col min-h-0 flex-1 border border-gray-100 rounded-xl overflow-hidden">
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-xs min-w-[500px]">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-gray-400 font-medium w-20">Legajo</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Apellido</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Nombre</th>
                <th className="px-3 py-2 text-left text-gray-400 font-medium">Objetivos / Servicios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {asignaciones.map((f, i) => (
                <tr key={i} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpandido(expandido === f.legajo ? null : f.legajo)}>
                  <td className="px-3 py-2 font-mono text-gray-400">{f.legajo || "—"}</td>
                  <td className="px-3 py-2 text-gray-700 font-medium">{f.apellido}</td>
                  <td className="px-3 py-2 text-gray-600">{f.nombre}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {expandido === f.legajo
                      ? <div className="space-y-0.5">{f.objetivos.map((o) => <div key={o} className="text-blue-600">• {o}</div>)}</div>
                      : <span className="text-gray-400">{f.objetivos.length} objetivo{f.objetivos.length !== 1 ? "s" : ""} — click para ver</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sinColaborador.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 bg-amber-50 shrink-0">
            <p className="text-xs font-semibold text-amber-700 mb-1">No encontrados en el sistema ({sinColaborador.length})</p>
            <p className="text-xs text-amber-600">{sinColaborador.slice(0, 5).join(", ")}{sinColaborador.length > 5 ? ` y ${sinColaborador.length - 5} más` : ""}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1 shrink-0">
        <Button variant="outline" className="flex-1" onClick={onVolver}><ChevronLeft size={15} className="mr-1" /> Volver</Button>
        <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={asignaciones.length === 0} onClick={onConfirmar}>
          Confirmar asignaciones
        </Button>
      </div>
    </div>
  )
}

// ── Done ──────────────────────────────────────────────────────────────────────

function DoneStep({ resultado, omitidos, onClose }: { resultado: Resultado; omitidos: OmitidosPreview; onClose: () => void }) {
  if (!("creados" in resultado)) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <CheckCircle2 size={48} className="text-green-500" />
        <div className="text-center">
          <p className="font-semibold text-gray-900 text-lg">¡Asignaciones completas!</p>
          <p className="text-sm text-gray-500 mt-2">{resultado.actualizados} colaboradores actualizados</p>
        </div>
        <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8" onClick={onClose}>Listo</Button>
      </div>
    )
  }

  const r = resultado
  const errores = r.errores ?? []
  const omitidosServidor = r.legajos_omitidos ?? []
  const totalOmitidos = omitidos.existentes.length + omitidos.repetidos.length + omitidosServidor.length
  const detalleOmitidos = [
    ...omitidos.existentes.map((f) => ({ fila: `${f.legajo || "—"} — ${f.apellido} ${f.nombre}`, motivo: `N° de asociado ya cargado (${f.titular})` })),
    ...omitidos.repetidos.map((d) => ({ fila: `${d.legajo} — ${d.nombre}`, motivo: "Repetido en el archivo" })),
    ...omitidosServidor.map((l) => ({ fila: l, motivo: "N° de asociado ya cargado" })),
  ]

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center gap-3">
        {errores.length > 0
          ? <AlertCircle size={36} className="text-amber-500 shrink-0" />
          : <CheckCircle2 size={36} className="text-green-500 shrink-0" />}
        <div>
          <p className="font-semibold text-gray-900 text-lg">Reporte de importación</p>
          <p className="text-xs text-gray-400">
            {r.creados} creados · {r.actualizados} actualizados{r.desactivados > 0 ? ` · ${r.desactivados} desactivados` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
          <p className="text-2xl font-bold text-green-700">{r.exitosos}</p>
          <p className="text-xs text-green-700">Exitosos</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-2xl font-bold text-amber-700">{totalOmitidos}</p>
          <p className="text-xs text-amber-700">Omitidos (duplicados)</p>
        </div>
        <div className={`rounded-xl border px-3 py-2.5 ${errores.length > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
          <p className={`text-2xl font-bold ${errores.length > 0 ? "text-red-600" : "text-gray-400"}`}>{errores.length}</p>
          <p className={`text-xs ${errores.length > 0 ? "text-red-600" : "text-gray-400"}`}>Con error</p>
        </div>
      </div>

      {(detalleOmitidos.length > 0 || errores.length > 0) && (
        <div className="max-h-56 overflow-auto border border-gray-100 rounded-xl">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-gray-50">
              {errores.map((e, i) => (
                <tr key={`e${i}`}>
                  <td className="px-3 py-1.5 text-gray-700">{e.fila}</td>
                  <td className="px-3 py-1.5 text-red-600">{e.motivo}</td>
                </tr>
              ))}
              {detalleOmitidos.map((o, i) => (
                <tr key={`o${i}`}>
                  <td className="px-3 py-1.5 text-gray-700">{o.fila}</td>
                  <td className="px-3 py-1.5 text-amber-700">{o.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white self-center px-8" onClick={onClose}>Listo</Button>
    </div>
  )
}

