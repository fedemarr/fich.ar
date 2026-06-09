"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Colaborador, ColaboradorJornada, Jornada, PuntoFichaje } from "@/generated/prisma/client"

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  apellido: z.string().min(1, "Requerido"),
  celular: z.string().min(10, "Ingresá el celular con código de país (+54...)"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  legajo: z.string().optional(),
  sector: z.string().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO", "DESACTIVADO"]),
  jornada_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

type ColaboradorConJornada = Colaborador & {
  jornadas: (ColaboradorJornada & {
    jornada: Jornada & { punto_fichaje: PuntoFichaje }
  })[]
}

type JornadaConPunto = Jornada & { punto_fichaje: PuntoFichaje }

interface ColaboradorDialogProps {
  open: boolean
  onClose: () => void
  colaborador: ColaboradorConJornada | null
  jornadas: JornadaConPunto[]
  empresaId: string
  onSuccess: () => void
}

export function ColaboradorDialog({
  open,
  onClose,
  colaborador,
  jornadas,
  onSuccess,
}: ColaboradorDialogProps) {
  const esEdicion = !!colaborador

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { estado: "ACTIVO" },
    })

  useEffect(() => {
    if (colaborador) {
      reset({
        nombre: colaborador.nombre,
        apellido: colaborador.apellido,
        celular: colaborador.celular,
        email: colaborador.email ?? "",
        legajo: colaborador.legajo ?? "",
        sector: colaborador.sector ?? "",
        estado: colaborador.estado,
        jornada_id: colaborador.jornadas[0]?.jornada_id ?? "",
      })
    } else {
      reset({ estado: "ACTIVO", nombre: "", apellido: "", celular: "" })
    }
  }, [colaborador, reset])

  async function onSubmit(data: FormData) {
    const url = esEdicion ? `/api/colaboradores/${colaborador.id}` : "/api/colaboradores"
    const method = esEdicion ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      toast.error("Error al guardar el colaborador")
      return
    }

    toast.success(esEdicion ? "Colaborador actualizado" : "Colaborador creado")
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar colaborador" : "Nuevo colaborador"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input {...register("nombre")} />
              {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input {...register("apellido")} />
              {errors.apellido && <p className="text-xs text-red-500">{errors.apellido.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Celular (con código de país)</Label>
            <Input placeholder="+5491112345678" {...register("celular")} />
            {errors.celular && <p className="text-xs text-red-500">{errors.celular.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email (opcional)</Label>
              <Input type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Legajo (opcional)</Label>
              <Input {...register("legajo")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sector (opcional)</Label>
              <Input {...register("sector")} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                defaultValue={colaborador?.estado ?? "ACTIVO"}
                onValueChange={(v) => setValue("estado", v as FormData["estado"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="INACTIVO">Inactivo</SelectItem>
                  <SelectItem value="DESACTIVADO">Desactivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Jornada asignada (opcional)</Label>
            <Select
              defaultValue={colaborador?.jornadas[0]?.jornada_id ?? ""}
              onValueChange={(v) => setValue("jornada_id", v as string)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin jornada asignada" />
              </SelectTrigger>
              <SelectContent>
                {jornadas.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.nombre} — {j.punto_fichaje.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#E8593C] hover:bg-[#D04828] text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear colaborador"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
