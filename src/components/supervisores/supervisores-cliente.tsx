"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, MapPin, ShieldCheck } from "lucide-react"
import { SupervisorModal } from "./supervisor-modal"

interface Punto { id: string; nombre: string }
interface Supervisor {
  id: string
  nombre: string
  email: string
  activo: boolean
  puedeGestionarPuntos: boolean
  puntos: Punto[]
}

interface Props { puntos: Punto[] }

export function SupervisoresCliente({ puntos }: Props) {
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; supervisor?: Supervisor }>({ open: false })

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/supervisores")
    if (res.ok) setSupervisores(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function eliminar(s: Supervisor) {
    if (!confirm(`¿Desactivar a ${s.nombre}?`)) return
    await fetch(`/api/supervisores/${s.id}`, { method: "DELETE" })
    cargar()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supervisores</h1>
          <p className="text-sm text-gray-500 mt-1">Gestioná los supervisores y sus puntos asignados</p>
        </div>
        <Button onClick={() => setModal({ open: true })} className="gap-2">
          <Plus size={16} /> Nuevo supervisor
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : supervisores.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay supervisores creados todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {supervisores.map((s) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-blue-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{s.nombre}</span>
                  {s.activo ? (
                    <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Activo</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Inactivo</Badge>
                  )}
                  {s.puedeGestionarPuntos && (
                    <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs">Gestiona puntos</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500">{s.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {s.puntos.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                      <MapPin size={10} /> {p.nombre}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, supervisor: s })} className="gap-1.5 text-gray-600">
                  <Pencil size={14} /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => eliminar(s)} className="gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <SupervisorModal
          puntos={puntos}
          supervisor={modal.supervisor}
          onClose={() => setModal({ open: false })}
          onSaved={() => { cargar(); setModal({ open: false }) }}
        />
      )}
    </div>
  )
}
