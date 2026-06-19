"use client"

import { useEffect, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Crosshair, ExternalLink } from "lucide-react"
import type { PuntoFichaje } from "@/generated/prisma/client"

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  latitud: z.coerce.number().min(-90).max(90),
  longitud: z.coerce.number().min(-180).max(180),
  radio_metros: z.coerce.number().min(50).max(2000),
})

type FormData = z.infer<typeof schema>

interface PuntoDialogProps {
  open: boolean
  punto: PuntoFichaje | null
  empresaId: string
  onClose: () => void
  onSuccess: () => void
}

export function PuntoDialog({ open, punto, onSuccess, onClose }: PuntoDialogProps) {
  const esEdicion = !!punto
  const [obteniendoGps, setObteniendoGps] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema) as Resolver<FormData>,
      defaultValues: { radio_metros: 200 },
    })

  const latActual = watch("latitud")
  const lonActual = watch("longitud")

  useEffect(() => {
    if (punto) {
      reset({
        nombre: punto.nombre,
        latitud: punto.latitud,
        longitud: punto.longitud,
        radio_metros: punto.radio_metros,
      })
    } else {
      reset({ radio_metros: 200 })
    }
  }, [punto, reset])

  function usarMiUbicacion() {
    if (!navigator.geolocation) { toast.error("GPS no disponible"); return }
    setObteniendoGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("latitud", parseFloat(pos.coords.latitude.toFixed(6)))
        setValue("longitud", parseFloat(pos.coords.longitude.toFixed(6)))
        setObteniendoGps(false)
        toast.success(`GPS: ±${Math.round(pos.coords.accuracy)}m de precisión`)
      },
      () => { toast.error("No se pudo obtener la ubicación"); setObteniendoGps(false) },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
  }

  async function onSubmit(data: FormData) {
    const url = esEdicion ? `/api/puntos/${punto.id}` : "/api/puntos"
    const method = esEdicion ? "PUT" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error("Error al guardar"); return }
    toast.success(esEdicion ? "Punto actualizado" : "Punto creado")
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{esEdicion ? "Editar punto QR" : "Nuevo punto QR"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Nombre del lugar</Label>
            <Input placeholder="Ej: Oficina Central" {...register("nombre")} />
            {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Coordenadas GPS</Label>
              <div className="flex gap-2">
                {latActual && lonActual && (
                  <a
                    href={`https://www.google.com/maps?q=${latActual},${lonActual}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink size={11} />
                    Ver en mapa
                  </a>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-9 gap-2 text-sm border-dashed"
              onClick={usarMiUbicacion}
              disabled={obteniendoGps}
            >
              <Crosshair size={15} className={obteniendoGps ? "animate-spin" : ""} />
              {obteniendoGps ? "Obteniendo GPS..." : "Usar mi ubicación actual"}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-gray-400">Latitud</p>
                <Input placeholder="-34.5724" {...register("latitud")} />
                {errors.latitud && <p className="text-xs text-red-500">{errors.latitud.message}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-400">Longitud</p>
                <Input placeholder="-58.4506" {...register("longitud")} />
                {errors.longitud && <p className="text-xs text-red-500">{errors.longitud.message}</p>}
              </div>
            </div>
            {latActual && lonActual && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <MapPin size={11} />
                {latActual}, {lonActual}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Radio permitido (metros)</Label>
            <Input type="number" {...register("radio_metros")} />
            {errors.radio_metros && <p className="text-xs text-red-500">{errors.radio_metros.message}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : esEdicion ? "Guardar" : "Crear punto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
