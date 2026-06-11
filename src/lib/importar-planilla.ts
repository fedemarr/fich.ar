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
  servicio: string
  filas: FilaAsignacion[]
}

export interface ResultadoPlanilla {
  hojas: HojaServicio[]
  totalEmpleados: number
  totalServicios: number
}

// Parsea celdas de días: "F"/"f" → 0 (franco), número → horas, "AI"/"A" → null, vacío → null
function parsearCelda(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null
  const str = String(val).trim().toUpperCase()
  if (str === "F") return 0
  if (str === "" || str === "AI" || str === "A" || str === "L") return null
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}

function splitNombreCompleto(nombreCompleto: string): { apellido: string; nombre: string } {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return { apellido: partes[0] ?? "", nombre: "" }
  if (partes.length === 2) return { apellido: partes[0], nombre: partes[1] }
  // Formato Olimpia: primeras 2 palabras = apellido compuesto, resto = nombre
  return { apellido: partes.slice(0, 2).join(" "), nombre: partes.slice(2).join(" ") }
}

function detectarColumnasDias(encabezados: string[]): Map<number, number> {
  const mapa = new Map<number, number>()
  for (let i = 0; i < encabezados.length; i++) {
    const h = encabezados[i].trim()
    const n = parseInt(h)
    if (!isNaN(n) && n >= 1 && n <= 31 && String(n) === h) {
      mapa.set(n, i)
    }
  }
  return mapa
}

// ─── Formato plano (RESUMEN SIN FORMULA de Olimpia) ─────────────────────────
// Una sola hoja con columnas: NRO SOC | NOMBRE | OBJETIVO | ART 42 | 1..31 | Cant Hrs | SUPERVISOR | CATEGORIA FIJA | CATEGORIA TEMPORARIA | TIPO DE HORA CARGADA
// OBJETIVO = servicio/lugar donde trabaja el empleado

interface HeaderFlat {
  rowIdx: number
  headers: string[]
}

function detectarHeaderFlat(rows: unknown[][]): HeaderFlat | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const fila = rows[i] as unknown[]
    const strs = fila.map((v) => String(v ?? "").trim().toUpperCase())
    const tieneObjetivo = strs.some((s) => s === "OBJETIVO")
    const tieneNroSoc = strs.some((s) => s.includes("NRO") || s.includes("SOCIO"))
    if (tieneObjetivo && tieneNroSoc) {
      return { rowIdx: i, headers: strs }
    }
  }
  return null
}

function parsearFormatoFlat(rows: unknown[][], header: HeaderFlat): ResultadoPlanilla {
  const { rowIdx, headers } = header

  const colNroSoc = headers.findIndex((h) => h.includes("NRO") || h.includes("SOCIO"))
  const colNombre = headers.findIndex((h) => h === "NOMBRE")
  const colObjetivo = headers.findIndex((h) => h === "OBJETIVO")
  const colCantHrs = headers.findIndex(
    (h) => h.includes("CANT") || h === "HS MES" || h === "TOTAL HRS" || h === "TOTAL"
  )
  const colCatFija = headers.findIndex((h) => h.includes("FIJA"))
  const colCatTemp = headers.findIndex((h) => h.includes("TEMP"))

  const mapaDias = detectarColumnasDias(headers)

  // Agrupar filas por OBJETIVO
  const porObjetivo = new Map<string, FilaAsignacion[]>()

  for (let r = rowIdx + 1; r < rows.length; r++) {
    const fila = rows[r] as unknown[]

    const nroSocRaw = colNroSoc >= 0 ? String(fila[colNroSoc] ?? "").trim() : ""
    if (!nroSocRaw || isNaN(Number(nroSocRaw))) continue

    const nombreRaw = colNombre >= 0 ? String(fila[colNombre] ?? "").trim() : ""
    if (!nombreRaw) continue

    const objetivoRaw = colObjetivo >= 0 ? String(fila[colObjetivo] ?? "").trim() : ""
    if (!objetivoRaw) continue

    const { apellido, nombre } = splitNombreCompleto(nombreRaw)

    const totalHorasRaw = colCantHrs >= 0 ? fila[colCantHrs] : null
    const totalHoras = totalHorasRaw !== null ? parseFloat(String(totalHorasRaw ?? "")) || null : null

    // Categoría: preferir CATEGORIA FIJA, fallback CATEGORIA TEMPORARIA
    const catFija = colCatFija >= 0 ? String(fila[colCatFija] ?? "").trim() : ""
    const catTemp = colCatTemp >= 0 ? String(fila[colCatTemp] ?? "").trim() : ""
    const categoria = catFija || catTemp || ""

    const dias: (number | null)[] = Array(31).fill(null)
    for (const [dia, colIdx] of mapaDias) {
      dias[dia - 1] = parsearCelda(fila[colIdx])
    }

    const filaAsig: FilaAsignacion = {
      nroSocio: nroSocRaw,
      apellidoNombre: nombreRaw,
      apellido,
      nombre,
      categoria,
      valorHora: null,
      horaInicio: null,
      horaFin: null,
      totalHoras,
      dias,
    }

    if (!porObjetivo.has(objetivoRaw)) porObjetivo.set(objetivoRaw, [])
    porObjetivo.get(objetivoRaw)!.push(filaAsig)
  }

  const hojas: HojaServicio[] = Array.from(porObjetivo.entries()).map(([servicio, filas]) => ({
    servicio,
    filas,
  }))

  const totalEmpleados = new Set(hojas.flatMap((h) => h.filas.map((f) => f.nroSocio))).size

  return { hojas, totalEmpleados, totalServicios: hojas.length }
}

