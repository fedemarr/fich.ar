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
  id: string; nombre: string; email: string; identificacion?: string | null; activo: boolean
  puedeGestionarPuntos: boolean; puntos: Punto[]
}
interface ColaboradorSimple { id: string; nombre: string; apellido: string }

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  identificacion: z.string().optional(),
  activo: z.boolean(),
  puedeGestionarPuntos: z.boolean(),
})

type Form = z.infer<typeof schema>

interface Props {
  puntos: Punto[]
  colaboradores: ColaboradorSimple[]
  supervisor?: Supervisor
  onClose: () => void
  onSaved: () => void
}

export function SupervisorModal({ puntos, colaboradores, supervisor, onClose, onSaved }: Props) {
  const [puntosSeleccionados, setPuntosSeleccionados] = useState<string[]>(
    supervisor?.puntos.map((p) => p.id) ?? []
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busquedaPunto, setBusquedaPunto] = useState("")

  const puntosVisibles = busquedaPunto.trim()
    ? puntos.filter((p) => p.nombre.toLowerCase().includes(busquedaPunto.trim().toLowerCase()))
    : puntos

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: supervisor?.nombre ?? "",
      email: supervisor?.email ?? "",
      identificacion: supervisor?.identificacion ?? "",
      password: "",
      activo: supervisor?.activo ?? true,
      puedeGestionarPuntos: supervisor?.puedeGestionarPuntos ?? false,
    },
  })

  function onSelectColaborador(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    const col = colaboradores.find((c) => c.id === id)
    if (col) setValue("nombre", `${col.nombre} ${col.apellido}`)
  }

  function togglePunto(id: string) {
    setPuntosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function onSubmit(data: Form) {
    if (!supervisor && (data.password ?? "").length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (supervisor && data.password && data.password.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres")
      return
    }
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
      identificacion: data.identificacion || undefined,
      activo: data.activo,
      puedeGestionarPuntos: data.puedeGestionarPuntos,
      puntosIds: puntosSeleccionados,
    }

    const url = supervisor ? `/api/supervisores/${supervisor.id}` : "/api/supervisores"
    const method = supervisor ? "PUT" : "POST"

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: unknown }
        setError(typeof body.error === "string" ? body.error : "No se pudo guardar el supervisor. Intentá de nuevo.")
        return
      }
      onSaved()
    } catch {
      setError("Error de conexión. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supervisor ? "Editar supervisor" : "Nuevo supervisor"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!supervisor ? (
            <div className="space-y-1">
              <Label>Colaborador</Label>
              <select
                onChange={onSelectColaborador}
                defaultValue=""
                className="w-full h-9 px-3 pr-8 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none text-gray-700"
              >
                <option value="" disabled>Seleccioná un colaborador...</option>
                {[...colaboradores]
                  .sort((a, b) => a.apellido.localeCompare(b.apellido))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.apellido}, {c.nombre}
                    </option>
                  ))}
              </select>
              <input type="hidden" {...register("nombre")} />
              {errors.nombre && <p className="text-xs text-red-500">Seleccioná un colaborador</p>}
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input {...register("nombre")} placeholder="Nombre completo" />
              {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
            </div>
          )}

          <div className="space-y-1">
            <Label>DNI <span className="text-[#2563EB] text-xs font-medium">— para supervisar por QR</span></Label>
            <Input placeholder="Sin puntos" inputMode="numeric" {...register("identificacion")} />
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
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <MapPin size={14} /> Puntos QR asignados
                <span className="text-xs font-normal text-gray-400">({puntosSeleccionados.length})</span>
              </Label>
              <button
                type="button"
                onClick={() => setPuntosSeleccionados((prev) => [...new Set([...prev, ...puntosVisibles.map((p) => p.id)])])}
                className="text-xs text-[#2563EB] hover:underline"
              >
                {busquedaPunto.trim() ? "Marcar los encontrados" : "Marcar todos"}
              </button>
            </div>
            {puntos.length > 6 && (
              <Input
                value={busquedaPunto}
                onChange={(e) => setBusquedaPunto(e.target.value)}
                placeholder="Buscar punto..."
                className="h-8 text-sm"
              />
            )}
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
              {puntosVisibles.length === 0 && (
                <p className="text-xs text-gray-400 px-1 py-2">Ningún punto coincide con la búsqueda</p>
              )}
              {puntosVisibles.map((p) => (
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
