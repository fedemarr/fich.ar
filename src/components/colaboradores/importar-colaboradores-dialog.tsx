"use client"

import { useState, useRef } from "react"
import {
  Upload, CheckCircle2, AlertCircle, Loader2, ChevronLeft, RefreshCw, Layers,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

type Tipo = "asociados" | "servicios"
type Step = "upload" | "processing" | "preview" | "confirming" | "done"

interface FilaAsociado {
  legajo: string
  apellido: string
  nombre: string
  identificacion: string
  domicilio: string
}

interface ColabDesactivado {
  id: string
  legajo: string
  apellido: string
  nombre: string
}

interface PreviewAsociados {
  tipo: "asociados"
  sheets: string[]
  sheet_actual: string
  creados: FilaAsociado[]
  actualizados: FilaAsociado[]
  sinCambios: number
  desactivados: ColabDesactivado[]
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

interface ResultadoAsociados { ok: boolean; creados: number; actualizados: number; desactivados: number }
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
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload"); setArchivo(null); setPreview(null); setResultado(null)
    setErrorMsg(""); setJornadaId(null); setDesactivarAusentes(false); setCambiandoHoja(false)
  }

  function handleClose() {
    if (step === "done") onSuccess()
    else onClose()
    setTimeout(reset, 300)
  }

  async function fetchPreview(file: File, tipoParam: Tipo, sheetName?: string) {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("tipo", tipoParam)
    if (sheetName) fd.append("sheet_name", sheetName)
    const res = await fetch("/api/colaboradores/sincronizar/preview", { method: "POST", body: fd })
    const data = (await res.json()) as { error?: string } & Partial<Preview>
    if (!res.ok || data.error) throw new Error(data.error ?? "Error al procesar el archivo")
    return data as Preview
  }

  async function procesarArchivo() {
    if (!archivo) return
    setStep("processing"); setErrorMsg("")
    try {
      const data = await fetchPreview(archivo, tipo)
      setPreview(data); setStep("preview")
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error al procesar"); setStep("upload")
    }
  }

  async function cambiarHoja(sheetName: string) {
    if (!archivo || !preview) return
    setCambiandoHoja(true)
    try {
      const data = await fetchPreview(archivo, tipo, sheetName)
      setPreview(data)
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
      body = {
        tipo: "asociados",
        creados: preview.creados,
        actualizados: preview.actualizados,
        desactivarIds: desactivarAusentes ? preview.desactivados.map((d) => d.id) : [],
        jornada_id: jornadaId ?? undefined,
      }
    } else {
      body = { tipo: "servicios", asignaciones: preview.asignaciones }
    }
    try {
      const res = await fetch("/api/colaboradores/sincronizar/confirmar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string } & Partial<Resultado>
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error al sincronizar"); setStep("preview"); return
      }
      setResultado(data as Resultado); setStep("done")
    } catch {
      toast.error("Error de conexión"); setStep("preview")
    }
  }

  const esPreview = step === "preview"

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
                        {t === "asociados" ? "Columnas: NRO SOC, NOMBRE, DNI, DOMICILIO" : "Columnas: NRO SOC, NOMBRE, OBJETIVO"}
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
                  onJornadaChange={setJornadaId}
                  onDesactivarChange={setDesactivarAusentes}
                  onCambiarHoja={cambiarHoja}
                  onVolver={() => setStep("upload")}
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

        {step === "done" && resultado && <DoneStep resultado={resultado} onClose={handleClose} />}
      </DialogContent>
    </Dialog>
  )
}

// ── Preview Asociados ──────────────────────────────────────────────────────────

type TabId = "creados" | "actualizados" | "desactivados"

