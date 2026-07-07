"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, X, UserPlus, Search, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PuntoFichaje, Jornada, ColaboradorJornada } from "@/generated/prisma/client"

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const
type Dia = typeof DIAS[number]

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  hora_inicio: z.string().min(1),
  hora_fin: z.string().min(1),
  tolerancia_min: z.coerce.number().min(0).max(60),
  dias_presencial: z.array(z.string()),
  dias_virtual: z.array(z.string()),
})

type FormData = z.infer<typeof schema>

interface ColabSimple { id: string; nombre: string; apellido: string }

type ColaboradorJornadaConColaborador = ColaboradorJornada & {
  colaborador: ColabSimple
}

type JornadaConColabs = Jornada & {
  colaboradores: ColaboradorJornadaConColaborador[]
}

type PuntoConJornadas = PuntoFichaje & { jornadas: JornadaConColabs[] }

interface JornadasDialogProps {
  punto: PuntoConJornadas
  colaboradores: ColabSimple[]
  onClose: () => void
  onSuccess: () => void
}

function DiaToggle({ dia, activo, onClick }: { dia: string; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors border ${
        activo
          ? "bg-[#2563EB] text-white border-[#2563EB]"
          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
      }`}
    >
      {dia.slice(0, 2)}
    </button>
  )
}

function AgregarColaboradorPanel({
  jornadaId,
  colaboradoresDisponibles,
  onAgregado,
}: {
  jornadaId: string
  colaboradoresDisponibles: ColabSimple[]
  onAgregado: () => void
}) {
  const [busqueda, setBusqueda] = useState("")
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(false)

  const filtrados = colaboradoresDisponibles.filter((c) => {
    const q = busqueda.toLowerCase()
    return `${c.apellido} ${c.nombre}`.toLowerCase().includes(q)
  })

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function confirmarAgregar() {
    if (seleccionados.size === 0) return
    setCargando(true)
    const ids = Array.from(seleccionados)
    const resultados = await Promise.all(
      ids.map(async (id) => {
        const r = await fetch(`/api/puntos/jornadas/${jornadaId}/colaboradores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ colaborador_id: id }),
        })
        return { id, status: r.status }
      })
    )
    setCargando(false)
    // 409 = ya estaba asignado, se trata como éxito
    const fallidos = resultados.filter((r) => r.status !== 201 && r.status !== 409)
    const agregados = resultados.filter((r) => r.status === 201).length
    if (fallidos.length > 0) {
      const nombres = fallidos.map((f) => {
        const c = colaboradoresDisponibles.find((c) => c.id === f.id)
        return c ? `${c.apellido}, ${c.nombre}` : f.id
      })
      toast.error(`No se pudo agregar: ${nombres.join(" · ")}`)
    }
    if (agregados > 0) toast.success(`${agregados} colaborador${agregados > 1 ? "es" : ""} agregado${agregados > 1 ? "s" : ""}`)
    onAgregado()
  }

  return (
    <div className="mt-2 border border-dashed border-blue-200 rounded-lg p-3 bg-blue-50/40 space-y-2">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus
          type="text"
          placeholder="Buscar colaborador..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      {filtrados.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-1">
          {busqueda ? "Sin resultados" : "Todos los colaboradores ya están asignados"}
        </p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {filtrados.map((c) => {
            const seleccionado = seleccionados.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggleSeleccion(c.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left ${
                  seleccionado ? "bg-blue-100 hover:bg-blue-200" : "hover:bg-blue-50"
                }`}
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  seleccionado ? "bg-[#2563EB] border-[#2563EB]" : "border-gray-300 bg-white"
                }`}>
                  {seleccionado && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                  {c.nombre[0]}{c.apellido[0]}
                </div>
                <span className="text-sm text-gray-800">{c.apellido}, {c.nombre}</span>
              </button>
            )
          })}
        </div>
      )}
      {seleccionados.size > 0 && (
        <button
          onClick={() => void confirmarAgregar()}
          disabled={cargando}
          className="w-full h-8 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium transition-colors disabled:opacity-60"
        >
          {cargando ? "Agregando..." : `Agregar ${seleccionados.size} colaborador${seleccionados.size > 1 ? "es" : ""}`}
        </button>
      )}
    </div>
  )
}

