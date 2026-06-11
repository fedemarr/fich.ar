"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Step = "upload" | "importing" | "done"

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

export function ImportarServiciosModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload")
  const [archivo, setArchivo] = useState<File | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload")
    setArchivo(null)
    setResultado(null)
  }

  function handleClose() {
    if (step === "done") onSuccess()
    else onClose()
    setTimeout(reset, 300)
  }

  async function importar() {
    if (!archivo) return
    setStep("importing")

    const fd = new FormData()
    fd.append("file", archivo)

    try {
      const res = await fetch("/api/puntos/importar-servicios", { method: "POST", body: fd })
      const data = await res.json() as { error?: string } & Partial<Resultado>
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error al importar")
        setStep("upload")
        return
      }
      setResultado({ creados: data.creados ?? 0, actualizados: data.actualizados ?? 0, errores: data.errores ?? [] })
      setStep("done")
    } catch {
      toast.error("Error de conexión")
      setStep("upload")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar servicios desde Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-gray-500">
              El archivo debe tener las columnas:{" "}
              <strong>Nombre</strong>, <strong>Latitud</strong>, <strong>Longitud</strong>,{" "}
              <strong>Radio</strong> (opcional, default 200m).
            </p>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                archivo ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-[#2563EB] hover:bg-blue-50"
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setArchivo(f) }}
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
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setArchivo(f) }} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
              <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={!archivo} onClick={importar}>
                Importar →
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
                  {resultado.errores.map((e, i) => (
                    <p key={i} className="text-xs text-amber-600">{e}</p>
                  ))}
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
