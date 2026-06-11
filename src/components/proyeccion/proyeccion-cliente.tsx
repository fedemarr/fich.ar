"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, Upload, BarChart2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImportarExcelModal } from "./importar-excel-modal"
import { TablaProyeccion } from "./tabla-proyeccion"
import { CompararAsistencias } from "./comparar-asistencias"

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

interface Colaborador {
  id: string
  nombre: string
  apellido: string
  legajo: string | null
}

interface PuntoFichaje {
  id: string
  nombre: string
}

interface AsignacionMensual {
  id: string
  colaborador_id: string
  punto_fichaje_id: string | null
  servicio_nombre: string
  nro_socio: string | null
  categoria: string | null
  valor_hora: number | null
  hora_inicio: string | null
  hora_fin: string | null
  total_horas: number | null
  colaborador: Colaborador
  punto_fichaje: PuntoFichaje | null
  dia_01: number | null; dia_02: number | null; dia_03: number | null
  dia_04: number | null; dia_05: number | null; dia_06: number | null
  dia_07: number | null; dia_08: number | null; dia_09: number | null
  dia_10: number | null; dia_11: number | null; dia_12: number | null
  dia_13: number | null; dia_14: number | null; dia_15: number | null
  dia_16: number | null; dia_17: number | null; dia_18: number | null
  dia_19: number | null; dia_20: number | null; dia_21: number | null
  dia_22: number | null; dia_23: number | null; dia_24: number | null
  dia_25: number | null; dia_26: number | null; dia_27: number | null
  dia_28: number | null; dia_29: number | null; dia_30: number | null
  dia_31: number | null
}

interface ProyeccionMensual {
  id: string
  mes: number
  anio: number
  created_at: Date | string
  asignaciones: AsignacionMensual[]
}

interface Props {
  slug: string
  mes: number
  anio: number
  proyeccion: ProyeccionMensual | null
  puntos: { id: string; nombre: string }[]
}

export function ProyeccionCliente({ slug, mes, anio, proyeccion, puntos }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  function navegar(nuevoMes: number, nuevoAnio: number) {
    startTransition(() => {
      router.push(`${pathname}?mes=${nuevoMes}&anio=${nuevoAnio}`)
    })
  }

  function mesAnterior() {
    if (mes === 1) navegar(12, anio - 1)
    else navegar(mes - 1, anio)
  }

  function mesSiguiente() {
    if (mes === 12) navegar(1, anio + 1)
    else navegar(mes + 1, anio)
  }

  // Agrupar asignaciones por servicio para resumen
  const porServicio = new Map<string, { asignaciones: AsignacionMensual[]; punto: PuntoFichaje | null }>()
  for (const a of proyeccion?.asignaciones ?? []) {
    const key = a.servicio_nombre
    if (!porServicio.has(key)) {
      porServicio.set(key, { asignaciones: [], punto: a.punto_fichaje })
    }
    porServicio.get(key)!.asignaciones.push(a)
  }

  const totalHoras = proyeccion?.asignaciones.reduce((s, a) => s + (a.total_horas ?? 0), 0) ?? 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={mesAnterior}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-base font-semibold text-gray-800 min-w-[140px] text-center">
              {MESES[mes - 1]} {anio}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={mesSiguiente}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        <Button
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
          onClick={() => setModalAbierto(true)}
        >
          <Upload size={15} />
          Importar planilla Excel
        </Button>
      </div>

      {/* Sin proyección */}
      {!proyeccion && (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-gray-200 rounded-xl text-center">
          <BarChart2 size={40} className="text-gray-300 mb-4" />
          <p className="text-gray-600 font-medium">No hay proyección para {MESES[mes - 1]} {anio}</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">Subí la planilla Excel para cargar los datos del mes</p>
          <Button
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
            onClick={() => setModalAbierto(true)}
          >
            <Upload size={15} />
            Subir planilla Excel
          </Button>
        </div>
      )}

      {/* Con proyección */}
      {proyeccion && (
        <>
          {/* Meta */}
          <div className="flex items-center gap-6 text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
            <span>
              Cargada el{" "}
              <strong className="text-gray-700">
                {new Date(proyeccion.created_at).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                })}
              </strong>
            </span>
            <span>
              <strong className="text-gray-700">{proyeccion.asignaciones.length}</strong> empleados
            </span>
            <span>
              <strong className="text-gray-700">{porServicio.size}</strong> servicios
            </span>
            <span>
              <strong className="text-gray-700">{Math.round(totalHoras).toLocaleString("es-AR")}</strong> hs proyectadas
            </span>
          </div>

          <Tabs defaultValue="resumen">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="detalle">Detalle completo</TabsTrigger>
              <TabsTrigger value="comparar">Comparar con asistencias</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="mt-4">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Servicio</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Empleados</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Hs proyectadas</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Punto QR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Array.from(porServicio.entries()).map(([servicio, { asignaciones, punto }]) => {
                      const hs = asignaciones.reduce((s, a) => s + (a.total_horas ?? 0), 0)
                      return (
                        <tr key={servicio} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{servicio}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{asignaciones.length}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{Math.round(hs)} hs</td>
                          <td className="px-4 py-3">
                            {punto ? (
                              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                {punto.nombre}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Sin punto QR</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="detalle" className="mt-4">
              <TablaProyeccion asignaciones={proyeccion.asignaciones} mes={mes} anio={anio} />
            </TabsContent>

            <TabsContent value="comparar" className="mt-4">
              <CompararAsistencias
                proyeccionId={proyeccion.id}
                asignaciones={proyeccion.asignaciones}
                mes={mes}
                anio={anio}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <ImportarExcelModal
        open={modalAbierto}
        mes={mes}
        anio={anio}
        puntos={puntos}
        onClose={() => setModalAbierto(false)}
        onSuccess={() => {
          setModalAbierto(false)
          router.refresh()
        }}
      />
    </div>
  )
}
