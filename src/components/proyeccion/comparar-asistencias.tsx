"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, AlertCircle, XCircle, Minus } from "lucide-react"

interface AsignacionMensual {
  id: string
  colaborador_id: string
  punto_fichaje_id: string | null
  servicio_nombre: string
  colaborador: { id: string; nombre: string; apellido: string }
  [key: string]: unknown
}

interface FichadaReal {
  colaborador_id: string
  punto_fichaje_id: string | null
  dia: number
  tipo: "ENTRADA" | "SALIDA"
  analisis: string | null
}

type EstadoDia = "PRESENTE" | "TARDE" | "AUSENTE" | "FRANCO" | "NO_LABORAL"

interface Props {
  proyeccionId: string
  asignaciones: AsignacionMensual[]
  mes: number
  anio: number
}

const MESES_DIAS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function diasEnMes(mes: number, anio: number): number {
  if (mes === 2 && ((anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0)) return 29
  return MESES_DIAS[mes - 1]
}

function EstadoIcono({ estado }: { estado: EstadoDia }) {
  if (estado === "PRESENTE") return <CheckCircle2 size={12} className="text-green-500" />
  if (estado === "TARDE") return <AlertCircle size={12} className="text-amber-500" />
  if (estado === "AUSENTE") return <XCircle size={12} className="text-red-400" />
  if (estado === "FRANCO") return <span className="text-xs text-gray-300 font-medium">F</span>
  return <Minus size={10} className="text-gray-200" />
}

function bgEstado(estado: EstadoDia): string {
  if (estado === "PRESENTE") return "bg-green-50"
  if (estado === "TARDE") return "bg-amber-50"
  if (estado === "AUSENTE") return "bg-red-50"
  return ""
}

export function CompararAsistencias({ asignaciones, mes, anio }: Props) {
  const [fichadas, setFichadas] = useState<FichadaReal[] | null>(null)
  const [loading, setLoading] = useState(true)

  const dias = diasEnMes(mes, anio)
  const hoy = new Date()
  const diaActual = hoy.getMonth() + 1 === mes && hoy.getFullYear() === anio
    ? hoy.getDate()
    : dias

  useEffect(() => {
    setLoading(true)
    const inicio = new Date(anio, mes - 1, 1).toISOString()
    const fin = new Date(anio, mes, 0, 23, 59, 59).toISOString()
    fetch(`/api/fichadas?desde=${inicio}&hasta=${fin}&tipo=ENTRADA`)
      .then((r) => r.json())
      .then((data: { fichadas?: FichadaReal[] }) => {
        setFichadas(data.fichadas ?? [])
      })
      .catch(() => setFichadas([]))
      .finally(() => setLoading(false))
  }, [mes, anio])

  function estadoDia(asignacion: AsignacionMensual, dia: number): EstadoDia {
    const key = `dia_${String(dia).padStart(2, "0")}`
    const horasEsperadas = asignacion[key] as number | null

    if (horasEsperadas === null || horasEsperadas === undefined) return "NO_LABORAL"
    if (horasEsperadas === 0) return "FRANCO"

    // Solo verificar hasta hoy
    if (dia > diaActual) return "NO_LABORAL"

    const fichada = fichadas?.find(
      (f) =>
        f.colaborador_id === asignacion.colaborador_id &&
        (asignacion.punto_fichaje_id === null || f.punto_fichaje_id === asignacion.punto_fichaje_id) &&
        f.dia === dia
    )

    if (!fichada) return "AUSENTE"
    if (fichada.analisis === "LLEGADA_TARDE") return "TARDE"
    return "PRESENTE"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Cargando asistencias...</span>
      </div>
    )
  }

  const servicios = Array.from(new Set(asignaciones.map((a) => a.servicio_nombre))).sort()

  return (
    <div className="space-y-6">
      {servicios.map((servicio) => {
        const filas = asignaciones.filter((a) => a.servicio_nombre === servicio)

        // Resumen del día actual para este servicio
        const presentesHoy = filas.filter((a) => {
          const e = estadoDia(a, diaActual)
          return e === "PRESENTE" || e === "TARDE"
        }).length
        const totalHoy = filas.filter((a) => {
          const key = `dia_${String(diaActual).padStart(2, "0")}`
          const h = a[key] as number | null
          return h !== null && h !== undefined && h > 0
        }).length

        return (
          <div key={servicio} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
              <span className="font-medium text-gray-700 text-sm">{servicio}</span>
              <span className="text-xs text-gray-500">
                Hoy: {presentesHoy}/{totalHoy} presentes
                {presentesHoy < totalHoy ? (
                  <span className="text-amber-500 ml-1">⚠️</span>
                ) : totalHoy > 0 ? (
                  <span className="text-green-500 ml-1">✅</span>
                ) : null}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-400 whitespace-nowrap">Empleado</th>
                    {Array.from({ length: diaActual }, (_, i) => i + 1).map((d) => (
                      <th
                        key={d}
                        className={`px-1 py-2 text-center w-7 font-medium ${
                          d === diaActual ? "text-[#2563EB] bg-blue-50" : "text-gray-400"
                        }`}
                      >
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filas.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                        {a.colaborador.apellido} {a.colaborador.nombre}
                      </td>
                      {Array.from({ length: diaActual }, (_, i) => i + 1).map((d) => {
                        const estado = estadoDia(a, d)
                        return (
                          <td
                            key={d}
                            className={`px-1 py-2 text-center w-7 ${bgEstado(estado)} ${
                              d === diaActual ? "bg-opacity-50" : ""
                            }`}
                          >
                            <EstadoIcono estado={estado} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
