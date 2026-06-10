"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface FilaPreview {
  apellido: string
  nombre: string
  celular: string
  celularRaw: string
  legajo: string
  sector: string
  identificacion: string
  email: string
}

type Step = "upload" | "preview" | "importing" | "done"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ImportarColaboradoresDialog({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload")
  const [filas, setFilas] = useState<FilaPreview[]>([])
  const [resultado, setResultado] = useState<{ creados: number; actualizados: number } | null>(null)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload")
    setFilas([])
    setResultado(null)
    setError("")
  }

  async function handleFile(file: File) {
    setError("")
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/colaboradores/importar", { method: "POST", body: fd })
    const data = await res.json() as { rows?: FilaPreview[]; error?: string }
    if (!res.ok || data.error) { setError(data.error ?? "Error al leer el archivo"); return }
    if (!data.rows?.length) { setError("No se encontraron colaboradores válidos en el archivo"); return }
    setFilas(data.rows)
    setStep("preview")
  }

  async function confirmar() {
    setStep("importing")
    const res = await fetch("/api/colaboradores/importar/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: filas }),
    })
    const data = await res.json() as { ok?: boolean; creados?: number; actualizados?: number; error?: string }
    if (!res.ok || data.error) { setError(data.error ?? "Error al importar"); setStep("preview"); return }
    setResultado({ creados: data.creados ?? 0, actualizados: data.actualizados ?? 0 })
    setStep("done")
  }

  function handleClose() {
    if (step === "done") onSuccess()
    else onClose()
    setTimeout(reset, 300)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar colaboradores desde Excel</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            >
              <Upload size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Arrastrá o clickeá para subir</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx o .xls</p>
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle size={15} /> {error}
              </div>
            )}
            <p className="text-xs text-gray-400 text-center">
              Columnas reconocidas: <strong>Nombre, Apellido, Celular, Legajo, Sector, DNI, Email</strong>
              <br />Celulares sin código de país serán normalizados a formato argentino (+549...)
            </p>
          </div>
        )}

        {step === "preview" && (
          <>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-gray-600">{filas.length} colaboradores listos para importar</p>
              <p className="text-xs text-gray-400">Los existentes (mismo celular) serán actualizados</p>
            </div>
            <div className="overflow-auto flex-1 border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {["Apellido", "Nombre", "Celular", "Legajo", "Sector", "DNI"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{f.apellido}</td>
                      <td className="px-3 py-2">{f.nombre}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{f.celular}</td>
                      <td className="px-3 py-2 text-gray-400">{f.legajo || "—"}</td>
                      <td className="px-3 py-2 text-gray-400">{f.sector || "—"}</td>
                      <td className="px-3 py-2 text-gray-400">{f.identificacion || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
                <AlertCircle size={15} /> {error}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { reset(); inputRef.current?.click() }}>
                Cambiar archivo
              </Button>
              <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={confirmar}>
                Importar {filas.length} colaboradores
              </Button>
            </div>
          </>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 size={36} className="animate-spin text-[#2563EB]" />
            <p className="text-sm text-gray-600">Importando colaboradores...</p>
          </div>
        )}

        {step === "done" && resultado && (
          <div className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2 size={48} className="text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-gray-900 text-lg">¡Importación completa!</p>
              <p className="text-sm text-gray-500 mt-1">
                {resultado.creados} creados · {resultado.actualizados} actualizados
              </p>
            </div>
            <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8" onClick={handleClose}>
              Listo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