export function JornadasDialog({ punto, colaboradores, onClose, onSuccess }: JornadasDialogProps) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [diasPresencial, setDiasPresencial] = useState<string[]>([])
  const [diasVirtual, setDiasVirtual] = useState<string[]>([])
  const [agregandoEnJornada, setAgregandoEnJornada] = useState<string | null>(null)
  const [quitando, setQuitando] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema) as Resolver<FormData>,
      defaultValues: { tolerancia_min: 15, dias_presencial: [], dias_virtual: [] },
    })

  function toggleDia(dia: Dia, tipo: "presencial" | "virtual") {
    if (tipo === "presencial") {
      setDiasPresencial((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia])
    } else {
      setDiasVirtual((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia])
    }
  }

  async function onSubmit(data: FormData) {
    const diasData: Record<string, boolean> = {}
    DIAS.forEach((d) => {
      diasData[`${d}_presencial`] = diasPresencial.includes(d)
      diasData[`${d}_virtual`] = diasVirtual.includes(d)
    })

    const res = await fetch("/api/puntos/jornadas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        punto_fichaje_id: punto.id,
        nombre: data.nombre,
        hora_inicio: data.hora_inicio,
        hora_fin: data.hora_fin,
        tolerancia_min: data.tolerancia_min,
        ...diasData,
      }),
    })

    if (!res.ok) { toast.error("Error al crear turno"); return }
    toast.success("Turno creado")
    reset()
    setDiasPresencial([])
    setDiasVirtual([])
    setMostrarForm(false)
    onSuccess()
  }

  async function eliminarJornada(jornadaId: string) {
    if (!confirm("¿Eliminar este turno?")) return
    await fetch(`/api/puntos/jornadas/${jornadaId}`, { method: "DELETE" })
    onSuccess()
  }

  async function quitarColaborador(jornadaId: string, colaboradorId: string, nombre: string) {
    setQuitando(`${jornadaId}-${colaboradorId}`)
    const res = await fetch(`/api/puntos/jornadas/${jornadaId}/colaboradores`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colaborador_id: colaboradorId }),
    })
    setQuitando(null)
    if (!res.ok) { toast.error("Error al quitar colaborador"); return }
    toast.success(`${nombre} quitado del turno`)
    onSuccess()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Turnos — {punto.nombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {punto.jornadas.map((j) => {
            // IDs ya asignados a este turno
            const idsEnJornada = new Set(j.colaboradores.map((cj) => cj.colaborador_id))
            // Colaboradores disponibles para agregar (activos y no en este turno)
            const disponibles = colaboradores.filter((c) => !idsEnJornada.has(c.id))

            const diasLabel = DIAS
              .filter((d) => j[`${d}_presencial` as keyof typeof j])
              .map((d) => d.slice(0, 2))
              .join(", ")

            return (
              <div key={j.id} className="border border-gray-200 rounded-xl p-3.5 space-y-3">
                {/* Cabecera del turno */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{j.nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {j.hora_inicio} — {j.hora_fin}
                      {diasLabel && <span className="ml-2 text-gray-400">· {diasLabel}</span>}
                      <span className="ml-2 text-gray-400">· {j.tolerancia_min}min tolerancia</span>
                    </p>
                  </div>
                  <button
                    onClick={() => eliminarJornada(j.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                    title="Eliminar turno"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Lista de colaboradores */}
                <div className="space-y-1">
                  {j.colaboradores.length === 0 ? (
                    <p className="text-xs text-gray-400 italic px-1">Sin colaboradores asignados</p>
                  ) : (
                    j.colaboradores.map((cj) => (
                      <div
                        key={cj.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 group"
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                          {cj.colaborador.nombre[0]}{cj.colaborador.apellido[0]}
                        </div>
                        <span className="text-sm text-gray-800 flex-1 truncate">
                          {cj.colaborador.apellido}, {cj.colaborador.nombre}
                        </span>
                        <button
                          onClick={() => void quitarColaborador(
                            j.id,
                            cj.colaborador_id,
                            `${cj.colaborador.nombre} ${cj.colaborador.apellido}`
                          )}
                          disabled={quitando === `${j.id}-${cj.colaborador_id}`}
                          className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          title="Quitar del turno"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Agregar colaborador */}
                {agregandoEnJornada === j.id ? (
                  <div>
                    <AgregarColaboradorPanel
                      jornadaId={j.id}
                      colaboradoresDisponibles={disponibles}
                      onAgregado={() => { setAgregandoEnJornada(null); onSuccess() }}
                    />
                    <button
                      onClick={() => setAgregandoEnJornada(null)}
                      className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 w-full text-center"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAgregandoEnJornada(j.id)}
                    className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium transition-colors"
                  >
                    <UserPlus size={13} />
                    Agregar colaborador
                  </button>
                )}
              </div>
            )
          })}

          {punto.jornadas.length === 0 && !mostrarForm && (
            <p className="text-sm text-gray-400 text-center py-4">Sin turnos configurados</p>
          )}

          {/* Formulario nuevo turno */}
          {!mostrarForm ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-[#2563EB] border-dashed border-[#2563EB] hover:bg-[#EFF6FF]"
              onClick={() => setMostrarForm(true)}
            >
              <Plus size={14} />
              Agregar turno
            </Button>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Nuevo turno</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre del turno</Label>
                <Input className="h-8 text-sm" placeholder="Ej: L-V 9 a 17" {...register("nombre")} />
                {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Desde</Label>
                  <Input type="time" className="h-8 text-sm" {...register("hora_inicio")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hasta</Label>
                  <Input type="time" className="h-8 text-sm" {...register("hora_fin")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tolerancia (min)</Label>
                  <Input type="number" className="h-8 text-sm" {...register("tolerancia_min")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Días presenciales</Label>
                <div className="flex gap-1 flex-wrap">
                  {DIAS.map((d) => (
                    <DiaToggle key={d} dia={d} activo={diasPresencial.includes(d)} onClick={() => toggleDia(d, "presencial")} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Días virtuales</Label>
                <div className="flex gap-1 flex-wrap">
                  {DIAS.map((d) => (
                    <DiaToggle key={d} dia={d} activo={diasVirtual.includes(d)} onClick={() => toggleDia(d, "virtual")} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setMostrarForm(false)}>Cancelar</Button>
                <Button type="submit" size="sm" className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={isSubmitting}>
                  {isSubmitting ? "Creando..." : "Crear turno"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
