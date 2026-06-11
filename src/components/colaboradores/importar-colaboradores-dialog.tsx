"use client"

import { useState, useRef } from "react"
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  RefreshCw,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Tipo = "asociados" | "servicios"
type Step = "upload" | "processing" | "preview" | "confirming" | "done"

interface FilaAsociado {
  legajo: string
  apellido: string
  nombre: string
  identificacion: string
  sector: string
}

interface ColabDesactivado {
  id: string
  legajo: string
  apellido: string
  nombre: string
}

interface PreviewAsociados {
  tipo: "asociados"
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
  asignaciones: FilaServicio[]
  sinColaborador: string[]
  sinPunto: string[]
}

type Preview = PreviewAsociados | PreviewServicios

interface ResultadoAsociados {
  ok: boolean
  creados: number
  actualizados: number
  desactivados: number
}

interface ResultadoServicios {
  ok: boolean
  actualizados: number
}

type Resultado = ResultadoAsociados | ResultadoServicios

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ImportarColaboradoresDialog({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload")
  const [tipo, setTipo] = useState<Tipo>("asociados")
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload")
    setArchivo(null)
    setPreview(null)
    setResultado(null)
    setErrorMsg("")
  }

  function handleClose() {
    if (step === "done") onSuccess()
    else onClose()
    setTimeout(reset, 300)
  }

  function handleFileSelect(file: File) {
    setArchivo(file)
    setErrorMsg("")
  }

  async function procesarArchivo() {
    if (!archivo) return
    setStep("processing")
    setErrorMsg("")

    const fd = new FormData()
    fd.append("file", archivo)
    fd.append("tipo", tipo)

    try {
      const res = await fetch("/api/colaboradores/sincronizar/preview", { method: "POST", body: fd })
      const data = (await res.json()) as { error?: string } & Partial<Preview>
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? "Error al procesar el archivo")
        setStep("upload")
        return
      }
      setPreview(data as Preview)
      setStep("preview")
    } catch {
      setErrorMsg("Error de conexión")
      setStep("upload")
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
        desactivarIds: preview.desactivados.map((d) => d.id),
      }
    } else {
      body = { tipo: "servicios", asignaciones: preview.asignaciones }
    }

    try {
      const res = await fetch("/api/colaboradores/sincronizar/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string } & Partial<Resultado>
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error al sincronizar")
        setStep("preview")
        return
      }
      setResultado(data as Resultado)
      setStep("done")
    } catch {
      toast.error("Error de conexión")
      setStep("preview")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw size={17} className="text-[#2563EB]" />
            Sincronizar colaboradores
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <UploadStep
            tipo={tipo}
            archivo={archivo}
            errorMsg={errorMsg}
            inputRef={inputRef}
            onTipoChange={setTipo}
            onFileSelect={handleFileSelect}
            onCancelar={handleClose}
            onProcesar={procesarArchivo}
          />
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-14">
            <Loader2 size={36} className="animate-spin text-[#2563EB]" />
            <p className="text-sm text-gray-600">Analizando archivo...</p>
          </div>
        )}

        {step === "preview" && preview && (
          <PreviewStep preview={preview} onVolver={() => setStep("upload")} onConfirmar={confirmar} />
        )}

        {step === "confirming" && (
          <div className="flex flex-col items-center gap-4 py-14">
            <Loader2 size={36} className="animate-spin text-[#2563EB]" />
            <p className="text-sm text-gray-600">Sincronizando colaboradores...</p>
          </div>
        )}

        {step === "done" && resultado && (
          <DoneStep resultado={resultado} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Subcomponentes ────────────────────────────────────────────────────────────

interface UploadStepProps {
  tipo: Tipo
  archivo: File | null
  errorMsg: string
  inputRef: React.RefObject<HTMLInputElement>
  onTipoChange: (t: Tipo) => void
  onFileSelect: (f: File) => void
  onCancelar: () => void
  onProcesar: () => void
}

function UploadStep({ tipo, archivo, errorMsg, inputRef, onTipoChange, onFileSelect, onCancelar, onProcesar }: UploadStepProps) {
  return (
    <div className="space-y-5 mt-1">
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Tipo de archivo</p>
        <div className="space-y-2">
          {(["asociados", "servicios"] as const).map((t) => (
            <label
              key={t}
              className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                tipo === t
                  ? "border-[#2563EB] bg-blue-50"
                  : "border-gray-200 hover:border-[#2563EB] hover:bg-blue-50"
              }`}
            >
              <input
                type="radio"
                name="tipo-sync"
                value={t}
                checked={tipo === t}
                onChange={() => onTipoChange(t)}
                className="accent-[#2563EB]"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {t === "asociados" ? "Lista de asociados" : "Servicios por operario"}
                </p>
                <p className="text-xs text-gray-400">
                  {t === "asociados"
                    ? "Columnas: NRO SOC, NOMBRE, DNI, DOMICILIO"
                    : "Columnas: NRO SOC, NOMBRE, OBJETIVO"}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          archivo
            ? "border-green-300 bg-green-50"
            : "border-gray-200 hover:border-[#2563EB] hover:bg-blue-50"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files[0]
          if (f) onFileSelect(f)
        }}
      >
        {archivo ? (
          <>
            <CheckCircle2 size={28} className="mx-auto mb-2 text-green-500" />
            <p className="text-sm font-medium text-gray-700 truncate px-4">{archivo.name}</p>
            <p className="text-xs text-gray-400 mt-1">Click para cambiar</p>
          </>
        ) : (
          <>
            <Upload size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Arrastrá el archivo .xlsx acá</p>
            <p className="text-xs text-gray-400 mt-1">.xlsx o .xls</p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFileSelect(f)
        }}
      />

      {errorMsg && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={14} className="shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
          disabled={!archivo}
          onClick={onProcesar}
        >
          Procesar →
        </Button>
      </div>
    </div>
  )
}

function PreviewStep({
  preview,
  onVolver,
  onConfirmar,
}: {
  preview: Preview
  onVolver: () => void
  onConfirmar: () => void
}) {
  if (preview.tipo === "asociados") {
    const { creados, actualizados, sinCambios, desactivados } = preview
    const totalCambios = creados.length + actualizados.length + desactivados.length

    return (
      <div className="space-y-4 mt-1">
        <p className="text-sm font-semibold text-gray-700">Resumen de cambios</p>

        <div className="space-y-2">
          {sinCambios > 0 && (
            <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5">
              <CheckCircle2 size={15} className="text-gray-400 shrink-0" />
              <span>
                <strong>{sinCambios}</strong> colaboradores sin cambios
              </span>
            </div>
          )}
          {actualizados.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2.5">
              <RefreshCw size={15} className="text-blue-500 shrink-0" />
              <span>
                <strong>{actualizados.length}</strong> colaboradores con datos actualizados
              </span>
            </div>
          )}
          {creados.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2.5">
              <span className="shrink-0 font-bold text-green-600">+</span>
              <span>
                <strong>{creados.length}</strong> colaboradores nuevos — se dan de alta
              </span>
            </div>
          )}
          {desactivados.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2.5">
                <AlertCircle size={15} className="text-red-500 shrink-0" />
                <span>
                  <strong>{desactivados.length}</strong> colaboradores se van a DESACTIVAR
                </span>
              </div>
              <div className="border border-red-100 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-3 py-1.5 border-b border-red-100">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                    Desactivados
                  </p>
                </div>
                <div className="max-h-32 overflow-y-auto divide-y divide-gray-50">
                  {desactivados.map((d) => (
                    <p key={d.id} className="px-3 py-1.5 text-xs text-gray-600">
                      {d.legajo} — {d.apellido} {d.nombre}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
          {totalCambios === 0 && (
            <div className="flex items-center gap-3 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-4 justify-center">
              <CheckCircle2 size={18} className="text-green-500" />
              Todo está al día — no hay cambios para aplicar
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onVolver}>
            <ChevronLeft size={15} className="mr-1" /> Volver
          </Button>
          <Button
            className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            onClick={onConfirmar}
          >
            Confirmar sincronización
          </Button>
        </div>
      </div>
    )
  }

  // Servicios
  const { asignaciones, sinColaborador, sinPunto } = preview
  return (
    <div className="space-y-4 mt-1">
      <p className="text-sm font-semibold text-gray-700">Resumen de asignaciones</p>
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2.5">
          <CheckCircle2 size={15} className="text-green-500 shrink-0" />
          <span>
            <strong>{asignaciones.length}</strong> colaboradores con servicios asignados
          </span>
        </div>
        {sinColaborador.length > 0 && (
          <div className="flex items-center gap-3 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5">
            <AlertCircle size={15} className="text-amber-500 shrink-0" />
            <span>
              <strong>{sinColaborador.length}</strong> empleados no encontrados en el sistema
            </span>
          </div>
        )}
        {sinPunto.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2.5">
              <AlertCircle size={15} className="text-amber-500 shrink-0" />
              <span>
                <strong>{sinPunto.length}</strong> objetivos sin punto QR correspondiente
              </span>
            </div>
            <div className="border border-amber-100 rounded-lg p-2.5 max-h-28 overflow-y-auto">
              {sinPunto.map((obj) => (
                <p key={obj} className="text-xs text-gray-500">
                  • {obj}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onVolver}>
          <ChevronLeft size={15} className="mr-1" /> Volver
        </Button>
        <Button
          className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
          disabled={asignaciones.length === 0}
          onClick={onConfirmar}
        >
          Confirmar asignaciones
        </Button>
      </div>
    </div>
  )
}

function DoneStep({ resultado, onClose }: { resultado: Resultado; onClose: () => void }) {
  const r = resultado as ResultadoAsociados & ResultadoServicios
  const sinCambios =
    "creados" in r && r.creados === 0 && r.actualizados === 0 && r.desactivados === 0

  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <CheckCircle2 size={48} className="text-green-500" />
      <div className="text-center">
        <p className="font-semibold text-gray-900 text-lg">¡Sincronización completa!</p>
        <div className="text-sm text-gray-500 mt-2 space-y-0.5">
          {sinCambios && <p>Sin cambios — todo estaba al día</p>}
          {"creados" in r && r.creados > 0 && <p>{r.creados} colaboradores creados</p>}
          {r.actualizados > 0 && <p>{r.actualizados} colaboradores actualizados</p>}
          {"desactivados" in r && r.desactivados > 0 && (
            <p>{r.desactivados} colaboradores desactivados</p>
          )}
        </div>
      </div>
      <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8" onClick={onClose}>
        Listo
      </Button>
    </div>
  )
}
