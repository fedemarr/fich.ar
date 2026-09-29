"use client"

import { useCallback, useEffect, useState } from "react"
import {
  LayoutGrid, ClipboardCheck, ScanLine, Settings2, Plus, Pencil, Trash2,
  CheckCircle2, Clock, AlertCircle, QrCode, Download, Loader2, X, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import QRCode from "qrcode"

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Sede { id: string; nombre: string }

interface FichaSector {
  id: string; tipo: string
  puntos_revision: string[]
  controles_presenciales: string[]
  umbral_aprobacion: number
  _count?: { sectores: number }
}

interface Sector {
  id: string; nombre: string; qr_sector_token: string
  sede: { id: string; nombre: string }
  ficha: { id: string; tipo: string } | null
  _count: { rutinas: number; verificaciones: number; reclamos: number }
}

interface RutinaDia {
  sector_id: string
  sector_nombre: string
  sede_nombre: string
  estado: string
  colaborador_nombre?: string
  hora_escaneo?: string
}

interface Ronda {
  id: string; fecha: string; estado: string
  sede: { nombre: string }
  supervisor: { nombre: string }
  _count: { verificaciones: number }
}

interface Verificacion {
  id: string
  sector: { nombre: string; ficha: FichaSector | null }
  resultado_final: string | null
  controles_presenciales: Record<string, boolean> | null
}

interface RondaDetalle extends Ronda { verificaciones: Verificacion[] }

// ─── Utils ───────────────────────────────────────────────────────────────────

async function descargarQR(token: string, nombre: string) {
  const url = `https://fich-ar.lat/op/sector/${token}`
  const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 })
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = `QR_${nombre.replace(/\s+/g, "_")}.png`
  a.click()
}

// ─── Tab: Hoy ────────────────────────────────────────────────────────────────

