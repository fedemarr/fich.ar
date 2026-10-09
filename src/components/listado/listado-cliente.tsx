"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, Search, RefreshCw, Download, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  esCobertura: boolean
  edificioReal: string  // punto donde realmente fichó (puede diferir del asignado)
  puntoId: string | null // punto real de la fila: donde fichó, o el asignado si todavía no fichó
  nroTurno: number
  minutos: number | null       // duración de este turno (entrada → salida)
  totalMinutos: number          // suma de todos los turnos cerrados del colaborador en el período
  cantTurnos: number
  horario: string | null        // horario del servicio programado (filas "Sin fichada")
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const

function trabajaEseDia(j: Jornada, dia: string): boolean {
  const campos = j as unknown as Record<string, unknown>
  return Boolean(campos[`${dia}_presencial`]) || Boolean(campos[`${dia}_virtual`])
}

function formatDuracion(min: number | null): string {
  if (min === null) return "—"
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`
}

const TODOS_LOS_PUNTOS = "__todos__"

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
  const [filtroPunto, setFiltroPunto] = useState(TODOS_LOS_PUNTOS)
  const [modalFichada, setModalFichada] = useState(false)

  // Auto-refresh cada 30s solo si estamos viendo hoy en hora ARG
  useEffect(() => {
    if (fechaInicial !== hoyARG()) return
    const id = setInterval(() => router.refresh(), 15_000)
    return () => clearInterval(id)
  }, [fechaInicial, router])

  const filas: FilaListado[] = useMemo(() => {
    // Servicios programados: solo cuando se mira un único día (en un rango no hay un día de semana fijo)
    const esUnDia = !hastaInicial || hastaInicial === fechaInicial
    const diaKey = DIAS_SEMANA[new Date(fechaInicial + "T12:00:00Z").getUTCDay()]

    const result: FilaListado[] = []
    for (const col of colaboradores) {
      const fichadasCol = fichadas
        .filter((f) => f.colaborador_id === col.id)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const edificioAsignado = col.jornadas[0]?.jornada.punto_fichaje.nombre ?? "—"
      const puntoAsignadoId = col.jornadas[0]?.jornada.punto_fichaje.id ?? null

      // Turnos en orden: cada entrada abre un turno y la salida siguiente lo cierra.
      // Así se ven todos aunque se repita el punto en el día (turnos encadenados).
      const turnos: { entrada: FichadaConRelaciones | null; salida: FichadaConRelaciones | null }[] = []
      let abierto: { entrada: FichadaConRelaciones | null; salida: FichadaConRelaciones | null } | null = null
      for (const f of fichadasCol) {
        if (f.tipo === "ENTRADA") {
          abierto = { entrada: f, salida: null }
          turnos.push(abierto)
        } else if (abierto && !abierto.salida) {
          abierto.salida = f
          abierto = null
        } else {
          turnos.push({ entrada: null, salida: f })
        }
      }

      const duraciones = turnos.map(({ entrada, salida }) =>
        entrada && salida
          ? Math.max(0, Math.round((new Date(salida.timestamp).getTime() - new Date(entrada.timestamp).getTime()) / 60000))
          : null
      )
      const totalMinutos = duraciones.reduce<number>((acc, d) => acc + (d ?? 0), 0)

      type FilaBase = Omit<FilaListado, "nroTurno" | "cantTurnos" | "totalMinutos">
      const filasCol: FilaBase[] = turnos.map(({ entrada, salida }, idx) => {
        const ref = entrada ?? salida
        return {
          colaborador: col,
          entrada,
          salida,
          edificio: edificioAsignado,
          esCobertura: !!entrada?.es_cobertura,
          edificioReal: ref?.punto_fichaje?.nombre ?? edificioAsignado,
          puntoId: ref?.punto_fichaje_id ?? null,
          minutos: duraciones[idx],
          horario: null,
        }
      })

      // Servicios que le tocan ese día y en los que todavía no fichó: una fila "Sin fichada" por cada uno
      if (esUnDia) {
        const puntosFichados = new Set(turnos.map((t) => (t.entrada ?? t.salida)?.punto_fichaje_id ?? null))
        const vistos = new Set<string>()
        const pendientes = col.jornadas
          .filter((cj) => {
            const pid = cj.jornada.punto_fichaje_id
            if (vistos.has(pid) || puntosFichados.has(pid)) return false
            if (!trabajaEseDia(cj.jornada, diaKey) || cj.dias_franco.includes(diaKey)) return false
            vistos.add(pid)
            return true
          })
          .sort((a, b) => a.jornada.hora_inicio.localeCompare(b.jornada.hora_inicio))
        for (const cj of pendientes) {
          filasCol.push({
            colaborador: col,
            entrada: null,
            salida: null,
            edificio: cj.jornada.punto_fichaje.nombre,
            esCobertura: false,
            edificioReal: cj.jornada.punto_fichaje.nombre,
            puntoId: cj.jornada.punto_fichaje_id,
            minutos: null,
            horario: `${cj.jornada.hora_inicio}–${cj.jornada.hora_fin}`,
          })
        }
      }

      // Sin fichadas ni servicios ese día: una fila con su punto asignado (como siempre)
      if (filasCol.length === 0) {
        filasCol.push({
          colaborador: col,
          entrada: null,
          salida: null,
          edificio: edificioAsignado,
          esCobertura: false,
          edificioReal: edificioAsignado,
          puntoId: puntoAsignadoId,
          minutos: null,
          horario: null,
        })
      }

      filasCol.forEach((f, idx) => {
        result.push({ ...f, nroTurno: idx + 1, cantTurnos: filasCol.length, totalMinutos })
      })
    }
    return result
  }, [colaboradores, fichadas, fechaInicial, hastaInicial])

  const opcionesPuntos = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const f of filas) {
      if (f.puntoId && f.edificioReal !== "—") mapa.set(f.puntoId, f.edificioReal)
    }
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [filas])

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter((f) => {
      if (filtroPunto !== TODOS_LOS_PUNTOS && f.puntoId !== filtroPunto) return false
      if (q && !`${f.colaborador.nombre} ${f.colaborador.apellido}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [filas, busqueda, filtroPunto])

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
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {opcionesPuntos.length > 1 && (
            <div className="w-full sm:w-auto sm:mr-auto flex items-center gap-2">
              <MapPin size={14} className="text-gray-400 shrink-0" />
              <Select value={filtroPunto} onValueChange={(v) => setFiltroPunto(v ?? TODOS_LOS_PUNTOS)}>
                <SelectTrigger className="h-9 text-sm w-full sm:w-72">
                  <SelectValue>
                    {filtroPunto === TODOS_LOS_PUNTOS
                      ? "Todos los puntos"
                      : opcionesPuntos.find((p) => p.id === filtroPunto)?.nombre ?? "Todos los puntos"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_LOS_PUNTOS}>Todos los puntos</SelectItem>
                  {opcionesPuntos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filtroPunto !== TODOS_LOS_PUNTOS && (
                <span className="text-xs text-gray-400 shrink-0">{filasFiltradas.length} filas</span>
              )}
            </div>
          )}
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
            {filasFiltradas.map(({ colaborador, entrada, salida, esCobertura, edificioReal, nroTurno, minutos, totalMinutos, cantTurnos, horario }) => {
              const analisisEntrada = getAnalisisEntrada(entrada)
              const esTarde = analisisEntrada === "Llegada tarde"
              const esTurnoExtra = nroTurno > 1

              return (
                <div
                  key={`${colaborador.id}-${nroTurno}`}
                  className={esTurnoExtra ? "pl-14 pr-4 py-2.5 flex items-center gap-3 bg-blue-50/40 border-l-2 border-blue-200" : "px-4 py-3 flex items-center gap-3"}
                >
                  {!esTurnoExtra ? (
                    <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-semibold text-[#2563EB] shrink-0">
                      {colaborador.nombre[0]}{colaborador.apellido[0]}
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-blue-500 bg-blue-100 shrink-0">
                      {nroTurno}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {!esTurnoExtra ? (
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {colaborador.apellido} {colaborador.nombre}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-blue-700 truncate">
                        Turno {nroTurno}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-gray-400 truncate">{edificioReal}{horario && ` · ${horario}`}</p>
                      {esCobertura && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 rounded px-1 py-0.5 font-medium shrink-0">🔄 Cob.</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
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
                    {minutos !== null && (
                      <p className="text-[10px] text-gray-500 mt-0.5">{formatDuracion(minutos)}</p>
                    )}
                    {nroTurno === 1 && cantTurnos > 1 && totalMinutos > 0 && (
                      <p className="text-[10px] font-semibold text-[#2563EB] mt-0.5">Total {formatDuracion(totalMinutos)}</p>
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Horas</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Análisis</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Edificio</th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-12">
                  Sin registros para esta fecha
                </td>
              </tr>
            ) : (
              filasFiltradas.map(({ colaborador, entrada, salida, esCobertura, edificioReal, nroTurno, minutos, totalMinutos, cantTurnos, horario }) => {
                const analisisEntrada = getAnalisisEntrada(entrada)
                const analisisSalida = getAnalisisSalida(salida)
                const esTarde = analisisEntrada === "Llegada tarde"
                const esTurnoExtra = nroTurno > 1

                return (
                  <tr
                    key={`${colaborador.id}-${nroTurno}`}
                    className={
                      esTurnoExtra
                        ? "border-b border-blue-100 last:border-0 bg-blue-50/30 hover:bg-blue-50/60 transition-colors"
                        : "border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                    }
                  >
                    <td className="py-3" style={{ paddingLeft: esTurnoExtra ? "2.5rem" : "1rem", paddingRight: "1rem" }}>
                      {!esTurnoExtra ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-semibold text-[#2563EB] shrink-0">
                            {colaborador.nombre[0]}{colaborador.apellido[0]}
                          </div>
                          <span className="font-medium text-gray-800">
                            {colaborador.apellido} {colaborador.nombre}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-blue-600">
                          <span className="text-gray-300 text-sm select-none">└</span>
                          <span className="text-xs font-semibold bg-blue-100 text-blue-600 rounded px-1.5 py-0.5">
                            Turno {nroTurno}
                          </span>
                          <span className="text-xs text-blue-500 font-medium">
                            {colaborador.apellido} {colaborador.nombre}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {esTurnoExtra ? "—" : new Date(fechaInicial + "T12:00:00").toLocaleDateString("es-AR", {
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
                    <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">
                      <div>{formatDuracion(minutos)}</div>
                      {nroTurno === 1 && cantTurnos > 1 && totalMinutos > 0 && (
                        <div className="font-semibold text-[#2563EB] mt-0.5">Total {formatDuracion(totalMinutos)}</div>
                      )}
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
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{edificioReal}</span>
                        {horario && <span className="text-gray-400 whitespace-nowrap">· {horario}</span>}
                        {esCobertura && (
                          <span className="bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap">
                            🔄 Cobertura
                          </span>
                        )}
                      </div>
                    </td>
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
