"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin } from "lucide-react"

interface Punto { id: string; nombre: string }
interface Supervisor {
  id: string; nombre: string; email: string; activo: boolean
  puedeGestionarPuntos: boolean; puntos: Punto[]
}

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  activo: z.boolean(),
  puedeGestionarPuntos: z.boolean(),
})

type Form = z.infer<typeof schema>

interface Props {
  puntos: Punto[]
  supervisor?: Supervisor
  onClose: () => void
  onSaved: () => void
}

export function SupervisorModal({ puntos, supervisor, onClose, onSaved }: Props) {
  const [puntosSeleccionados, setPuntosSeleccionados] = useState<string[]>(
    supervisor?.puntos.map((p) => p.id) ?? []
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: supervisor?.nombre ?? "",
      email: supervisor?.email ?? "",
      password: "",
      activo: supervisor?.activo ?? true,
      puedeGestionarPuntos: supervisor?.puedeGestionarPuntos ?? false,
    },
  })

  function togglePunto(id: string) {
    setPuntosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function onSubmit(data: Form) {
    if (puntosSeleccionados.length === 0) {
      setError("Seleccioná al menos un punto QR")
      return
    }
    setLoading(true)
    setError(null)

    const payload = {
      nombre: data.nombre,
      email: data.email,
      ...(data.password ? { password: data.password } : {}),
      activo: data.activo,
      puedeGestionarPuntos: data.puedeGestionarPuntos,
      puntosIds: puntosSeleccionados,
    }

    const url = supervisor ? `/api/supervisores/${supervisor.id}` : "/api/supervisores"
    const method = supervisor ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    setLoading(false)
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? "Error al guardar")
      return
    }
    onSaved()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supervisor ? "Editar supervisor" : "Nuevo supervisor"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input {...register("nombre")} placeholder="Nombre completo" />
            {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input {...register("email")} type="email" placeholder="email@empresa.com" />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>{supervisor ? "Nueva contraseña (opcional)" : "Contraseña"}</Label>
            <Input {...register("password")} type="password" placeholder={supervisor ? "Dejar vacío para no cambiar" : "Mínimo 6 caracteres"} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin size={14} /> Puntos QR asignados
            </Label>
            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
              {puntos.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    puntosSeleccionados.includes(p.id)
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={puntosSeleccionados.includes(p.id)}
                    onChange={() => togglePunto(p.id)}
                    className="hidden"
                  />
                  <span className="text-sm font-medium">{p.nombre}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register("puedeGestionarPuntos")} className="rounded" />
              <span className="text-sm text-gray-700">Puede gestionar puntos QR</span>
            </label>
            {supervisor && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register("activo")} className="rounded" />
                <span className="text-sm text-gray-700">Activo</span>
              </label>
            )}
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Guardando..." : supervisor ? "Guardar cambios" : "Crear supervisor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
