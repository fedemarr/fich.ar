"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type { Colaborador } from "@/generated/prisma/client"

const schema = z.object({
  colaborador_id: z.string().min(1, "Seleccioná un colaborador"),
  tipo: z.enum(["ENTRADA", "SALIDA"]),
  timestamp: z.string().min(1, "Ingresá fecha y hora"),
  nota: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface FichadaManualDialogProps {
  open: boolean
  onClose: () => void
  colaboradores: Colaborador[]
  empresaId: string
  onSuccess: () => void
}

export function FichadaManualDialog({
  open,
  onClose,
  colaboradores,
  onSuccess,
}: FichadaManualDialogProps) {
  const [loading, setLoading] = useState(false)

  const now = new Date()
  const defaultTimestamp = `${now.toISOString().split("T")[0]}T${now.toTimeString().slice(0, 5)}`

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "ENTRADA", timestamp: defaultTimestamp },
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await fetch("/api/fichadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colaborador_id: data.colaborador_id,
          tipo: data.tipo,
          timestamp: new Date(data.timestamp).toISOString(),
          nota_manual: data.nota,
          metodo: "MANUAL",
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("Fichada registrada correctamente")
      reset()
      onClose()
      onSuccess()
    } catch (_err) {
      toast.error("Error al registrar la fichada")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fichada manual</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Colaborador</Label>
            <Select onValueChange={(v) => setValue("colaborador_id", v as string)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná un colaborador" />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.apellido} {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.colaborador_id && (
              <p className="text-xs text-red-500">{errors.colaborador_id.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select defaultValue="ENTRADA" onValueChange={(v) => setValue("tipo", v as "ENTRADA" | "SALIDA")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTRADA">Entrada</SelectItem>
                <SelectItem value="SALIDA">Salida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Fecha y hora</Label>
            <Input type="datetime-local" {...register("timestamp")} />
            {errors.timestamp && (
              <p className="text-xs text-red-500">{errors.timestamp.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nota (opcional)</Label>
            <Input placeholder="Motivo de la fichada manual..." {...register("nota")} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Registrar fichada"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
