"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Plus, Pencil, Trash2, QrCode, Users, Upload, Eraser } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PuntoDialog } from "@/components/puntos/punto-dialog"
import { QrDialog } from "@/components/puntos/qr-dialog"
import { JornadasDialog } from "@/components/puntos/jornadas-dialog"
import { ImportarPuntosDialog } from "@/components/puntos/importar-puntos-dialog"
import { ImportarServiciosModal } from "@/components/puntos/importar-servicios-modal"
import { toast } from "sonner"
import type { PuntoFichaje, Jornada, ColaboradorJornada } from "@/generated/prisma/client"

interface ColabSimple { id: string; nombre: string; apellido: string }

type ColaboradorJornadaConColaborador = ColaboradorJornada & {
  colaborador: ColabSimple
}

type JornadaConColabs = Jornada & {
  colaboradores: ColaboradorJornadaConColaborador[]
}

type PuntoConJornadas = PuntoFichaje & {
  jornadas: JornadaConColabs[]
}

interface PuntosClienteProps {
  puntos: PuntoConJornadas[]
  colaboradores: ColabSimple[]
  empresaId: string
  empresaNombre: string
  empresaLogoUrl: string | null
}

export function PuntosCliente({ puntos, colaboradores, empresaId, empresaNombre, empresaLogoUrl }: PuntosClienteProps) {
  const router = useRouter()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [importarAbierto, setImportarAbierto] = useState(false)
  const [importarServiciosAbierto, setImportarServiciosAbierto] = useState(false)
  const [editando, setEditando] = useState<PuntoConJornadas | null>(null)
  const [verQr, setVerQr] = useState<PuntoConJornadas | null>(null)
  const [verJornadas, setVerJornadas] = useState<PuntoConJornadas | null>(null)
  const [limpiando, setLimpiando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  async function limpiarPuntos() {
    const ok = confirm(
      "¿Eliminar todos los puntos QR excepto \"Ohlimpia Oficina\" y \"Deposito Logistica\"?\n\nEsta acción no se puede deshacer."
    )
    if (!ok) return
    setLimpiando(true)
    try {
      const res = await fetch("/api/puntos/limpiar", { method: "DELETE" })
      const data: { eliminados?: number; error?: string } = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Error al limpiar los puntos")
        return
      }
      toast.success(`${data.eliminados} puntos eliminados`)
      router.refresh()
    } catch {
      toast.error("Error al limpiar los puntos")
    } finally {
      setLimpiando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin size={20} className="text-[#2563EB]" />
        <h1 className="text-xl font-semibold text-gray-900">Puntos QR</h1>
        <span className="text-sm text-gray-400 ml-1">{puntos.length} configurados</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-9 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
            onClick={limpiarPuntos}
            disabled={limpiando}
          >
            <Eraser size={15} />
            {limpiando ? "Limpiando..." : "Limpiar puntos"}
          </Button>
          <Button
            variant="outline"
            className="h-9 gap-1.5 text-gray-600 border-gray-200 hover:bg-gray-50"
            onClick={() => setImportarServiciosAbierto(true)}
          >
            <Upload size={15} />
            Importar servicios
          </Button>
          <Button
            variant="outline"
            className="h-9 gap-1.5 text-[#2563EB] border-[#2563EB] hover:bg-[#EFF6FF]"
            onClick={() => setImportarAbierto(true)}
          >
            <Upload size={15} />
            Importar Excel
          </Button>
          <Button
            className="h-9 gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            onClick={() => { setEditando(null); setDialogoAbierto(true) }}
          >
            <Plus size={15} />
            Nuevo punto
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {puntos.length === 0 ? (
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No hay puntos de fichaje configurados
          </div>
        ) : (
          puntos.map((p) => {
            const totalColabs = p.jornadas.reduce((acc, j) => acc + j.colaboradores.length, 0)
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                      <QrCode size={20} className="text-[#2563EB]" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{p.nombre}</p>
                      <p className="text-xs text-gray-400">
                        {p.latitud.toFixed(4)}, {p.longitud.toFixed(4)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={p.activo ? "text-green-700 border-green-200 bg-green-50" : "text-gray-500 border-gray-200"}>
                    {p.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Radio: <strong className="text-gray-700">{p.radio_metros}m</strong></span>
                  <span>
                    <button
                      className="text-[#2563EB] hover:underline font-medium"
                      onClick={() => setVerJornadas(p)}
                    >
                      {p.jornadas.length} {p.jornadas.length === 1 ? "turno" : "turnos"}
                    </button>
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {totalColabs} colaboradores
                  </span>
                </div>

                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs h-8"
                    onClick={() => setVerQr(p)}
                  >
                    <QrCode size={13} />
                    Ver QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-[#2563EB]"
                    onClick={() => { setEditando(p); setDialogoAbierto(true) }}
                  >
                    <Pencil size={13} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                    disabled={eliminandoId === p.id}
                    onClick={async () => {
                      if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
                      setEliminandoId(p.id)
                      try {
                        const res = await fetch(`/api/puntos/${p.id}`, { method: "DELETE" })
                        if (!res.ok) {
                          const data = await res.json() as { error?: string }
                          toast.error(data.error ?? "Error al eliminar el punto")
                          return
                        }
                        toast.success(`"${p.nombre}" eliminado`)
                        router.refresh()
                      } catch {
                        toast.error("Error de conexión")
                      } finally {
                        setEliminandoId(null)
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <PuntoDialog
        open={dialogoAbierto}
        punto={editando}
        empresaId={empresaId}
        onClose={() => setDialogoAbierto(false)}
        onSuccess={() => { router.refresh(); setDialogoAbierto(false) }}
      />

      <ImportarPuntosDialog
        open={importarAbierto}
        onClose={() => setImportarAbierto(false)}
        onSuccess={() => { router.refresh(); setImportarAbierto(false) }}
      />

      <ImportarServiciosModal
        open={importarServiciosAbierto}
        onClose={() => setImportarServiciosAbierto(false)}
        onSuccess={() => { router.refresh(); setImportarServiciosAbierto(false) }}
      />

      {verQr && (
        <QrDialog
          punto={verQr}
          empresaNombre={empresaNombre}
          empresaLogoUrl={empresaLogoUrl}
          onClose={() => setVerQr(null)}
        />
      )}

      {verJornadas && (
        <JornadasDialog
          punto={verJornadas}
          colaboradores={colaboradores}
          onClose={() => setVerJornadas(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  )
}
