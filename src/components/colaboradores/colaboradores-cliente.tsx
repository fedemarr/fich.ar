"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Users, Search, Plus, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ColaboradorDialog } from "@/components/colaboradores/colaborador-dialog"
import { EliminarDialog } from "@/components/colaboradores/eliminar-dialog"
import type { Colaborador, ColaboradorJornada, Jornada, PuntoFichaje, EstadoColaborador } from "@/generated/prisma/client"

type ColaboradorConJornada = Colaborador & {
  jornadas: (ColaboradorJornada & {
    jornada: Jornada & { punto_fichaje: PuntoFichaje }
  })[]
}

type JornadaConPunto = Jornada & { punto_fichaje: PuntoFichaje }

interface ColaboradoresClienteProps {
  colaboradores: ColaboradorConJornada[]
  jornadas: JornadaConPunto[]
  empresaId: string
}

const ESTADO_BADGE: Record<EstadoColaborador, { label: string; class: string }> = {
  ACTIVO: { label: "Activo", class: "bg-green-50 text-green-700 border-green-200" },
  INACTIVO: { label: "Inactivo", class: "bg-gray-100 text-gray-500 border-gray-200" },
  DESACTIVADO: { label: "Desactivado", class: "bg-red-50 text-red-600 border-red-200" },
}

export function ColaboradoresCliente({ colaboradores, jornadas, empresaId }: ColaboradoresClienteProps) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState("")
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<ColaboradorConJornada | null>(null)
  const [eliminando, setEliminando] = useState<ColaboradorConJornada | null>(null)

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return colaboradores
    const q = busqueda.toLowerCase()
    return colaboradores.filter((c) =>
      `${c.nombre} ${c.apellido} ${c.celular} ${c.legajo ?? ""}`.toLowerCase().includes(q)
    )
  }, [colaboradores, busqueda])

  function abrirNuevo() {
    setEditando(null)
    setDialogoAbierto(true)
  }

  function abrirEditar(c: ColaboradorConJornada) {
    setEditando(c)
    setDialogoAbierto(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-[#E8593C]" />
        <h1 className="text-xl font-semibold text-gray-900">Colaboradores</h1>
        <span className="text-sm text-gray-400 ml-1">
          {colaboradores.length} en total
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, celular, legajo..."
            className="pl-8 h-9 text-sm"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Button
          className="ml-auto h-9 gap-1.5 bg-[#E8593C] hover:bg-[#D04828] text-white"
          onClick={abrirNuevo}
        >
          <Plus size={15} />
          Nuevo colaborador
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Colaborador</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Celular</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Legajo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Jornada</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-12">
                  {busqueda ? "Sin resultados para esa búsqueda" : "No hay colaboradores cargados"}
                </td>
              </tr>
            ) : (
              filtrados.map((c) => {
                const jornadaActual = c.jornadas[0]?.jornada
                const badge = ESTADO_BADGE[c.estado]
                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#FEF3F0] flex items-center justify-center text-xs font-semibold text-[#E8593C] shrink-0">
                          {c.nombre[0]}{c.apellido[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{c.apellido} {c.nombre}</p>
                          {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.celular}</td>
                    <td className="px-4 py-3 text-gray-500">{c.legajo ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {jornadaActual ? (
                        <div>
                          <p>{jornadaActual.nombre}</p>
                          <p className="text-gray-400">{jornadaActual.punto_fichaje.nombre}</p>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${badge.class}`}>
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-[#E8593C]"
                          onClick={() => abrirEditar(c)}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                          onClick={() => setEliminando(c)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <ColaboradorDialog
        open={dialogoAbierto}
        onClose={() => setDialogoAbierto(false)}
        colaborador={editando}
        jornadas={jornadas}
        empresaId={empresaId}
        onSuccess={() => { router.refresh(); setDialogoAbierto(false) }}
      />

      <EliminarDialog
        open={!!eliminando}
        colaborador={eliminando}
        onClose={() => setEliminando(null)}
        onSuccess={() => { router.refresh(); setEliminando(null) }}
      />
    </div>
  )
}
