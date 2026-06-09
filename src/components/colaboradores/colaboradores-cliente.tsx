"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Users, Pencil, UserCog, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColaboradorDialog } from "@/components/colaboradores/colaborador-dialog"
import { EliminarDialog } from "@/components/colaboradores/eliminar-dialog"
import { toast } from "sonner"
import type { Colaborador, ColaboradorJornada, Jornada, PuntoFichaje } from "@/generated/prisma/client"

type ColaboradorConJornada = Colaborador & {
  jornadas: (ColaboradorJornada & {
    jornada: Jornada & { punto_fichaje: PuntoFichaje }
  })[]
}
type JornadaConPunto = Jornada & { punto_fichaje: PuntoFichaje }

interface Props {
  colaboradores: ColaboradorConJornada[]
  jornadas: JornadaConPunto[]
  empresaId: string
}

function AvatarColaborador({ nombre, apellido }: { nombre: string; apellido: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-[#EFF6FF] border border-[#F5C4BA] flex items-center justify-center shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#2563EB]">
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="19" cy="5" r="3" fill="currentColor" opacity="0.25" />
        <path d="M17.5 5h3M19 3.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

function exportarCSV(colaboradores: ColaboradorConJornada[]) {
  const headers = ["Apellido", "Nombre", "Celular", "Identificación", "Legajo", "Sector", "Estado"]
  const rows = colaboradores.map((c) => [
    c.apellido, c.nombre, c.celular,
    c.identificacion ?? "", c.legajo ?? "", c.sector ?? "", c.estado,
  ])
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = "colaboradores.csv"; a.click()
  URL.revokeObjectURL(url)
  toast.success("Nómina exportada")
}

function TablaColaboradores({
  colaboradores,
  onEditar,
  onEliminar,
}: {
  colaboradores: ColaboradorConJornada[]
  onEditar: (c: ColaboradorConJornada) => void
  onEliminar: (c: ColaboradorConJornada) => void
}) {
  if (colaboradores.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-gray-400">
        Sin colaboradores en esta categoría
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Colaborador</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Celular</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Identificación</th>
          <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Empresa</th>
          <th className="px-4 py-3 w-20" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {colaboradores.map((c) => {
          const jornadaActual = c.jornadas[0]?.jornada
          const puntoNombre = jornadaActual?.punto_fichaje.nombre ?? null
          const empresa = puntoNombre ?? c.sector ?? null

          return (
            <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <AvatarColaborador nombre={c.nombre} apellido={c.apellido} />
                  <span className="font-medium text-gray-800">
                    {c.apellido} {c.nombre}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 text-gray-600">{c.celular}</td>
              <td className="px-4 py-3.5 text-gray-400 text-sm">
                {c.identificacion ?? "No especificado"}
              </td>
              <td className="px-4 py-3.5 text-gray-400 text-sm">
                {empresa ?? "No especificado"}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2.5 justify-end">
                  <button
                    onClick={() => onEditar(c)}
                    className="text-gray-300 hover:text-[#2563EB] transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => onEliminar(c)}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                    title="Gestionar"
                  >
                    <UserCog size={16} />
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function ColaboradoresCliente({ colaboradores, jornadas, empresaId }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"nomina" | "alta" | "desactivados">("nomina")
  const [busqueda, setBusqueda] = useState("")
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [editando, setEditando] = useState<ColaboradorConJornada | null>(null)
  const [eliminando, setEliminando] = useState<ColaboradorConJornada | null>(null)

  const activos = useMemo(() => colaboradores.filter((c) => c.estado === "ACTIVO"), [colaboradores])
  const desactivados = useMemo(
    () => colaboradores.filter((c) => c.estado !== "ACTIVO"),
    [colaboradores]
  )

  const filtrar = (lista: ColaboradorConJornada[]) => {
    if (!busqueda.trim()) return lista
    const q = busqueda.toLowerCase()
    return lista.filter((c) =>
      `${c.nombre} ${c.apellido} ${c.celular} ${c.identificacion ?? ""} ${c.legajo ?? ""}`.toLowerCase().includes(q)
    )
  }

  function abrirEditar(c: ColaboradorConJornada) {
    setEditando(c)
    setDialogoAbierto(true)
  }

  function handleAltaClick() {
    setEditando(null)
    setDialogoAbierto(true)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users size={20} className="text-[#2563EB]" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Colaboradores</h1>
          <p className="text-xs text-gray-400">Gestión de todos los colaboradores</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab("nomina")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "nomina"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Nómina
        </button>
        <button
          onClick={() => { setTab("alta"); handleAltaClick() }}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "alta"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Alta
        </button>
        <button
          onClick={() => setTab("desactivados")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "desactivados"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          Desactivados
        </button>
      </div>

      {/* Contenido */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Sub-header de la tabla */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <h2 className="text-sm font-semibold text-gray-700">
              {tab === "desactivados" ? "Colaboradores Desactivados" : "Nómina Colaboradores"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-[#2563EB] border-[#2563EB] hover:bg-[#EFF6FF]"
              onClick={() => exportarCSV(tab === "desactivados" ? desactivados : activos)}
            >
              <Download size={13} />
              Exportar datos
            </Button>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-8 pl-7 pr-3 text-sm rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 w-44"
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        {tab === "desactivados" ? (
          <TablaColaboradores
            colaboradores={filtrar(desactivados)}
            onEditar={abrirEditar}
            onEliminar={(c) => setEliminando(c)}
          />
        ) : (
          <TablaColaboradores
            colaboradores={filtrar(activos)}
            onEditar={abrirEditar}
            onEliminar={(c) => setEliminando(c)}
          />
        )}
      </div>

      {/* Dialogs */}
      <ColaboradorDialog
        open={dialogoAbierto}
        onClose={() => { setDialogoAbierto(false); setTab("nomina") }}
        colaborador={editando}
        jornadas={jornadas}
        empresaId={empresaId}
        onSuccess={() => { router.refresh(); setDialogoAbierto(false); setTab("nomina") }}
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
