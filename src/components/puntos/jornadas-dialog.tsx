"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
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

type JornadaConColabs = Jornada & { colaboradores: ColaboradorJornada[] }
type PuntoConJornadas = PuntoFichaje & { jornadas: JornadaConColabs[] }

interface JornadasDialogProps {
  punto: PuntoConJornadas
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

export function JornadasDialog({ punto, onClose, onSuccess }: JornadasDialogProps) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [diasPresencial, setDiasPresencial] = useState<string[]>([])
  const [diasVirtual, setDiasVirtual] = useState<string[]>([])

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

    if (!res.ok) { toast.error("Error al crear jornada"); return }
    toast.success("Jornada creada")
    reset()
    setDiasPresencial([])
    setDiasVirtual([])
    setMostrarForm(false)
    onSuccess()
  }

  async function eliminarJornada(jornadaId: string) {
    if (!confirm("¿Eliminar esta jornada?")) return
    await fetch(`/api/puntos/jornadas/${jornadaId}`, { method: "DELETE" })
    onSuccess()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Turnos — {punto.nombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {punto.jornadas.map((j) => (
            <div key={j.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-800">{j.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {j.hora_inicio} — {j.hora_fin} · tolerancia {j.tolerancia_min}min
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {j.colaboradores.length} colaboradores asignados
                  </p>
                </div>
                <button
                  onClick={() => eliminarJornada(j.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))}

          {punto.jornadas.length === 0 && !mostrarForm && (
            <p className="text-sm text-gray-400 text-center py-4">Sin turnos configurados</p>
          )}

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
            <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-200 rounded-lg p-4 space-y-3">
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
