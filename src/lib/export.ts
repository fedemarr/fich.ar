import * as XLSX from "xlsx"

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
