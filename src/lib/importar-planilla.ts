import { read, utils } from "xlsx"

export interface FilaAsignacion {
  nroSocio: string
  apellidoNombre: string
  apellido: string
  nombre: string
  categoria: string
  valorHora: number | null
  horaInicio: string | null
  horaFin: string | null
  totalHoras: number | null
  dias: (number | null)[] // índice 0 = día 1, índice 30 = día 31
}

export interface HojaServicio {
  servicio: string // nombre de la hoja
  filas: FilaAsignacion[]
}

export interface ResultadoPlanilla {
  hojas: HojaServicio[]
  totalEmpleados: number
  totalServicios: number
}

// Parsea "F"/"f" → 0, número → número, vacío → null
function parsearCelda(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null
  const str = String(val).trim().toUpperCase()
  if (str === "F") return 0
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

function splitNombreCompleto(nombreCompleto: string): { apellido: string; nombre: string } {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return { apellido: partes[0] ?? "", nombre: "" }
  if (partes.length === 2) return { apellido: partes[0], nombre: partes[1] }
  // Formato Olimpia: primeras 2 palabras = apellido compuesto
  return { apellido: partes.slice(0, 2).join(" "), nombre: partes.slice(2).join(" ") }
}

function esHojaIgnorar(nombre: string): boolean {
  return nombre.toLowerCase().includes("resumen")
}

// Detecta cuál columna corresponde a cada día (01..31) buscando la fila de encabezado
// Devuelve un mapa: número de día → índice de columna (0-based)
function detectarColumnasDias(
  encabezados: string[]
): Map<number, number> {
  const mapa = new Map<number, number>()
  for (let i = 0; i < encabezados.length; i++) {
    const h = String(encabezados[i] ?? "").trim()
    const n = parseInt(h)
    if (!isNaN(n) && n >= 1 && n <= 31) {
      mapa.set(n, i)
    }
  }
  return mapa
}

export function parsearPlanilla(buffer: ArrayBuffer): ResultadoPlanilla {
  const workbook = read(buffer, { type: "array" })
  const hojas: HojaServicio[] = []

  for (const nombreHoja of workbook.SheetNames) {
    if (esHojaIgnorar(nombreHoja)) continue

    const sheet = workbook.Sheets[nombreHoja]
    // sheet_to_json con header:1 → array de arrays para control total
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })

    if (rows.length < 2) continue

    // Buscar la fila de encabezado: la que contenga "SOCIO" o "NRO" o columnas numéricas 1-31
    let headerRowIdx = -1
    let encabezados: string[] = []

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const fila = rows[i] as unknown[]
      const strs = fila.map((v) => String(v ?? "").trim().toUpperCase())
      // Encabezado si contiene SOCIO o tiene varios números del 1-31
      const tieneSOCIO = strs.some((s) => s.includes("SOCIO") || s.includes("NRO"))
      const numerosEnFila = strs.filter((s) => {
        const n = parseInt(s)
        return !isNaN(n) && n >= 1 && n <= 31
      }).length
      if (tieneSOCIO || numerosEnFila >= 10) {
        headerRowIdx = i
        encabezados = strs
        break
      }
    }

    if (headerRowIdx === -1) continue

    // Detectar columnas clave
    const colSocio = encabezados.findIndex((h) => h.includes("SOCIO") || h === "NRO")
    const colNombre = encabezados.findIndex(
      (h) => h.includes("APELLIDO") || h.includes("NOMBRE")
    )
    const colCategoria = encabezados.findIndex((h) => h.includes("CATEG"))
    const colValor = encabezados.findIndex(
      (h) => h.includes("VALOR") || h.includes("SUELDO")
    )
    const colTotalHs = encabezados.findIndex(
      (h) => h === "HS MES" || h === "TOTAL" || h.includes("HS MES")
    )
    const colHsInicio = encabezados.findIndex(
      (h) => h.includes("INICIO") || h.includes("ENTR")
    )
    const colHsFin = encabezados.findIndex(
      (h) => h.includes("FIN") || h.includes("SAL")
    )

    const mapaDias = detectarColumnasDias(encabezados)

    const filas: FilaAsignacion[] = []

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const fila = rows[r] as unknown[]

      const nroSocioRaw = colSocio >= 0 ? String(fila[colSocio] ?? "").trim() : ""
      // Ignorar filas sin número de socio (totales, vacías)
      if (!nroSocioRaw || isNaN(Number(nroSocioRaw))) continue

      const nroSocio = nroSocioRaw
      const apellidoNombre = colNombre >= 0 ? String(fila[colNombre] ?? "").trim() : ""
      const { apellido, nombre } = splitNombreCompleto(apellidoNombre)
      const categoria = colCategoria >= 0 ? String(fila[colCategoria] ?? "").trim() : ""
      const valorHora =
        colValor >= 0 ? (parseFloat(String(fila[colValor] ?? "")) || null) : null
      const totalHoras =
        colTotalHs >= 0 ? (parseFloat(String(fila[colTotalHs] ?? "")) || null) : null
      const horaInicio =
        colHsInicio >= 0 ? String(fila[colHsInicio] ?? "").trim() || null : null
      const horaFin =
        colHsFin >= 0 ? String(fila[colHsFin] ?? "").trim() || null : null

      // Parsear los 31 días
      const dias: (number | null)[] = Array(31).fill(null)
      for (const [dia, colIdx] of mapaDias) {
        dias[dia - 1] = parsearCelda(fila[colIdx])
      }

      filas.push({
        nroSocio,
        apellidoNombre,
        apellido,
        nombre,
        categoria,
        valorHora,
        horaInicio,
        horaFin,
        totalHoras,
        dias,
      })
    }

    if (filas.length > 0) {
      hojas.push({ servicio: nombreHoja.trim(), filas })
    }
  }

  const totalEmpleados = new Set(
    hojas.flatMap((h) => h.filas.map((f) => f.nroSocio))
  ).size

  return { hojas, totalEmpleados, totalServicios: hojas.length }
}
