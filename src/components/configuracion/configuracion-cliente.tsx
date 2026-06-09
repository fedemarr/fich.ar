"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Settings, Building2, User, Users, Plus, Trash2, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { RolUsuario } from "@/generated/prisma/client"

interface Empresa {
  id: string
  nombre: string
  slug: string
  logo_url: string | null
}

interface UsuarioBasico {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  activo?: boolean
}

interface ConfiguracionClienteProps {
  empresa: Empresa
  usuario: UsuarioBasico
  usuarios: (UsuarioBasico & { activo: boolean })[]
}

const schemaEmpresa = z.object({ nombre: z.string().min(1, "Requerido") })
const schemaCuenta = z.object({
  nombre: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido"),
})
const schemaPassword = z.object({
  password_actual: z.string().min(1, "Requerido"),
  password_nuevo: z.string().min(6, "Mínimo 6 caracteres"),
  password_confirmar: z.string().min(1, "Requerido"),
}).refine((d) => d.password_nuevo === d.password_confirmar, {
  message: "Las contraseñas no coinciden",
  path: ["password_confirmar"],
})
const schemaUsuario = z.object({
  nombre: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  rol: z.enum(["ADMIN", "MANAGER"]),
})

type FormEmpresa = z.infer<typeof schemaEmpresa>
type FormCuenta = z.infer<typeof schemaCuenta>
type FormPassword = z.infer<typeof schemaPassword>
type FormUsuario = z.infer<typeof schemaUsuario>

const ROLES: Record<RolUsuario, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  MANAGER: "Manager",
}

const COLORES_ROL: Record<RolUsuario, string> = {
  SUPER_ADMIN: "text-purple-700 border-purple-200 bg-purple-50",
  ADMIN: "text-blue-700 border-blue-200 bg-blue-50",
  MANAGER: "text-green-700 border-green-200 bg-green-50",
}

function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? "border-[#2563EB] text-[#2563EB]"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  )
}

