"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, Search, RefreshCw, Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FichadaManualDialog } from "@/components/listado/fichada-manual-dialog"
import { SelectorFecha } from "@/components/listado/selector-fecha"
import { exportarListadoExcel } from "@/lib/export"
import { hoyARG, formatHoraARG } from "@/lib/utils"
import type { Colaborador, Fichada, PuntoFichaje, ColaboradorJornada, Jornada } from "@/generated/prisma/client"

type ColaboradorConJornada = Colaborador & {
  jornadas: (ColaboradorJornada & {
    jornada: Jornada & { punto_fichaje: PuntoFichaje }
  })[]
}

type FichadaConRelaciones = Fichada & {
  colaborador: Colaborador
  punto_fichaje: PuntoFichaje | null
}

interface FilaListado {
  colaborador: ColaboradorConJornada
  entrada: FichadaConRelaciones | null
  salida: FichadaConRelaciones | null
  edificio: string
}

interface ListadoClienteProps {
  colaboradores: ColaboradorConJornada[]
  fichadas: FichadaConRelaciones[]
  empresaId: string
  fechaInicial: string
  hastaInicial: string | null
}

function getAnalisisEntrada(entrada: FichadaConRelaciones | null): string | null {
  if (!entrada) return null
  switch (entrada.analisis) {
    case "LLEGADA_EN_TIEMPO": return "Llegada en tiempo"
    case "LLEGADA_TARDE": return "Llegada tarde"
    default: return null
  }
}

function getAnalisisSalida(salida: FichadaConRelaciones | null): string | null {
  if (!salida) return "No se registró salida aún"
  switch (salida.analisis) {
    case "SALIDA_EN_TIEMPO": return "Salida en tiempo"
    case "SALIDA_ANTICIPADA": return "Salida anticipada"
    default: return null
  }
}

function formatHora(fecha: Date | string | null): string {
  if (!fecha) return "—"
  return formatHoraARG(new Date(fecha))
}

export function ListadoCliente({
  colaboradores,
  fichadas,
  empresaId,
  fechaInicial,
  hastaInicial,
}: ListadoClienteProps) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState("")
  const [modalFichada, setModalFichada] = useState(false)

  // Auto-refresh cada 30s solo si estamos viendo hoy en hora ARG
  useEffect(() => {
    if (fechaInicial !== hoyARG()) return
    const id = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(id)
  }, [fechaInicial, router])

  const filas: FilaListado[] = useMemo(() => {
    return colaboradores.map((col) => {
      const fichadasCol = fichadas.filter((f) => f.colaborador_id === col.id)
      const entrada = fichadasCol.find((f) => f.tipo === "ENTRADA") ?? null
      const salida = fichadasCol.find((f) => f.tipo === "SALIDA") ?? null
      const jornadaActual = col.jornadas[0]
      const edificio = jornadaActual?.jornada.punto_fichaje.nombre ?? "—"
      return { colaborador: col, entrada, salida, edificio }
    })
  }, [colaboradores, fichadas])

  const filasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return filas
    const q = busqueda.toLowerCase()
    return filas.filter((f) =>
      `${f.colaborador.nombre} ${f.colaborador.apellido}`.toLowerCase().includes(q)
    )
  }, [filas, busqueda])

  function handleExportar() {
    exportarListadoExcel(filasFiltradas, fechaInicial)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-[#2563EB]" />
        <h1 className="text-xl font-semibold text-gray-900">Listado del día</h1>
        <span className="text-sm text-gray-400 ml-1">
          Presentismo de todos los colaboradores
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar..."
              className="pl-8 h-9 text-sm"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            onClick={() => router.refresh()}
          >
            <RefreshCw size={14} />
          </Button>
          <SelectorFecha fechaInicial={fechaInicial} hastaInicial={hastaInicial} />
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none h-9 gap-1.5 text-[#2563EB] border-[#2563EB] hover:bg-[#EFF6FF] text-xs sm:text-sm"
            onClick={() => setModalFichada(true)}
          >
            Fichada manual
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none h-9 gap-1.5 text-[#2563EB] border-[#2563EB] hover:bg-[#EFF6FF] text-xs sm:text-sm"
            onClick={handleExportar}
          >
            <Download size={14} />
            <span className="hidden xs:inline">Exportar</span>
            <span className="xs:hidden">Excel</span>
          </Button>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="sm:hidden bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filasFiltradas.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">Sin registros para esta fecha</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filasFiltradas.map(({ colaborador, entrada, salida, edificio }) => {
              const analisisEntrada = getAnalisisEntrada(entrada)
              const esTarde = analisisEntrada === "Llegada tarde"
              return (
                <div key={colaborador.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-semibold text-[#2563EB] shrink-0">
                    {colaborador.nombre[0]}{colaborador.apellido[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {colaborador.apellido} {colaborador.nombre}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{edificio}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 justify-end">
                      {entrada ? (
                        <span className={`text-xs font-semibold ${esTarde ? "text-orange-600" : "text-gray-800"}`}>
                          ↑ {formatHora(entrada.timestamp)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">Sin fichada</span>
                      )}
                      {salida && (
                        <span className="text-xs text-gray-500">↓ {formatHora(salida.timestamp)}</span>
                      )}
                    </div>
                    {analisisEntrada && (
                      <p className={`text-[10px] mt-0.5 ${esTarde ? "text-orange-500" : "text-green-600"}`}>
                        {analisisEntrada}
                      </p>
                    )}
                    {!entrada && salida === null && (
                      <p className="text-[10px] text-gray-400 mt-0.5">Pendiente salida</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Colaborador</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ingreso</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Egreso</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Análisis</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Edificio</th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-12">
                  Sin registros para esta fecha
                </td>
              </tr>
            ) : (
              filasFiltradas.map(({ colaborador, entrada, salida, edificio }) => {
                const analisisEntrada = getAnalisisEntrada(entrada)
                const analisisSalida = getAnalisisSalida(salida)
                const esTarde = analisisEntrada === "Llegada tarde"

                return (
                  <tr
                    key={colaborador.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-semibold text-[#2563EB]">
                          {colaborador.nombre[0]}{colaborador.apellido[0]}
                        </div>
                        <span className="font-medium text-gray-800">
                          {colaborador.apellido} {colaborador.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(fechaInicial + "T12:00:00").toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatHora(entrada?.timestamp ?? null)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {salida ? formatHora(salida.timestamp) : "Pendiente"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {analisisSalida && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                            {analisisSalida}
                          </span>
                        )}
                        {analisisEntrada && (
                          <span className={`text-xs ${esTarde ? "text-red-500" : "text-green-600"}`}>
                            {analisisEntrada}
                          </span>
                        )}
                        {!entrada && (
                          <span className="text-xs text-gray-400">Sin fichada</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{edificio}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <FichadaManualDialog
        open={modalFichada}
        onClose={() => setModalFichada(false)}
        colaboradores={colaboradores}
        empresaId={empresaId}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
