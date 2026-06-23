"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, Plus, Pencil, Trash2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface Usuario {
  id: string
  nombre: string
  email: string
  rol: "ADMIN" | "MANAGER"
  activo: boolean
  created_at: string
}

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Manager",
}

const ROL_BADGE: Record<string, string> = {
  ADMIN: "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]",
  MANAGER: "bg-purple-50 text-purple-600 border border-purple-200",
}

interface FormState {
  nombre: string
  email: string
  rol: "ADMIN" | "MANAGER"
  password: string
}

const defaultForm: FormState = { nombre: "", email: "", rol: "MANAGER", password: "" }

export function UsuariosCliente() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    try {
      const res = await fetch("/api/usuarios")
      if (res.ok) {
        const data = await res.json() as Usuario[]
        setUsuarios(data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  function abrirCrear() {
    setEditando(null)
    setForm(defaultForm)
    setDialogoAbierto(true)
  }

  function abrirEditar(u: Usuario) {
    setEditando(u)
    setForm({ nombre: u.nombre, email: u.email, rol: u.rol, password: "" })
    setDialogoAbierto(true)
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.email.trim()) {
      toast.error("Nombre y email son obligatorios")
      return
    }
    if (!editando && form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }
    setSubmitting(true)
    try {
      const url = editando ? `/api/usuarios/${editando.id}` : "/api/usuarios"
      const method = editando ? "PUT" : "POST"
      const body = editando
        ? { nombre: form.nombre, email: form.email, rol: form.rol, ...(form.password ? { password: form.password } : {}) }
        : { nombre: form.nombre, email: form.email, rol: form.rol, password: form.password }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? "Error al guardar")
        return
      }

      toast.success(editando ? "Usuario actualizado" : "Usuario creado")
      setDialogoAbierto(false)
      cargar()
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  async function eliminar(id: string) {
    setEliminando(id)
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        toast.error(data.error ?? "Error al eliminar")
        return
      }
      toast.success("Usuario eliminado")
      cargar()
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-[#2563EB]" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
            <p className="text-xs text-gray-400">Accesos al sistema para tu empresa</p>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-1.5"
          onClick={abrirCrear}
        >
          <Plus size={14} />
          Nuevo usuario
        </Button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Usuarios del sistema</h2>
          <span className="text-xs text-gray-400">{usuarios.length} usuarios</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : usuarios.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No hay usuarios creados aún</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-bold text-[#2563EB]">
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{u.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROL_BADGE[u.rol] ?? ""}`}>
                      {ROL_LABEL[u.rol] ?? u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.activo ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                    }`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5 justify-end">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="text-gray-300 hover:text-[#2563EB] transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => eliminar(u.id)}
                        disabled={eliminando === u.id}
                        className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={dialogoAbierto} onOpenChange={(v) => !v && setDialogoAbierto(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre y apellido"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="usuario@empresa.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select
                value={form.rol}
                onValueChange={(v) => setForm((f) => ({ ...f, rol: v as "ADMIN" | "MANAGER" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador — acceso completo</SelectItem>
                  <SelectItem value="MANAGER">Manager — solo lectura y reportes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                <span className="flex items-center gap-1.5">
                  <KeyRound size={13} />
                  {editando ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}
                </span>
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editando ? "Dejar vacío para mantener" : "Mínimo 6 caracteres"}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogoAbierto(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                onClick={guardar}
                disabled={submitting}
              >
                {submitting ? "Guardando..." : editando ? "Guardar cambios" : "Crear usuario"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