function TabHoy() {
  const [rutinas, setRutinas] = useState<RutinaDia[] | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/operaciones/rutinas/hoy")
    if (res.ok) {
      const d = await res.json() as { rutinas: RutinaDia[] }
      setRutinas(d.rutinas)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  if (loading) return <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
  if (!rutinas || rutinas.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <ScanLine size={40} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">No hay sectores configurados o no hubo actividad hoy.</p>
    </div>
  )

  const listos = rutinas.filter(r => r.estado === "LISTO")
  const pendientes = rutinas.filter(r => r.estado !== "LISTO")

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total sectores", val: rutinas.length, color: "text-gray-700" },
          { label: "Listos", val: listos.length, color: "text-emerald-600" },
          { label: "Pendientes", val: pendientes.length, color: "text-amber-600" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {rutinas.map(r => (
          <div key={r.sector_id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-gray-800 text-sm">{r.sector_nombre}</p>
              <p className="text-xs text-gray-400">{r.sede_nombre}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.estado === "LISTO" ? (
                <>
                  <span className="text-xs text-gray-400">{r.hora_escaneo}</span>
                  <CheckCircle2 size={18} className="text-emerald-500" />
                </>
              ) : (
                <Clock size={18} className="text-amber-400" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Rondas ─────────────────────────────────────────────────────────────

function TabRondas({ sedes }: { sedes: Sede[] }) {
  const [rondas, setRondas] = useState<Ronda[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [sedeId, setSedeId] = useState("")
  const [cantidad, setCantidad] = useState(5)
  const [rondaActiva, setRondaActiva] = useState<RondaDetalle | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/operaciones/rondas")
    if (res.ok) {
      const d = await res.json() as { rondas: Ronda[] }
      setRondas(d.rondas)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  async function crearRonda() {
    if (!sedeId) { toast.error("Elegí una sede"); return }
    setCreando(true)
    try {
      const res = await fetch("/api/operaciones/rondas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sede_id: sedeId, cantidad_sectores: cantidad }),
      })
      const d = await res.json() as { ronda?: RondaDetalle; error?: string }
      if (!res.ok) { toast.error(d.error ?? "Error al crear ronda"); return }
      toast.success(`Ronda creada con ${d.ronda?.verificaciones.length} sectores sorteados`)
      setRondaActiva(d.ronda ?? null)
      void cargar()
    } finally {
      setCreando(false)
    }
  }

  async function abrirRonda(id: string) {
    const res = await fetch(`/api/operaciones/rondas/${id}`)
    if (res.ok) {
      const d = await res.json() as { ronda: RondaDetalle }
      setRondaActiva(d.ronda)
    }
  }

  async function guardarVerificacion(verifId: string, resultado: "APROBADO" | "RECHAZADO", controles: Record<string, boolean>) {
    const res = await fetch(`/api/operaciones/verificaciones/${verifId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultado_final: resultado, controles_presenciales: controles }),
    })
    if (!res.ok) { toast.error("Error al guardar"); return }
    toast.success("Verificación guardada")
    // Refrescar ronda activa
    if (rondaActiva) await abrirRonda(rondaActiva.id)
  }

  return (
    <div className="space-y-5">
      {/* Nueva ronda */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="font-semibold text-gray-800 mb-3">Nueva ronda de muestreo</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-xs mb-1 block">Sede</Label>
            <Select value={sedeId} onValueChange={v => setSedeId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Elegí sede" /></SelectTrigger>
              <SelectContent>
                {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Sectores a sortear</Label>
            <Input type="number" min={1} max={20} value={cantidad} onChange={e => setCantidad(Number(e.target.value))} />
          </div>
        </div>
        <Button onClick={crearRonda} disabled={creando || !sedeId} className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
          {creando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Sortear sectores
        </Button>
      </div>

      {/* Ronda activa */}
      {rondaActiva && (
        <RondaPanel ronda={rondaActiva} onGuardar={guardarVerificacion} onCerrar={() => setRondaActiva(null)} />
      )}

      {/* Historial */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-2">
          {(rondas ?? []).map(r => (
            <button key={r.id} onClick={() => abrirRonda(r.id)}
              className="w-full bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3 hover:border-[#2563EB]/40 transition-colors text-left">
              <div>
                <p className="font-medium text-gray-800 text-sm">{r.sede.nombre}</p>
                <p className="text-xs text-gray-400">{new Date(r.fecha).toLocaleDateString("es-AR")} · {r._count.verificaciones} sectores · {r.supervisor.nombre}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={r.estado === "COMPLETADA" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-amber-700 border-amber-200 bg-amber-50"}>
                  {r.estado === "COMPLETADA" ? "Completada" : "En curso"}
                </Badge>
                <ChevronRight size={14} className="text-gray-400" />
              </div>
            </button>
          ))}
          {rondas?.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Sin rondas todavía</div>
          )}
        </div>
      )}
    </div>
  )
}

function RondaPanel({ ronda, onGuardar, onCerrar }: {
  ronda: RondaDetalle
  onGuardar: (id: string, resultado: "APROBADO" | "RECHAZADO", controles: Record<string, boolean>) => Promise<void>
  onCerrar: () => void
}) {
  const [guardando, setGuardando] = useState<string | null>(null)

  const pendientes = ronda.verificaciones.filter(v => !v.resultado_final)
  const completadas = ronda.verificaciones.filter(v => v.resultado_final)

  return (
    <div className="bg-white rounded-xl border-2 border-[#2563EB]/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">Ronda en curso — {ronda.sede.nombre}</p>
          <p className="text-xs text-gray-400">{completadas.length}/{ronda.verificaciones.length} verificados</p>
        </div>
        <button onClick={onCerrar}><X size={16} className="text-gray-400 hover:text-gray-600" /></button>
      </div>

      {pendientes.map(v => (
        <VerificacionCard key={v.id} v={v}
          guardando={guardando === v.id}
          onGuardar={async (resultado, controles) => {
            setGuardando(v.id)
            await onGuardar(v.id, resultado, controles)
            setGuardando(null)
          }} />
      ))}

      {completadas.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs text-gray-400 font-medium">Completados</p>
          {completadas.map(v => (
            <div key={v.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{v.sector.nombre}</span>
              <Badge variant="outline" className={v.resultado_final === "APROBADO" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-red-700 border-red-200 bg-red-50"}>
                {v.resultado_final}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VerificacionCard({ v, guardando, onGuardar }: {
  v: Verificacion
  guardando: boolean
  onGuardar: (resultado: "APROBADO" | "RECHAZADO", controles: Record<string, boolean>) => Promise<void>
}) {
  const controlesBase: Record<string, boolean> = {}
  for (const c of v.sector.ficha?.controles_presenciales ?? []) controlesBase[c] = false
  const [controles, setControles] = useState<Record<string, boolean>>(controlesBase)

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <p className="font-medium text-gray-800">{v.sector.nombre}</p>

      {v.sector.ficha && (
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1.5">Puntos a revisar</p>
          <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
            {(v.sector.ficha.puntos_revision as string[]).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {v.sector.ficha?.controles_presenciales && (v.sector.ficha.controles_presenciales as string[]).length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1.5">Controles presenciales</p>
          <div className="space-y-1.5">
            {(v.sector.ficha.controles_presenciales as string[]).map(c => (
              <label key={c} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="checkbox" checked={controles[c] ?? false}
                  onChange={e => setControles(prev => ({ ...prev, [c]: e.target.checked }))}
                  className="rounded"
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" disabled={guardando}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => onGuardar("APROBADO", controles)}>
          {guardando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          Aprobado
        </Button>
        <Button size="sm" variant="outline" disabled={guardando}
          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => onGuardar("RECHAZADO", controles)}>
          {guardando ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
          Rechazado
        </Button>
      </div>
    </div>
  )
}

// ─── Tab: Configuración ───────────────────────────────────────────────────────

function TabConfig({ sedes, onRecargarSedes }: { sedes: Sede[]; onRecargarSedes: () => void }) {
  const [subtab, setSubtab] = useState<"sedes" | "sectores" | "fichas">("sedes")
  const [sectores, setSectores] = useState<Sector[] | null>(null)
  const [fichas, setFichas] = useState<FichaSector[] | null>(null)
  const [loadingSect, setLoadingSect] = useState(false)
  const [loadingFichas, setLoadingFichas] = useState(false)

  const [modalSede, setModalSede] = useState(false)
  const [modalSector, setModalSector] = useState<Sector | null | "nuevo">(null)
  const [modalFicha, setModalFicha] = useState<FichaSector | null | "nueva">(null)

  const cargarSectores = useCallback(async () => {
    setLoadingSect(true)
    const res = await fetch("/api/operaciones/sectores")
    if (res.ok) { const d = await res.json() as { sectores: Sector[] }; setSectores(d.sectores) }
    setLoadingSect(false)
  }, [])

  const cargarFichas = useCallback(async () => {
    setLoadingFichas(true)
    const res = await fetch("/api/operaciones/fichas")
    if (res.ok) { const d = await res.json() as { fichas: FichaSector[] }; setFichas(d.fichas) }
    setLoadingFichas(false)
  }, [])

  useEffect(() => {
    if (subtab === "sectores") void cargarSectores()
    if (subtab === "fichas") void cargarFichas()
  }, [subtab, cargarSectores, cargarFichas])

  return (
    <div className="space-y-4">
      {/* Subtabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["sedes", "sectores", "fichas"] as const).map(t => (
          <button key={t} onClick={() => setSubtab(t)}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
              subtab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}>
            {t === "fichas" ? "Fichas de sector" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Sedes */}
      {subtab === "sedes" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={() => setModalSede(true)}>
              <Plus size={13} /> Nueva sede
            </Button>
          </div>
          {sedes.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin sedes configuradas</div>
          ) : (
            sedes.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                <p className="font-medium text-gray-800">{s.nombre}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sectores */}
      {subtab === "sectores" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={() => setModalSector("nuevo")}>
              <Plus size={13} /> Nuevo sector
            </Button>
          </div>
          {loadingSect ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : sectores?.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin sectores configurados</div>
          ) : (
            sectores?.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-800 text-sm">{s.nombre}</p>
                  <p className="text-xs text-gray-400">{s.sede.nombre} {s.ficha ? `· Ficha: ${s.ficha.tipo}` : ""}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button title="Descargar QR" onClick={() => descargarQR(s.qr_sector_token, s.nombre)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#2563EB] hover:bg-[#EFF6FF]">
                    <QrCode size={14} />
                  </button>
                  <button title="Editar" onClick={() => setModalSector(s)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#2563EB] hover:bg-[#EFF6FF]">
                    <Pencil size={14} />
                  </button>
                  <button title="Eliminar" onClick={async () => {
                    if (!confirm(`¿Eliminar sector "${s.nombre}"?`)) return
                    await fetch(`/api/operaciones/sectores/${s.id}`, { method: "DELETE" })
                    void cargarSectores()
                    toast.success("Sector eliminado")
                  }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Fichas */}
      {subtab === "fichas" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" onClick={() => setModalFicha("nueva")}>
              <Plus size={13} /> Nueva ficha
            </Button>
          </div>
          {loadingFichas ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : fichas?.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin fichas configuradas</div>
          ) : (
            fichas?.map(f => (
              <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[#2563EB] border-[#2563EB]/30 bg-[#EFF6FF]">{f.tipo}</Badge>
                    {f._count && <span className="text-xs text-gray-400">{f._count.sectores} sectores</span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setModalFicha(f)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#2563EB] hover:bg-[#EFF6FF]">
                      <Pencil size={13} />
                    </button>
                    <button onClick={async () => {
                      if (!confirm(`¿Eliminar ficha "${f.tipo}"?`)) return
                      await fetch(`/api/operaciones/fichas/${f.id}`, { method: "DELETE" })
                      void cargarFichas()
                      toast.success("Ficha eliminada")
                    }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">
                  Revisa: {f.puntos_revision.slice(0, 3).join(", ")}{f.puntos_revision.length > 3 ? "…" : ""}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modales */}
      <ModalSede open={modalSede} onClose={() => setModalSede(false)} onSuccess={() => { setModalSede(false); onRecargarSedes() }} />

      {modalSector !== null && (
        <ModalSector
          sector={modalSector === "nuevo" ? null : modalSector}
          sedes={sedes} fichas={fichas ?? []}
          open onClose={() => setModalSector(null)}
          onSuccess={() => { setModalSector(null); void cargarSectores() }}
        />
      )}

      {modalFicha !== null && (
        <ModalFicha
          ficha={modalFicha === "nueva" ? null : modalFicha}
          open onClose={() => setModalFicha(null)}
          onSuccess={() => { setModalFicha(null); void cargarFichas() }}
        />
      )}
    </div>
  )
}

// ─── Modal Sede ───────────────────────────────────────────────────────────────

function ModalSede({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [nombre, setNombre] = useState("")
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    const res = await fetch("/api/operaciones/sedes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim() }),
    })
    setGuardando(false)
    if (res.ok) { toast.success("Sede creada"); onSuccess() }
    else { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Error") }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva sede</DialogTitle></DialogHeader>
        <div>
          <Label>Nombre</Label>
          <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Sede Centro" className="mt-1" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !nombre.trim()} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal Sector ─────────────────────────────────────────────────────────────

function ModalSector({ sector, sedes, fichas, open, onClose, onSuccess }: {
  sector: Sector | null; sedes: Sede[]; fichas: FichaSector[]
  open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [nombre, setNombre] = useState(sector?.nombre ?? "")
  const [sedeId, setSedeId] = useState(sector?.sede.id ?? "")
  const [fichaId, setFichaId] = useState(sector?.ficha?.id ?? "")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setNombre(sector?.nombre ?? "")
    setSedeId(sector?.sede.id ?? "")
    setFichaId(sector?.ficha?.id ?? "")
  }, [sector])

  async function guardar() {
    if (!nombre.trim() || !sedeId) return
    setGuardando(true)
    const body = { nombre: nombre.trim(), sede_id: sedeId, ficha_id: fichaId || undefined }
    const res = sector
      ? await fetch(`/api/operaciones/sectores/${sector.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/operaciones/sectores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setGuardando(false)
    if (res.ok) { toast.success(sector ? "Sector actualizado" : "Sector creado"); onSuccess() }
    else { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Error") }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{sector ? "Editar sector" : "Nuevo sector"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre del sector</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Baño 2° piso" className="mt-1" />
          </div>
          <div>
            <Label>Sede</Label>
            <Select value={sedeId} onValueChange={v => setSedeId(v ?? "")}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccioná una sede" /></SelectTrigger>
              <SelectContent>{sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ficha de sector <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Select value={fichaId} onValueChange={v => setFichaId(v ?? "")}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Sin ficha asignada" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin ficha</SelectItem>
                {fichas.map(f => <SelectItem key={f.id} value={f.id}>{f.tipo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !nombre.trim() || !sedeId} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modal Ficha ──────────────────────────────────────────────────────────────

function ModalFicha({ ficha, open, onClose, onSuccess }: {
  ficha: FichaSector | null; open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [tipo, setTipo] = useState(ficha?.tipo ?? "")
  const [puntos, setPuntos] = useState((ficha?.puntos_revision ?? []).join("\n"))
  const [controles, setControles] = useState((ficha?.controles_presenciales ?? []).join("\n"))
  const [umbral, setUmbral] = useState(ficha?.umbral_aprobacion ?? 80)
  const [instruccion, setInstruccion] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setTipo(ficha?.tipo ?? "")
    setPuntos((ficha?.puntos_revision ?? []).join("\n"))
    setControles((ficha?.controles_presenciales ?? []).join("\n"))
    setUmbral(ficha?.umbral_aprobacion ?? 80)
  }, [ficha])

  async function guardar() {
    if (!tipo.trim() || !puntos.trim() || !controles.trim()) {
      toast.error("Completá tipo, puntos y controles presenciales")
      return
    }
    setGuardando(true)
    const body = {
      tipo: tipo.trim(),
      puntos_revision: puntos.split("\n").map(l => l.trim()).filter(Boolean),
      controles_presenciales: controles.split("\n").map(l => l.trim()).filter(Boolean),
      instruccion_foto: instruccion || undefined,
      umbral_aprobacion: umbral,
    }
    const res = ficha
      ? await fetch(`/api/operaciones/fichas/${ficha.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/operaciones/fichas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    setGuardando(false)
    if (res.ok) { toast.success(ficha ? "Ficha actualizada" : "Ficha creada"); onSuccess() }
    else { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Error") }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{ficha ? "Editar ficha" : "Nueva ficha de sector"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo de sector</Label>
            <Input value={tipo} onChange={e => setTipo(e.target.value)} placeholder="Ej: Baño, Cocina, Recepción" className="mt-1" />
          </div>
          <div>
            <Label>Puntos a revisar <span className="text-gray-400 font-normal text-xs">(uno por línea)</span></Label>
            <Textarea value={puntos} onChange={e => setPuntos(e.target.value)}
              placeholder={"Inodoros sin manchas\nEspejos sin marcas\nPiso seco"}
              className="mt-1 text-sm" rows={4} />
          </div>
          <div>
            <Label>Controles presenciales <span className="text-gray-400 font-normal text-xs">(uno por línea — lo que la foto no ve)</span></Label>
            <Textarea value={controles} onChange={e => setControles(e.target.value)}
              placeholder={"Sin olor\nDesinfectado con producto correcto\nRincones revisados\nReposición ok"}
              className="mt-1 text-sm" rows={4} />
          </div>
          <div>
            <Label>Instrucción para la foto <span className="text-gray-400 font-normal text-xs">(opcional)</span></Label>
            <Textarea value={instruccion} onChange={e => setInstruccion(e.target.value)}
              placeholder="Desde la puerta, encuadrar los azulejos y el inodoro sin personas"
              className="mt-1 text-sm" rows={2} />
          </div>
          <div>
            <Label>Umbral de aprobación IA ({umbral}%)</Label>
            <input type="range" min={50} max={100} step={5} value={umbral}
              onChange={e => setUmbral(Number(e.target.value))}
              className="w-full mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "hoy",    label: "Hoy",         icon: LayoutGrid },
  { id: "rondas", label: "Rondas",      icon: ClipboardCheck },
  { id: "config", label: "Configurar",  icon: Settings2 },
] as const

type TabId = typeof TABS[number]["id"]

export function OperacionesV2() {
  const [tab, setTab] = useState<TabId>("hoy")
  const [sedes, setSedes] = useState<Sede[]>([])

  const cargarSedes = useCallback(async () => {
    const res = await fetch("/api/operaciones/sedes")
    if (res.ok) { const d = await res.json() as { sedes: Sede[] }; setSedes(d.sedes) }
  }, [])

  useEffect(() => { void cargarSedes() }, [cargarSedes])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <ScanLine size={20} className="text-[#2563EB]" />
        <h1 className="text-xl font-semibold text-gray-900">Operaciones</h1>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                tab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}>
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "hoy"    && <TabHoy />}
      {tab === "rondas" && <TabRondas sedes={sedes} />}
      {tab === "config" && <TabConfig sedes={sedes} onRecargarSedes={cargarSedes} />}
    </div>
  )
}
