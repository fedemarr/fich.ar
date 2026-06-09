"use client"

import { useEffect } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ETIQUETAS_NOVEDAD } from "@/types"
import type { Colaborador, Novedad, TipoNovedad } from "@/generated/prisma/client"

const schema = z.object({
  colaborador_id: z.string().min(1, "Requerido"),
  fecha: z.string().min(1, "Requerido"),
  tipo: z.string().min(1, "Requerido"),
  observacion: z.string().optional(),
  aprobada: z.boolean().optional().default(false),
})

type FormData = z.infer<typeof schema>

type NovedadConColaborador = Novedad & { colaborador: Colaborador }

interface NovedadDialogProps {
  open: boolean
  novedad: NovedadConColaborador | null
  colaboradores: Colaborador[]
  colaboradorPreseleccionado: Colaborador | null
  fechaDefault: string
  onClose: () => void
  onSuccess: () => void
}

export function NovedadDialog({
  open,
  novedad,
  colaboradores,
  colaboradorPreseleccionado,
  fechaDefault,
  onClose,
  onSuccess,
}: NovedadDialogProps) {
  const esEdicion = !!novedad

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema) as Resolver<FormData>,
      defaultValues: { aprobada: false },
    })

  const aprobada = watch("aprobada")

  useEffect(() => {
    if (novedad) {
      reset({
        colaborador_id: novedad.colaborador_id,
        fecha: new Date(novedad.fecha).toISOString().split("T")[0],
        tipo: novedad.tipo,
        observacion: novedad.observacion ?? "",
        aprobada: novedad.aprobada,
      })
    } else {
      reset({
        colaborador_id: colaboradorPreseleccionado?.id ?? "",
        fecha: fechaDefault,
        tipo: "AU",
        observacion: "",
        aprobada: false,
      })
    }
  }, [novedad, colaboradorPreseleccionado, fechaDefault, reset])

  async function onSubmit(data: FormData) {
    const url = esEdicion ? `/api/novedades/${novedad!.id}` : "/api/novedades"
    const method = esEdicion ? "PUT" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error((err as { error?: string }).error ?? "Error al guardar")
      return
    }
    toast.success(esEdicion ? "Novedad actualizada" : "Novedad registrada")
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar novedad" : "Nueva novedad"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Colaborador</Label>
            <select
              {...register("colaborador_id")}
              className="w-full h-9 text-sm px-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
            >
              <option value="">Seleccionar...</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apellido}, {c.nombre}
                </option>
              ))}
            </select>
            {errors.colaborador_id && (
              <p className="text-xs text-red-500">{errors.colaborador_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" className="h-9 text-sm" {...register("fecha")} />
              {errors.fecha && <p className="text-xs text-red-500">{errors.fecha.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <select
                {...register("tipo")}
                className="w-full h-9 text-sm px-3 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              >
                {(Object.entries(ETIQUETAS_NOVEDAD) as [TipoNovedad, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observación (opcional)</Label>
            <textarea
              {...register("observacion")}
              rows={2}
              placeholder="Notas adicionales..."
              className="w-full text-sm px-3 py-2 rounded-md border border-gray-200 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={aprobada}
              onClick={() => setValue("aprobada", !aprobada)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                aprobada ? "bg-[#2563EB] border-[#2563EB]" : "border-gray-300"
              }`}
            >
              {aprobada && <span className="text-white text-xs leading-none">✓</span>}
            </button>
            <Label className="cursor-pointer" onClick={() => setValue("aprobada", !aprobada)}>
              Marcar como aprobada
            </Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Guardando..." : esEdicion ? "Guardar" : "Registrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
