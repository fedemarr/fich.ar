"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle2, AlertCircle, Loader2, ChevronLeft, MapPin } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import * as XLSX from "xlsx"

type Step = "upload" | "preview" | "importing" | "done"

interface FilaPunto {
  nombre: string
  latitud: string
  longitud: string
  radio: string
  _valida: boolean
  _error?: string
}

interface Resultado {
  creados: number
  actualizados: number
  errores: string[]
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function parsearArchivo(file: File): Promise<FilaPunto[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: "array" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
        const filas: FilaPunto[] = rows.map((r) => {
          const nombre = String(r["Nombre"] ?? r["nombre"] ?? r["NOMBRE"] ?? "").trim()
          const latitud = String(r["Latitud"] ?? r["latitud"] ?? r["LATITUD"] ?? "").trim()
          const longitud = String(r["Longitud"] ?? r["longitud"] ?? r["LONGITUD"] ?? "").trim()
          const radio = String(r["Radio"] ?? r["radio"] ?? r["RADIO"] ?? "200").trim()
          let _valida = true
          let _error = ""
          if (!nombre) { _valida = false; _error = "Nombre vacío" }
          else if (isNaN(parseFloat(latitud)) || parseFloat(latitud) < -90 || parseFloat(latitud) > 90) { _valida = false; _error = "Latitud inválida" }
          else if (isNaN(parseFloat(longitud)) || parseFloat(longitud) < -180 || parseFloat(longitud) > 180) { _valida = false; _error = "Longitud inválida" }
          return { nombre, latitud, longitud, radio: radio || "200", _valida, _error }
        })
        resolve(filas)
      } catch {
        reject(new Error("No se pudo leer el archivo"))
      }
    }
    reader.onerror = () => reject(new Error("Error al leer el archivo"))
    reader.readAsArrayBuffer(file)
  })
}

export function ImportarServiciosModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload")
  const [archivo, setArchivo] = useState<File | null>(null)
  const [filas, setFilas] = useState<FilaPunto[]>([])
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload"); setArchivo(null); setFilas([]); setResultado(null)
  }

  function handleClose() {
    if (step === "done") onSuccess()
    else onClose()
    setTimeout(reset, 300)
  }

  async function procesarArchivo(file: File) {
    try {
      const parsed = await parsearArchivo(file)
      if (parsed.length === 0) { toast.error("El archivo no tiene filas"); return }
      setFilas(parsed)
      setArchivo(file)
      setStep("preview")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al leer el archivo")
    }
  }

  async function importar() {
    if (!archivo) return
    setStep("importing")
    const fd = new FormData()
    fd.append("file", archivo)
    try {
      const res = await fetch("/api/puntos/importar-servicios", { method: "POST", body: fd })
      const data = await res.json() as { error?: string } & Partial<Resultado>
      if (!res.ok || data.error) { toast.error(data.error ?? "Error al importar"); setStep("preview"); return }
      setResultado({ creados: data.creados ?? 0, actualizados: data.actualizados ?? 0, errores: data.errores ?? [] })
      setStep("done")
    } catch {
      toast.error("Error de conexión"); setStep("preview")
    }
  }

  const filasValidas = filas.filter((f) => f._valida)
  const filasConError = filas.filter((f) => !f._valida)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className={step === "preview" ? "max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin size={16} className="text-[#2563EB]" />
            Importar puntos QR desde Excel
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-gray-500">
              El archivo debe tener las columnas: <strong>Nombre</strong>, <strong>Latitud</strong>, <strong>Longitud</strong>, <strong>Radio</strong> (opcional, default 200m).
            </p>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                archivo ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-[#2563EB] hover:bg-blue-50"
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) procesarArchivo(f) }}
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
              onChange={(e) => { const f = e.target.files?.[0]; if (f) procesarArchivo(f) }} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
              <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={!archivo} onClick={() => archivo && procesarArchivo(archivo)}>
                Previsualizar →
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col min-h-0 gap-3 mt-1">
            {/* Resumen */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">{filasValidas.length} punto{filasValidas.length !== 1 ? "s" : ""} para importar</span>
              {filasConError.length > 0 && (
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">{filasConError.length} fila{filasConError.length !== 1 ? "s" : ""} con error</span>
              )}
            </div>

            {/* Tabla */}
            <div className="flex flex-col min-h-0 flex-1 border border-gray-100 rounded-xl overflow-hidden">
              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-xs min-w-[480px]">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-400 font-medium">Nombre</th>
                      <th className="px-3 py-2 text-left text-gray-400 font-medium w-28">Latitud</th>
                      <th className="px-3 py-2 text-left text-gray-400 font-medium w-28">Longitud</th>
                      <th className="px-3 py-2 text-left text-gray-400 font-medium w-20">Radio (m)</th>
                      <th className="px-3 py-2 text-left text-gray-400 font-medium w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filas.map((f, i) => (
                      <tr key={i} className={f._valida ? "hover:bg-gray-50/50" : "bg-red-50/50"}>
                        <td className="px-3 py-2 text-gray-700 font-medium">
                          {f.nombre || <span className="text-red-400 italic">vacío</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-500">{f.latitud || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{f.longitud || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 text-gray-400">{f.radio}</td>
                        <td className="px-3 py-2">
                          {f._valida
                            ? <CheckCircle2 size={12} className="text-green-400" />
                            : <span title={f._error}><AlertCircle size={12} className="text-red-400" /></span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filasConError.length > 0 && (
                <div className="border-t border-red-100 px-4 py-2.5 bg-red-50 shrink-0">
                  <p className="text-xs text-red-600 font-medium">Las filas con error serán omitidas durante la importación.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1 shrink-0">
              <Button variant="outline" className="flex-1" onClick={() => { setStep("upload"); setFilas([]) }}>
                <ChevronLeft size={15} className="mr-1" /> Volver
              </Button>
              <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={filasValidas.length === 0} onClick={importar}>
                Importar {filasValidas.length} punto{filasValidas.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 size={36} className="animate-spin text-[#2563EB]" />
            <p className="text-sm text-gray-600">Importando puntos...</p>
          </div>
        )}

        {step === "done" && resultado && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 size={44} className="text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-gray-900 text-lg">¡Importación completa!</p>
              <div className="text-sm text-gray-500 mt-2 space-y-0.5">
                {resultado.creados > 0 && <p>{resultado.creados} puntos creados</p>}
                {resultado.actualizados > 0 && <p>{resultado.actualizados} puntos actualizados</p>}
                {resultado.creados === 0 && resultado.actualizados === 0 && <p>Sin cambios</p>}
              </div>
            </div>
            {resultado.errores.length > 0 && (
              <div className="w-full border border-amber-200 rounded-lg p-3 bg-amber-50">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
                  <AlertCircle size={13} /> {resultado.errores.length} filas con errores
                </div>
                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                  {resultado.errores.map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}
                </div>
              </div>
            )}
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8" onClick={handleClose}>
              Listo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