function PreviewAsociadosStep({
  preview, jornadas, jornadaId, desactivarAusentes,
  onJornadaChange, onDesactivarChange, onCambiarHoja, onVolver, onConfirmar,
}: {
  preview: PreviewAsociados
  jornadas: JornadaOpcion[]
  jornadaId: string | null
  desactivarAusentes: boolean
  onJornadaChange: (id: string | null) => void
  onDesactivarChange: (v: boolean) => void
  onCambiarHoja: (name: string) => void
  onVolver: () => void
  onConfirmar: () => void
}) {
  const { creados, actualizados, sinCambios, desactivados, sheets, sheet_actual } = preview

  const tabs: { id: TabId; label: string; color: string; count: number }[] = [
    ...(creados.length > 0 ? [{ id: "creados" as TabId, label: "Nuevos", color: "green", count: creados.length }] : []),
    ...(actualizados.length > 0 ? [{ id: "actualizados" as TabId, label: "Actualizados", color: "blue", count: actualizados.length }] : []),
    ...(desactivados.length > 0 ? [{ id: "desactivados" as TabId, label: "Ausentes", color: "red", count: desactivados.length }] : []),
  ]
  const [tabActiva, setTabActiva] = useState<TabId>(tabs[0]?.id ?? "creados")
  const totalParaAsignar = creados.length + actualizados.length
  const totalCambios = creados.length + actualizados.length

  const tabColors: Record<string, { active: string; inactive: string }> = {
    green: { active: "bg-green-50 text-green-700 border-green-200", inactive: "text-gray-500 hover:text-green-600" },
    blue: { active: "bg-blue-50 text-blue-700 border-blue-200", inactive: "text-gray-500 hover:text-blue-600" },
    red: { active: "bg-red-50 text-red-700 border-red-200", inactive: "text-gray-500 hover:text-red-600" },
  }

  const filasMostradas: Array<FilaAsociado | ColabDesactivado> =
    tabActiva === "creados" ? creados
    : tabActiva === "actualizados" ? actualizados
    : desactivados

  return (
    <div className="flex flex-col min-h-0 gap-3">
      {/* Selector de hoja */}
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

      {/* Resumen rápido */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {creados.length > 0 && <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">+{creados.length} nuevos</span>}
        {actualizados.length > 0 && <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full">~{actualizados.length} actualizados</span>}
        {sinCambios > 0 && <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{sinCambios} sin cambios</span>}
        {desactivados.length > 0 && <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">{desactivados.length} ausentes</span>}
        {totalCambios === 0 && sinCambios === 0 && <span className="text-xs text-gray-400">No se encontraron datos</span>}
      </div>

      {/* Tabs + tabla */}
      {tabs.length > 0 && (
        <div className="flex flex-col min-h-0 flex-1 border border-gray-100 rounded-xl overflow-hidden">
          {/* Tab bar */}
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

          {/* Tabla de filas */}
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-400 font-medium w-20">Legajo</th>
                  <th className="px-3 py-2 text-left text-gray-400 font-medium">Apellido</th>
                  <th className="px-3 py-2 text-left text-gray-400 font-medium">Nombre</th>
                  {tabActiva !== "desactivados" && <>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium w-28">DNI</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Domicilio</th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filasMostradas.map((f, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-3 py-1.5 font-mono text-gray-400">{f.legajo || "—"}</td>
                    <td className="px-3 py-1.5 text-gray-700 font-medium">{f.apellido}</td>
                    <td className="px-3 py-1.5 text-gray-600">{f.nombre}</td>
                    {tabActiva !== "desactivados" && <>
                      <td className="px-3 py-1.5 text-gray-500">{(f as FilaAsociado).identificacion || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-400 max-w-[200px] truncate" title={(f as FilaAsociado).domicilio}>
                        {(f as FilaAsociado).domicilio || "—"}
                      </td>
                    </>}
                  </tr>
                ))}
                {filasMostradas.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Sin filas</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Checkbox desactivar (solo en tab ausentes) */}
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
        <Button variant="outline" className="flex-1" onClick={onVolver}><ChevronLeft size={15} className="mr-1" /> Volver</Button>
        <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={onConfirmar} disabled={totalCambios === 0 && !desactivarAusentes}>
          Confirmar sincronización
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

function DoneStep({ resultado, onClose }: { resultado: Resultado; onClose: () => void }) {
  const r = resultado as ResultadoAsociados & ResultadoServicios
  const sinCambios = "creados" in r && r.creados === 0 && r.actualizados === 0 && r.desactivados === 0
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <CheckCircle2 size={48} className="text-green-500" />
      <div className="text-center">
        <p className="font-semibold text-gray-900 text-lg">¡Sincronización completa!</p>
        <div className="text-sm text-gray-500 mt-2 space-y-0.5">
          {sinCambios && <p>Sin cambios — todo estaba al día</p>}
          {"creados" in r && r.creados > 0 && <p>{r.creados} colaboradores creados</p>}
          {r.actualizados > 0 && <p>{r.actualizados} colaboradores actualizados</p>}
          {"desactivados" in r && r.desactivados > 0 && <p>{r.desactivados} colaboradores desactivados</p>}
        </div>
      </div>
      <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8" onClick={onClose}>Listo</Button>
    </div>
  )
}
