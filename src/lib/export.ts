import * as XLSX from "xlsx"

interface DiaReporteExport {
  fecha: string
  total: number
  completados: number
  en_curso: number
  pendientes: number
  tareas_total: number
  tareas_completadas: number
  tareas_criticas_no_completadas: number
  compliance_pct: number
}

export function exportarHistorialOperacionesExcel(dias: DiaReporteExport[]) {
  const datos = dias.map((d) => ({
    Fecha: d.fecha,
    "Procedimientos totales": d.total,
    Completados: d.completados,
    "En curso": d.en_curso,
    Pendientes: d.pendientes,
    "Tareas totales": d.tareas_total,
    "Tareas completadas": d.tareas_completadas,
    "Críticas incompletas": d.tareas_criticas_no_completadas,
    "Cumplimiento (%)": d.compliance_pct,
  }))

  const ws = XLSX.utils.json_to_sheet(datos)
  ws["!cols"] = [
    { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 18 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Historial")
  XLSX.writeFile(wb, `operaciones-historial-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

interface FilaExport {
  colaborador: { nombre: string; apellido: string }
  entrada: { timestamp: Date | string } | null
  salida: { timestamp: Date | string } | null
  edificio: string
  edificioReal: string
  nroTurno: number
  minutos: number | null
  totalMinutos: number
}

const horaARG = (t: Date | string) =>
  new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })

const fechaARG = (t: Date | string) =>
  new Date(t).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" })

// Horas en decimal (7,75) para poder sumarlas en Excel
const horasDecimal = (min: number) => Math.round((min / 60) * 100) / 100

export function exportarListadoExcel(filas: FilaExport[], fecha: string) {
  const datos = filas.map((f) => {
    const ref = f.entrada ?? f.salida
    return {
      Colaborador: `${f.colaborador.apellido} ${f.colaborador.nombre}`,
      Fecha: ref ? fechaARG(ref.timestamp) : fecha,
      Turno: f.nroTurno,
      Ingreso: f.entrada ? horaARG(f.entrada.timestamp) : "—",
      Egreso: f.salida ? horaARG(f.salida.timestamp) : "Pendiente",
      "Horas turno": f.minutos !== null ? horasDecimal(f.minutos) : "",
      "Total horas colaborador": f.nroTurno === 1 && f.totalMinutos > 0 ? horasDecimal(f.totalMinutos) : "",
      Edificio: f.edificioReal,
    }
  })

  const ws = XLSX.utils.json_to_sheet(datos)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Listado")
  XLSX.writeFile(wb, `listado-${fecha}.xlsx`)
}
