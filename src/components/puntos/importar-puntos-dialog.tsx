"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle2, AlertCircle, Loader2, MapPin } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface RowParsed {
  cliente: string
  codigo: string
  direccion: string
}

interface RowPreview {
  codigo: string
  direccion: string
  latitud: number | null
  longitud: number | null
  radio_metros: number
  geocodificado: "pendiente" | "ok" | "fallback" | "error"
  incluir: boolean
}

interface ResultadoImport {
  creados: number
  actualizados: number
  nombresCreados: string[]
  nombresActualizados: string[]
}

type Paso = "upload" | "geocodificando" | "preview" | "importando" | "done"

interface ImportarPuntosDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// BA centro como fallback cuando Nominatim no encuentra la dirección
const BA_LAT = -34.6037
const BA_LON = -58.3816

async function geocodificar(direccion: string): Promise<{ lat: number; lon: number; fallback: boolean }> {
  try {
    const query = encodeURIComponent(direccion + ", Argentina")
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ar`
    const res = await fetch(url, {
      headers: { "User-Agent": "FicharApp/1.0 fedenez11@gmail.com" },
    })
    if (res.ok) {
      const data: Array<{ lat: string; lon: string }> = await res.json()
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), fallback: false }
      }
    }
  } catch {}
  // Fallback: Buenos Aires centro
  return { lat: BA_LAT, lon: BA_LON, fallback: true }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function ImportarPuntosDialog({ open, onClose, onSuccess }: ImportarPuntosDialogProps) {
  const [paso, setPaso] = useState<Paso>("upload")
  const [filas, setFilas] = useState<RowPreview[]>([])
  const [progresoActual, setProgresoActual] = useState(0)
  const [progresoTotal, setProgresoTotal] = useState(0)
  const [resultado, setResultado] = useState<ResultadoImport>({ creados: 0, actualizados: 0, nombresCreados: [], nombresActualizados: [] })
  const [mostrarLista, setMostrarLista] = useState(false)
  const abortarRef = useRef(false)

  function resetear() {
    setPaso("upload")
    setFilas([])
    setProgresoActual(0)
    setProgresoTotal(0)
    setMostrarLista(false)
    abortarRef.current = false
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch("/api/puntos/importar", { method: "POST", body: formData })
    if (!res.ok) {
      toast.error("Error al leer el archivo")
      return
    }
    const { rows }: { rows: RowParsed[] } = await res.json()

    if (rows.length === 0) {
      toast.error("No se encontraron filas válidas. Verificá que el archivo tenga columnas de Código, Razón Social y Dirección.")
      return
    }

    const preview: RowPreview[] = rows.map((r) => ({
      codigo: r.codigo,
      direccion: r.direccion,
      latitud: null,
      longitud: null,
      radio_metros: 200,
      geocodificado: "pendiente",
      incluir: true,
    }))

    setFilas(preview)
    setProgresoTotal(rows.length)
    setProgresoActual(0)
    abortarRef.current = false
    setPaso("geocodificando")

    for (let i = 0; i < preview.length; i++) {
      if (abortarRef.current) break

      const coords = await geocodificar(preview[i].direccion)

      setFilas((prev) => {
        const updated = [...prev]
        updated[i] = {
          ...updated[i],
          latitud: coords.lat,
          longitud: coords.lon,
          geocodificado: coords.fallback ? "fallback" : "ok",
        }
        return updated
      })
      setProgresoActual(i + 1)

      if (i < preview.length - 1 && !abortarRef.current) {
        await delay(1100)
      }
    }

    setPaso("preview")
  }

  async function confirmarImport() {
    const seleccionadas = filas.filter((f) => f.incluir && f.latitud !== null && f.longitud !== null)
    if (seleccionadas.length === 0) {
      toast.error("No hay filas para importar")
      return
    }

    setPaso("importando")

    const res = await fetch("/api/puntos/importar/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        puntos: seleccionadas.map((f) => ({
          nombre: f.codigo,
          latitud: f.latitud!,
          longitud: f.longitud!,
          radio_metros: f.radio_metros,
        })),
      }),
    })

    if (!res.ok) {
      toast.error("Error al importar")
      setPaso("preview")
      return
    }

    const data: ResultadoImport = await res.json()
    setResultado(data)
    setPaso("done")
  }

  function actualizarFila<K extends keyof RowPreview>(i: number, campo: K, valor: RowPreview[K]) {
    setFilas((prev) => {
      const updated = [...prev]
      updated[i] = { ...updated[i], [campo]: valor }
      return updated
    })
  }

  const filasIncluidas = filas.filter((f) => f.incluir && f.latitud !== null && f.longitud !== null).length
  const filasOk = filas.filter((f) => f.geocodificado === "ok").length
  const filasFallback = filas.filter((f) => f.geocodificado === "fallback").length
  const pctProgreso = progresoTotal > 0 ? Math.round((progresoActual / progresoTotal) * 100) : 0

  const esGrande = paso === "preview"

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          abortarRef.current = true
          resetear()
          onClose()
        }
      }}
    >
      <DialogContent
        className={
          esGrande
            ? "max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            : "max-w-lg"
        }
      >
        <DialogHeader>
          <DialogTitle>Importar puntos QR desde Excel</DialogTitle>
        </DialogHeader>

        {paso === "upload" && (
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-500">
              El archivo debe tener columnas de <strong>código</strong>,{" "}
              <strong>cliente/razón social</strong> y <strong>dirección</strong>.
              Acepta variantes: <em>Código / CODIGOS / Cod</em>,{" "}
              <em>Razón Social / CLIENTES</em>,{" "}
              <em>Dirección / DIRECCION</em>. Las coordenadas se resuelven
              automáticamente via OpenStreetMap (~1 seg por fila). Si no se
              puede resolver una dirección, se usa Buenos Aires como punto de
              referencia.
            </p>
            <label className="block border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-colors">
              <Upload size={28} className="mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700">
                Seleccioná el archivo Excel
              </p>
              <p className="text-xs text-gray-400 mt-1">.xlsx o .xls</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          </div>
        )}

        {paso === "geocodificando" && (
          <div className="space-y-5 mt-4 py-4">
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="text-[#2563EB] animate-spin shrink-0" />
              <p className="text-sm font-medium text-gray-700">
                Geocodificando direcciones... {progresoActual} / {progresoTotal}
              </p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-[#2563EB] h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${pctProgreso}%` }}
              />
            </div>
            {filas[progresoActual] && (
              <p className="text-xs text-gray-400 truncate">
                Procesando: {filas[progresoActual].direccion}
              </p>
            )}
            <p className="text-xs text-gray-400">
              Estimado: ~{Math.ceil((progresoTotal - progresoActual) * 1.1)} segundos restantes
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { abortarRef.current = true }}
            >
              Detener y ver resultados parciales
            </Button>
          </div>
        )}

        {paso === "preview" && (
          <>
            <div className="flex items-center gap-3 py-2 shrink-0">
              <p className="text-sm text-gray-600 flex-1">
                <span className="font-semibold text-green-700">{filasOk} con coords exactas</span>
                {filasFallback > 0 && (
                  <span className="text-amber-600 ml-3">{filasFallback} con coords aproximadas (BA centro)</span>
                )}
              </p>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filas.every((f) => f.incluir)}
                  onChange={(e) =>
                    setFilas((prev) => prev.map((f) => ({ ...f, incluir: e.target.checked })))
                  }
                />
                Todas
              </label>
            </div>

            <div className="overflow-y-auto flex-1 border border-gray-100 rounded-lg min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <th className="p-2 w-8"></th>
                    <th className="p-2 text-left font-medium text-gray-500">Código</th>
                    <th className="p-2 text-left font-medium text-gray-500">Dirección</th>
                    <th className="p-2 text-left font-medium text-gray-500 w-32">Latitud</th>
                    <th className="p-2 text-left font-medium text-gray-500 w-32">Longitud</th>
                    <th className="p-2 text-left font-medium text-gray-500 w-20">Radio (m)</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filas.map((fila, i) => (
                    <tr key={i} className={!fila.incluir ? "opacity-40 bg-gray-50" : ""}>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={fila.incluir}
                          onChange={(e) => actualizarFila(i, "incluir", e.target.checked)}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-7 text-xs min-w-[130px]"
                          value={fila.codigo}
                          onChange={(e) => actualizarFila(i, "codigo", e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-gray-500 max-w-[200px]">
                        <span className="truncate block" title={fila.direccion}>
                          {fila.direccion}
                        </span>
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-7 text-xs w-28"
                          value={fila.latitud ?? ""}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            actualizarFila(i, "latitud", isNaN(v) ? null : v)
                          }}
                          placeholder="-34.0000"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-7 text-xs w-28"
                          value={fila.longitud ?? ""}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            actualizarFila(i, "longitud", isNaN(v) ? null : v)
                          }}
                          placeholder="-58.0000"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          className="h-7 text-xs w-16"
                          value={fila.radio_metros}
                          onChange={(e) =>
                            actualizarFila(i, "radio_metros", parseInt(e.target.value) || 200)
                          }
                        />
                      </td>
                      <td className="p-2 text-center">
                        {fila.geocodificado === "ok" && (
                          <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                        )}
                        {fila.geocodificado === "fallback" && (
                          <span title="Coords aproximadas (BA centro)">
                            <MapPin size={14} className="text-amber-400 mx-auto" />
                          </span>
                        )}
                        {fila.geocodificado === "error" && (
                          <AlertCircle size={14} className="text-red-400 mx-auto" />
                        )}
                        {fila.geocodificado === "pendiente" && (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 pt-2 shrink-0">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { resetear(); onClose() }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                onClick={confirmarImport}
                disabled={filasIncluidas === 0}
              >
                Importar {filasIncluidas} {filasIncluidas === 1 ? "punto" : "puntos"}
              </Button>
            </div>
          </>
        )}

        {paso === "importando" && (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 size={20} className="text-[#2563EB] animate-spin" />
            <p className="text-sm text-gray-600">Importando puntos...</p>
          </div>
        )}

        {paso === "done" && (
          <div className="space-y-4 mt-4">
            <div className="text-center py-4">
              <CheckCircle2 size={44} className="mx-auto text-green-500 mb-3" />
              <p className="font-semibold text-gray-800 text-base">
                ¡Importación completada!
              </p>
              <div className="flex justify-center gap-6 mt-3">
                {resultado.creados > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{resultado.creados}</p>
                    <p className="text-xs text-gray-500">creados</p>
                  </div>
                )}
                {resultado.actualizados > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{resultado.actualizados}</p>
                    <p className="text-xs text-gray-500">actualizados</p>
                  </div>
                )}
              </div>
            </div>

            {(resultado.nombresCreados.length > 0 || resultado.nombresActualizados.length > 0) && (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100"
                  onClick={() => setMostrarLista((v) => !v)}
                >
                  <span>Ver detalle</span>
                  <span className="text-gray-400">{mostrarLista ? "▲" : "▼"}</span>
                </button>
                {mostrarLista && (
                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                    {resultado.nombresCreados.map((n) => (
                      <div key={n} className="flex items-center gap-2 px-4 py-1.5 text-xs">
                        <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                        <span className="text-gray-700">{n}</span>
                        <span className="text-gray-400 ml-auto">creado</span>
                      </div>
                    ))}
                    {resultado.nombresActualizados.map((n) => (
                      <div key={n} className="flex items-center gap-2 px-4 py-1.5 text-xs">
                        <CheckCircle2 size={11} className="text-blue-500 shrink-0" />
                        <span className="text-gray-700">{n}</span>
                        <span className="text-gray-400 ml-auto">actualizado</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              onClick={() => { resetear(); onSuccess() }}
            >
              Listo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