export function ConfiguracionCliente({ empresa, usuario, usuarios: usuariosIniciales }: ConfiguracionClienteProps) {
  const router = useRouter()
  const [tab, setTab] = useState<"empresa" | "cuenta" | "usuarios">("empresa")
  const [mostrarNuevoUsuario, setMostrarNuevoUsuario] = useState(false)

  // --- Empresa form ---
  const { register: regEmp, handleSubmit: submitEmp, formState: { isSubmitting: loadEmp } } =
    useForm<FormEmpresa>({
      resolver: zodResolver(schemaEmpresa) as Resolver<FormEmpresa>,
      defaultValues: { nombre: empresa.nombre },
    })

  async function guardarEmpresa(data: FormEmpresa) {
    const res = await fetch("/api/empresa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error("Error al guardar"); return }
    toast.success("Datos actualizados")
    router.refresh()
  }

  // --- Cuenta form ---
  const { register: regCuenta, handleSubmit: submitCuenta, formState: { isSubmitting: loadCuenta } } =
    useForm<FormCuenta>({
      resolver: zodResolver(schemaCuenta) as Resolver<FormCuenta>,
      defaultValues: { nombre: usuario.nombre, email: usuario.email },
    })

  async function guardarCuenta(data: FormCuenta) {
    const res = await fetch("/api/usuarios/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) { toast.error("Error al guardar"); return }
    toast.success("Perfil actualizado")
    router.refresh()
  }

  // --- Password form ---
  const { register: regPass, handleSubmit: submitPass, reset: resetPass, formState: { errors: errPass, isSubmitting: loadPass } } =
    useForm<FormPassword>({
      resolver: zodResolver(schemaPassword) as Resolver<FormPassword>,
    })

  async function cambiarPassword(data: FormPassword) {
    const res = await fetch("/api/usuarios/cambiar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      toast.error(err.error ?? "Error al cambiar contraseña")
      return
    }
    toast.success("Contraseña actualizada")
    resetPass()
  }

  // --- Nuevo usuario form ---
  const { register: regUser, handleSubmit: submitUser, reset: resetUser, formState: { errors: errUser, isSubmitting: loadUser } } =
    useForm<FormUsuario>({
      resolver: zodResolver(schemaUsuario) as Resolver<FormUsuario>,
      defaultValues: { rol: "ADMIN" },
    })

  async function crearUsuario(data: FormUsuario) {
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      toast.error(err.error ?? "Error al crear usuario")
      return
    }
    toast.success("Usuario creado")
    resetUser()
    setMostrarNuevoUsuario(false)
    router.refresh()
  }

  async function eliminarUsuario(id: string) {
    if (id === usuario.id) { toast.error("No podés eliminarte a vos mismo"); return }
    if (!confirm("¿Eliminar este usuario?")) return
    await fetch(`/api/usuarios/${id}`, { method: "DELETE" })
    toast.success("Usuario eliminado")
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings size={20} className="text-[#2563EB]" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
          <p className="text-xs text-gray-400">Administrá tu cuenta y empresa</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <TabButton active={tab === "empresa"} onClick={() => setTab("empresa")} icon={Building2} label="Empresa" />
        <TabButton active={tab === "cuenta"}  onClick={() => setTab("cuenta")}  icon={User}      label="Mi cuenta" />
        <TabButton active={tab === "usuarios"} onClick={() => setTab("usuarios")} icon={Users}   label="Usuarios" />
      </div>

      {/* EMPRESA */}
      {tab === "empresa" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Datos de la empresa</h2>
            <p className="text-xs text-gray-400 mt-0.5">Información básica visible en el sistema</p>
          </div>
          <form onSubmit={submitEmp(guardarEmpresa)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre de la empresa</Label>
              <Input {...regEmp("nombre")} className="max-w-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400">Slug (identificador URL)</Label>
              <Input value={empresa.slug} disabled className="max-w-sm bg-gray-50 text-gray-400" />
              <p className="text-xs text-gray-400">No se puede cambiar sin afectar los links</p>
            </div>
            <Button type="submit" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={loadEmp}>
              {loadEmp ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </div>
      )}

      {/* MI CUENTA */}
      {tab === "cuenta" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Perfil</h2>
              <p className="text-xs text-gray-400 mt-0.5">Tu nombre y email de acceso</p>
            </div>
            <form onSubmit={submitCuenta(guardarCuenta)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input {...regCuenta("nombre")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input {...regCuenta("email")} type="email" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={COLORES_ROL[usuario.rol]}>
                  <Shield size={11} className="mr-1" />
                  {ROLES[usuario.rol]}
                </Badge>
              </div>
              <Button type="submit" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={loadCuenta}>
                {loadCuenta ? "Guardando..." : "Guardar perfil"}
              </Button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Cambiar contraseña</h2>
              <p className="text-xs text-gray-400 mt-0.5">Mínimo 6 caracteres</p>
            </div>
            <form onSubmit={submitPass(cambiarPassword)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Contraseña actual</Label>
                <Input type="password" {...regPass("password_actual")} className="max-w-sm" />
                {errPass.password_actual && <p className="text-xs text-red-500">{errPass.password_actual.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <div className="space-y-1.5">
                  <Label>Nueva contraseña</Label>
                  <Input type="password" {...regPass("password_nuevo")} />
                  {errPass.password_nuevo && <p className="text-xs text-red-500">{errPass.password_nuevo.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Confirmar</Label>
                  <Input type="password" {...regPass("password_confirmar")} />
                  {errPass.password_confirmar && <p className="text-xs text-red-500">{errPass.password_confirmar.message}</p>}
                </div>
              </div>
              <Button type="submit" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={loadPass}>
                {loadPass ? "Cambiando..." : "Cambiar contraseña"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* USUARIOS */}
      {tab === "usuarios" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Accesos al sistema</p>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                onClick={() => setMostrarNuevoUsuario((v) => !v)}
              >
                <Plus size={13} />
                Nuevo usuario
              </Button>
            </div>

            {mostrarNuevoUsuario && (
              <form onSubmit={submitUser(crearUsuario)} className="px-5 py-4 bg-gray-50/50 border-b border-gray-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre</Label>
                    <Input className="h-8 text-sm" {...regUser("nombre")} />
                    {errUser.nombre && <p className="text-xs text-red-500">{errUser.nombre.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" className="h-8 text-sm" {...regUser("email")} />
                    {errUser.email && <p className="text-xs text-red-500">{errUser.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Contraseña</Label>
                    <Input type="password" className="h-8 text-sm" {...regUser("password")} />
                    {errUser.password && <p className="text-xs text-red-500">{errUser.password.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rol</Label>
                    <select {...regUser("rol")} className="w-full h-8 text-sm px-2 rounded-md border border-gray-200 bg-white">
                      <option value="ADMIN">Administrador</option>
                      <option value="MANAGER">Manager</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMostrarNuevoUsuario(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white" disabled={loadUser}>
                    {loadUser ? "Creando..." : "Crear usuario"}
                  </Button>
                </div>
              </form>
            )}

            <div className="divide-y divide-gray-50">
              {usuariosIniciales.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-bold text-[#2563EB] shrink-0">
                    {u.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {u.nombre}
                      {u.id === usuario.id && <span className="ml-2 text-xs text-gray-400">(vos)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs ${COLORES_ROL[u.rol]}`}>
                    {ROLES[u.rol]}
                  </Badge>
                  {!u.activo && (
                    <Badge variant="outline" className="text-xs text-gray-400 border-gray-200">Inactivo</Badge>
                  )}
                  {u.id !== usuario.id && (
                    <button
                      onClick={() => void eliminarUsuario(u.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
