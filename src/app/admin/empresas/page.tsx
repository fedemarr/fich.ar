"use client"

import { useEffect, useState, useCallback } from "react"
import { Building2, Plus, Users, UserCheck, CheckCircle, XCircle, RefreshCw, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface Empresa {
  id: string
  nombre: string
  slug: string
  activa: boolean
  created_at: string
  _count: { colaboradores: number; usuarios: number }
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [abrirDialog, setAbrirDialog] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const [nombre, setNombre] = useState("")
  const [slug, setSlug] = useState("")
  const [emailAdmin, setEmailAdmin] = useState("")
  const [passwordAdmin, setPasswordAdmin] = useState("")

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/empresas")
      const data = await res.json()
      setEmpresas(data.empresas ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Auto-generar slug desde nombre
  useEffect(() => {
    setSlug(
      nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
    )
  }, [nombre])

  async function crear() {
    setError("")
    if (!nombre || nombre.length < 2) { setError("El nombre debe tener al menos 2 caracteres"); return }
    if (!slug || slug.length < 2) { setError("El slug debe tener al menos 2 caracteres"); return }
    if (emailAdmin && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAdmin)) { setError("El email del admin no es válido"); return }
    if (passwordAdmin && passwordAdmin.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return }
    if (emailAdmin && !passwordAdmin) { setError("Si ingresás email de admin, la contraseña es obligatoria"); return }
    setGuardando(true)
    try {
      const res = await fetch("/api/admin/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, slug, emailAdmin: emailAdmin || undefined, passwordAdmin: passwordAdmin || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = Array.isArray(data.issues) && data.issues.length > 0
          ? data.issues.map((i: { message: string }) => i.message).join(" · ")
          : (data.error ?? "Error al crear")
        setError(msg)
        return
      }
      setAbrirDialog(false)
      setNombre(""); setSlug(""); setEmailAdmin(""); setPasswordAdmin("")
      cargar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#E8593C]" />
            Empresas
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">{empresas.length} empresa{empresas.length !== 1 ? "s" : ""} registrada{empresas.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={cargar} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" className="bg-[#E8593C] hover:bg-[#D04828] text-white" onClick={() => setAbrirDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva empresa
          </Button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-16 text-[#6B7280]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
          Cargando…
        </div>
      ) : empresas.length === 0 ? (
        <div className="text-center py-16 text-[#6B7280] bg-white rounded-xl border border-[#E5E7EB]">
          No hay empresas registradas
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {empresas.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-[#E8593C]/30 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">{e.nombre}</h2>
                  <p className="text-sm text-[#6B7280] font-mono">/{e.slug}</p>
                </div>
                <Badge
                  className={e.activa
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-red-100 text-red-700 border-red-200"
                  }
                >
                  {e.activa ? (
                    <><CheckCircle className="w-3 h-3 mr-1" />Activa</>
                  ) : (
                    <><XCircle className="w-3 h-3 mr-1" />Inactiva</>
                  )}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#F9FAFB] rounded-lg p-3">
                  <div className="flex items-center gap-2 text-[#6B7280] mb-1">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-xs uppercase tracking-wide font-medium">Colaboradores</span>
                  </div>
                  <p className="text-2xl font-bold text-[#111827]">{e._count.colaboradores}</p>
                </div>
                <div className="bg-[#F9FAFB] rounded-lg p-3">
                  <div className="flex items-center gap-2 text-[#6B7280] mb-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span className="text-xs uppercase tracking-wide font-medium">Usuarios</span>
                  </div>
                  <p className="text-2xl font-bold text-[#111827]">{e._count.usuarios}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-[#6B7280]">
                <span>Alta: {formatFecha(e.created_at)}</span>
                <a
                  href={`/${e.slug}/resumen`}
                  className="flex items-center gap-1 text-[#E8593C] hover:underline font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver dashboard
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog nueva empresa */}
      <Dialog open={abrirDialog} onOpenChange={setAbrirDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                placeholder="Ej: Olimpia S.A."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug (URL) *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#6B7280]">fich.ar/</span>
                <Input
                  id="slug"
                  placeholder="olimpia"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="border-t border-[#E5E7EB] pt-4 space-y-3">
              <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wide">Admin inicial (opcional)</p>
              <div className="space-y-1.5">
                <Label htmlFor="emailAdmin">Email admin</Label>
                <Input
                  id="emailAdmin"
                  type="email"
                  placeholder="admin@empresa.com"
                  value={emailAdmin}
                  onChange={(e) => setEmailAdmin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passwordAdmin">Contraseña</Label>
                <Input
                  id="passwordAdmin"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={passwordAdmin}
                  onChange={(e) => setPasswordAdmin(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbrirDialog(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              className="bg-[#E8593C] hover:bg-[#D04828] text-white"
              onClick={crear}
              disabled={guardando}
            >
              {guardando ? "Creando…" : "Crear empresa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
