"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle2, AlertCircle, Loader2, ChevronLeft } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

type Step = "upload" | "processing" | "preview" | "confirming" | "done"

interface MatchServicio {
  servicio: string
  empleados: number
  nuevos: number
  punto_id: string | null
  punto_nombre: string | null
}

interface HojaParaConfirmar {
  servicio: string
  punto_id: string | null
  filas: unknown[]
}

interface PreviewData {
  mes: number
  anio: number
  servicios: MatchServicio[]
  total_empleados: number
  total_servicios: number
  _hojas: HojaParaConfirmar[]
}

interface PuntoOpcion {
  id: string
  nombre: string
}

interface Props {
  open: boolean
  mes: number
  anio: number
  puntos: PuntoOpcion[]
  onClose: () => void
  onSuccess: () => void
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export function ImportarExcelModal({ open, mes, anio, puntos, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("upload")
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  // Overrides manuales: servicio → punto_id elegido por el usuario
  const [overrides, setOverrides] = useState<Map<string, string | null>>(new Map())
  const [resultado, setResultado] = useState<{ asignaciones: number; creadosColab: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep("upload")
    setArchivo(null)
    setPreview(null)
    setOverrides(new Map())
    setResultado(null)
  }

  function handleClose() {
    if (step === "done") onSuccess()
    else onClose()
    setTimeout(reset, 300)
  }

  async function procesar() {
    if (!archivo) return
    setStep("processing")

    const fd = new FormData()
    fd.append("file", archivo)
    fd.append("mes", String(mes))
    fd.append("anio", String(anio))

    try {
      const res = await fetch("/api/proyeccion/importar", { method: "POST", body: fd })
      const data = await res.json() as { error?: string } & Partial<PreviewData>
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Error al procesar el archivo")
        setStep("upload")
        return
      }
      setPreview(data as PreviewData)
      setStep("preview")
    } catch {
      toast.error("Error de conexión")
      setStep("upload")
    }
  }

  async function confirmar() {
    if (!preview) return
    setStep("confirming")

    // punto_id viene de preview.servicios, no de _hojas (que no lo incluye)
    const puntoByServicio = new Map(preview.servicios.map((s) => [s.servicio, s.punto_id]))

    const hojas = preview._hojas.map((h) => ({
      ...h,
      punto_id: overrides.has(h.servicio)
        ? (overrides.get(h.servicio) ?? null)
        : (puntoByServicio.get(h.servicio) ?? null),
    }))

    const payload = { mes: preview.mes, anio: preview.anio, hojas }
    console.log("[confirmar] payload hojas:", hojas.length, "| primera hoja filas:", hojas[0]?.filas?.length, "| primera fila:", JSON.stringify(hojas[0]?.filas?.[0]))

    try {
      const res = await fetch("/api/proyeccion/importar/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as { error?: string; issues?: unknown[]; asignaciones?: number; creados_colaboradores?: number }
      if (!res.ok || data.error) {
        console.error("[confirmar] Zod issues:", JSON.stringify(data.issues, null, 2))
        const primerIssue = Array.isArray(data.issues) && data.issues.length > 0
          ? ` (${JSON.stringify(data.issues[0])})`
          : ""
        toast.error((data.error ?? "Error al importar") + primerIssue)
        setStep("preview")
        return
      }
      setResultado({ asignaciones: data.asignaciones ?? 0, creadosColab: data.creados_colaboradores ?? 0 })
      setStep("done")
    } catch {
      toast.error("Error de conexión")
      setStep("preview")
    }
  }

  function setOverride(servicio: string, puntoId: string | null) {
    setOverrides((prev) => {
      const next = new Map(prev)
      next.set(servicio, puntoId)
      return next
    })
  }

  const serviciosConProblema = preview?.servicios.filter((s) => {
    const override = overrides.get(s.servicio)
    const puntoPorDefecto = s.punto_id
    return override === null || (!overrides.has(s.servicio) && !puntoPorDefecto)
  }).length ?? 0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Importar planilla — {MESES[mes - 1]} {anio}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-5 mt-1">
            <p className="text-sm text-gray-500">
              Subí la planilla Excel mensual. Cada hoja representa un servicio.
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
                  <p className="text-xs text-gray-400 mt-1">Cada hoja = un servicio</p>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setArchivo(f) }} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Cancelar</Button>
              <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={!archivo} onClick={procesar}>
                Procesar →
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-14">
            <Loader2 size={36} className="animate-spin text-[#2563EB]" />
            <p className="text-sm text-gray-600">Analizando planilla...</p>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4 mt-1">
            <p className="text-sm text-gray-500">
              {preview.total_servicios} servicios · {preview.total_empleados} empleados únicos
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {preview.servicios.map((s) => {
                const puntoActual = overrides.has(s.servicio)
                  ? overrides.get(s.servicio)
                  : s.punto_id
                const tieneMatch = !!puntoActual

                return (
                  <div
                    key={s.servicio}
                    className={`rounded-lg border px-3 py-2.5 text-sm ${
                      tieneMatch ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {tieneMatch ? (
                          <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                        ) : (
                          <AlertCircle size={14} className="text-amber-500 shrink-0" />
                        )}
                        <span className="font-medium text-gray-800 truncate">{s.servicio}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {s.empleados} emp.{s.nuevos > 0 && ` · ${s.nuevos} nuevos`}
                        </span>
                      </div>
                    </div>
                    {tieneMatch ? (
                      <p className="text-xs text-green-700 mt-1 ml-5">
                        → {puntos.find((p) => p.id === puntoActual)?.nombre ?? s.punto_nombre}
                      </p>
                    ) : (
                      <div className="mt-1.5 ml-5">
                        <Select
                          value={overrides.get(s.servicio) ?? ""}
                          onValueChange={(v) => setOverride(s.servicio, v || null)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Seleccionar punto QR..." />
                          </SelectTrigger>
                          <SelectContent>
                            {puntos.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {serviciosConProblema > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle size={12} />
                {serviciosConProblema} servicio{serviciosConProblema > 1 ? "s" : ""} sin punto QR asignado — se importarán sin cruzar asistencias
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setStep("upload")}>
                <ChevronLeft size={15} className="mr-1" /> Volver
              </Button>
              <Button className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={confirmar}>
                Confirmar importación
              </Button>
            </div>
          </div>
        )}

        {step === "confirming" && (
          <div className="flex flex-col items-center gap-4 py-14">
            <Loader2 size={36} className="animate-spin text-[#2563EB]" />
            <p className="text-sm text-gray-600">Importando planilla...</p>
          </div>
        )}

        {step === "done" && resultado && (
          <div className="flex flex-col items-center gap-4 py-10">
            <CheckCircle2 size={48} className="text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-gray-900 text-lg">¡Planilla importada!</p>
              <div className="text-sm text-gray-500 mt-2 space-y-0.5">
                <p>{resultado.asignaciones} asignaciones cargadas</p>
                {resultado.creadosColab > 0 && (
                  <p>{resultado.creadosColab} colaboradores nuevos creados</p>
                )}
              </div>
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
