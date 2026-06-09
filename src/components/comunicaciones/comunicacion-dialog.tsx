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
import type { Comunicacion } from "@/generated/prisma/client"

const schema = z.object({
  texto: z.string().min(1, "El texto es requerido"),
  fecha_inicio: z.string().min(1, "Requerido"),
  fecha_fin: z.string().min(1, "Requerido"),
  activa: z.boolean().optional().default(true),
})

type FormData = z.infer<typeof schema>

interface ComunicacionDialogProps {
  open: boolean
  comunicacion: Comunicacion | null
  onClose: () => void
  onSuccess: () => void
}

export function ComunicacionDialog({ open, comunicacion, onClose, onSuccess }: ComunicacionDialogProps) {
  const esEdicion = !!comunicacion

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema) as Resolver<FormData>,
      defaultValues: { activa: true },
    })

  const activa = watch("activa")

  useEffect(() => {
    if (comunicacion) {
      reset({
        texto: comunicacion.texto,
        fecha_inicio: new Date(comunicacion.fecha_inicio).toISOString().split("T")[0],
        fecha_fin: new Date(comunicacion.fecha_fin).toISOString().split("T")[0],
        activa: comunicacion.activa,
      })
    } else {
      const hoy = new Date().toISOString().split("T")[0]
      const en30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      reset({ texto: "", fecha_inicio: hoy, fecha_fin: en30, activa: true })
    }
  }, [comunicacion, reset])

  async function onSubmit(data: FormData) {
    const url = esEdicion ? `/api/comunicaciones/${comunicacion!.id}` : "/api/comunicaciones"
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
    toast.success(esEdicion ? "Comunicación actualizada" : "Comunicación creada")
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar comunicación" : "Nueva comunicación"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Mensaje</Label>
            <textarea
              {...register("texto")}
              rows={4}
              placeholder="Escribí el mensaje para los colaboradores..."
              className="w-full text-sm px-3 py-2 rounded-md border border-gray-200 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
            />
            {errors.texto && <p className="text-xs text-red-500">{errors.texto.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha de inicio</Label>
              <Input type="date" className="h-9 text-sm" {...register("fecha_inicio")} />
              {errors.fecha_inicio && <p className="text-xs text-red-500">{errors.fecha_inicio.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de fin</Label>
              <Input type="date" className="h-9 text-sm" {...register("fecha_fin")} />
              {errors.fecha_fin && <p className="text-xs text-red-500">{errors.fecha_fin.message}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={activa}
              onClick={() => setValue("activa", !activa)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                activa ? "bg-[#2563EB] border-[#2563EB]" : "border-gray-300"
              }`}
            >
              {activa && <span className="text-white text-xs leading-none">✓</span>}
            </button>
            <Label className="cursor-pointer" onClick={() => setValue("activa", !activa)}>
              Comunicación activa
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
              {isSubmitting ? "Guardando..." : esEdicion ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