// ─── Formato multi-hoja (una hoja por servicio) ───────────────────────────────

function parsearFormatoMultiHoja(workbook: ReturnType<typeof read>): ResultadoPlanilla {
  const hojas: HojaServicio[] = []

  for (const nombreHoja of workbook.SheetNames) {
    const sheet = workbook.Sheets[nombreHoja]
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })
    if (rows.length < 2) continue

    let headerRowIdx = -1
    let encabezados: string[] = []

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const fila = rows[i] as unknown[]
      const strs = fila.map((v) => String(v ?? "").trim().toUpperCase())
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

    const colSocio = encabezados.findIndex((h) => h.includes("SOCIO") || h === "NRO")
    const colNombre = encabezados.findIndex((h) => h.includes("APELLIDO") || h.includes("NOMBRE"))
    const colCategoria = encabezados.findIndex((h) => h.includes("CATEG"))
    const colValor = encabezados.findIndex((h) => h.includes("VALOR") || h.includes("SUELDO"))
    const colTotalHs = encabezados.findIndex(
      (h) => h === "HS MES" || h === "TOTAL" || h.includes("HS MES")
    )
    const colHsInicio = encabezados.findIndex((h) => h.includes("INICIO") || h.includes("ENTR"))
    const colHsFin = encabezados.findIndex((h) => h.includes("FIN") || h.includes("SAL"))
    const mapaDias = detectarColumnasDias(encabezados)

    const filas: FilaAsignacion[] = []

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const fila = rows[r] as unknown[]
      const nroSocioRaw = colSocio >= 0 ? String(fila[colSocio] ?? "").trim() : ""
      if (!nroSocioRaw || isNaN(Number(nroSocioRaw))) continue

      const apellidoNombre = colNombre >= 0 ? String(fila[colNombre] ?? "").trim() : ""
      const { apellido, nombre } = splitNombreCompleto(apellidoNombre)
      const categoria = colCategoria >= 0 ? String(fila[colCategoria] ?? "").trim() : ""
      const valorHora = colValor >= 0 ? parseFloat(String(fila[colValor] ?? "")) || null : null
      const totalHoras = colTotalHs >= 0 ? parseFloat(String(fila[colTotalHs] ?? "")) || null : null
      const horaInicio = colHsInicio >= 0 ? String(fila[colHsInicio] ?? "").trim() || null : null
      const horaFin = colHsFin >= 0 ? String(fila[colHsFin] ?? "").trim() || null : null

      const dias: (number | null)[] = Array(31).fill(null)
      for (const [dia, colIdx] of mapaDias) {
        dias[dia - 1] = parsearCelda(fila[colIdx])
      }

      filas.push({
        nroSocio: nroSocioRaw,
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

  const totalEmpleados = new Set(hojas.flatMap((h) => h.filas.map((f) => f.nroSocio))).size
  return { hojas, totalEmpleados, totalServicios: hojas.length }
}

// ─── Entry point — auto-detecta el formato ───────────────────────────────────

export function parsearPlanilla(buffer: ArrayBuffer): ResultadoPlanilla {
  const workbook = read(buffer, { type: "array" })

  // Intentar detectar formato plano (OBJETIVO column) en cualquier hoja
  for (const nombreHoja of workbook.SheetNames) {
    const sheet = workbook.Sheets[nombreHoja]
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })
    const header = detectarHeaderFlat(rows)
    if (header) {
      return parsearFormatoFlat(rows, header)
    }
  }

  // Fallback: formato multi-hoja
  return parsearFormatoMultiHoja(workbook)
}
