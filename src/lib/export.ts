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
}

export function exportarListadoExcel(filas: FilaExport[], fecha: string) {
  const datos = filas.map((f) => ({
    Colaborador: `${f.colaborador.apellido} ${f.colaborador.nombre}`,
    Fecha: fecha,
    Ingreso: f.entrada
      ? new Date(f.entrada.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      : "—",
    Egreso: f.salida
      ? new Date(f.salida.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      : "Pendiente",
    Edificio: f.edificio,
  }))

  const ws = XLSX.utils.json_to_sheet(datos)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Listado")
  XLSX.writeFile(wb, `listado-${fecha}.xlsx`)
}
