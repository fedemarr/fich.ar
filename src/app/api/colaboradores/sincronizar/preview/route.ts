import { verificarAcceso } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { read, utils } from "xlsx"

type RowRaw = Record<string, string | number | boolean | null | undefined>

function col(row: RowRaw, ...keys: string[]): string {
  const rowKeys = Object.keys(row)
  for (const k of keys) {
    const variants = [k, k.toLowerCase(), k.toUpperCase(), k.replace(/\s/g, "_"), k.replace(/\s/g, "")]
    for (const v of variants) {
      const val = row[v]
      if (val !== undefined && val !== null && val !== "") return val.toString().trim()
    }
    // Fallback: coincidencia parcial en claves del row
    const match = rowKeys.find(rk =>
      rk.toLowerCase().replace(/[^a-z0-9]/g, "").includes(k.toLowerCase().replace(/[^a-z0-9]/g, "")) ||
      k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(rk.toLowerCase().replace(/[^a-z0-9]/g, ""))
    )
    if (match) {
      const val = row[match]
      if (val !== undefined && val !== null && val !== "") return val.toString().trim()
    }
  }
  return ""
}

// Formato Olimpia: "APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2"
// Primeras 2 palabras = apellido compuesto, resto = nombre
function splitNombre(nombreCompleto: string): { apellido: string; nombre: string } {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return { apellido: partes[0] ?? "", nombre: "" }
  if (partes.length === 2) return { apellido: partes[0], nombre: partes[1] }
  return { apellido: partes.slice(0, 2).join(" "), nombre: partes.slice(2).join(" ") }
}

function normalizarCelular(raw: string): string {
  if (!raw) return ""
  const solo = raw.replace(/\D/g, "")
  if (!solo) return ""
  if (raw.startsWith("+")) return raw
  if (solo.startsWith("549")) return `+${solo}`
  if (solo.startsWith("54")) return `+${solo}`
  if (solo.startsWith("0")) return `+549${solo.slice(1)}`
  return `+549${solo}`
}

function parsearFecha(raw: string | number): string {
  if (!raw) return ""
  if (typeof raw === "number") {
    // Serial date de Excel
    const date = new Date((raw - 25569) * 86400 * 1000)
    return date.toISOString().split("T")[0]
  }
  const str = raw.toString().trim()
  // DD/MM/YYYY
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  return str
}

export interface FilaAsociado {
  legajo: string
  apellido: string
  nombre: string
  identificacion: string
  domicilio: string
  celular: string
  email: string
  sector: string
  fecha_ingreso: string
}

export interface ColabDesactivado {
  id: string
  legajo: string
  apellido: string
  nombre: string
}

export interface PreviewAsociados {
  tipo: "asociados"
  sheets: string[]
  sheet_actual: string
  creados: FilaAsociado[]
  actualizados: FilaAsociado[]
  sinCambios: number
  desactivados: ColabDesactivado[]
}

export interface FilaServicio {
  legajo: string
  apellido: string
  nombre: string
  objetivos: string[]
}

export interface PreviewServicios {
  tipo: "servicios"
  sheets: string[]
  sheet_actual: string
  asignaciones: FilaServicio[]
  sinColaborador: string[]
  sinPunto: string[]
}

export async function POST(req: Request): Promise<Response> {
  const { error, session } = await verificarAcceso("IMPORTAR_COLABORADORES")
  if (error) return error

  const empresaId = session.user.empresaId

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const tipo = formData.get("tipo") as string | null
  const sheetNameParam = formData.get("sheet_name") as string | null

  if (!file) return Response.json({ error: "Sin archivo" }, { status: 400 })
  if (tipo !== "asociados" && tipo !== "servicios") {
    return Response.json({ error: "Tipo inválido. Usar 'asociados' o 'servicios'" }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const workbook = read(buffer, { type: "array" })
  const sheets = workbook.SheetNames

  const sheetToUse =
    sheetNameParam && workbook.Sheets[sheetNameParam] ? sheetNameParam : sheets[0]

  const sheet = workbook.Sheets[sheetToUse]

  // Parsear como arrays para detectar la fila de headers (maneja títulos o filas vacías al principio)
  const rawRows = utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1, defval: "" })

  if (rawRows.length === 0) {
    return Response.json({ error: "El archivo no tiene filas válidas en la hoja seleccionada" }, { status: 400 })
  }

  // Encontrar la fila que contiene los headers reales (busca hasta la fila 10)
  let headerRowIndex = 0
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const rowStr = rawRows[i].join(" ").toLowerCase()
    if (rowStr.includes("apellido") || rowStr.includes("nombre") || rowStr.includes("soc") || rowStr.includes("dni")) {
      headerRowIndex = i
      break
    }
  }

  const headers = rawRows[headerRowIndex].map((h) => (h ?? "").toString().trim())
  const rows: RowRaw[] = rawRows.slice(headerRowIndex + 1)
    .map((row) => {
      const obj: RowRaw = {}
      headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? "" })
      return obj
    })
    .filter((row) => Object.values(row).some((v) => v !== "" && v !== null && v !== undefined))

  if (rows.length === 0) {
    return Response.json({ error: "El archivo no tiene filas de datos válidas" }, { status: 400 })
  }

  if (tipo === "asociados") return previewAsociados(rows, empresaId, sheets, sheetToUse)
  return previewServicios(rows, empresaId, sheets, sheetToUse)
}

async function previewAsociados(
  rows: RowRaw[],
  empresaId: string,
  sheets: string[],
  sheetActual: string
): Promise<Response> {
  const excelMap = new Map<string, FilaAsociado>()
  for (const row of rows) {
    // Soporta: formato clásico (NRO SOC/NOMBRE), formato Olimpia (Soc. N°/Apellido), formulario Google (Nombre y Apellido/DNI)
    const legajo = col(row, "NRO SOC", "NRO_SOC", "Soc. N°", "Soc N°", "SOC N", "Soc Nro", "N° Soc", "Legajo")
    const nombreCompleto = col(row, "Nombre y Apellido", "Apellido", "APELLIDO", "NOMBRE", "nombre", "Nombre Completo")
    const identificacion = col(row, "DNI", "dni").replace(/\./g, "").trim()

    // Necesitamos al menos nombre para importar
    if (!nombreCompleto) continue

    // Clave única: legajo si existe, sino DNI, sino nombre normalizado
    const claveBase = legajo || identificacion || nombreCompleto.toLowerCase().replace(/\s+/g, "_")
    const clave = legajo ? legajo : (identificacion ? `__dni__${identificacion}` : `__nom__${claveBase}`)
    if (!clave) continue

    const { apellido, nombre } = splitNombre(nombreCompleto || identificacion)
    const domicilio = col(row, "DOMICILIO", "domicilio")
    const celularRaw = col(row, "CONTACTO", "contacto", "N° de teléfono personal", "N° de teléfono", "CELULAR", "celular", "Celular", "Telefono")
    const celular = normalizarCelular(celularRaw)
    const email = col(row, "MAIL Principal", "MAIL", "mail", "Email", "EMAIL", "Correo", "casilla", "¿Qué casilla")
    const sectorRaw = col(row, "Sector de Trabajo", "Sector", "SECTOR", "sector")
    const puesto = col(row, "Puesto de Trabajo", "Puesto", "PUESTO", "puesto", "Cargo", "CARGO")
    const sector = sectorRaw && puesto ? `${sectorRaw} — ${puesto}` : sectorRaw || puesto
    const fechaRaw = row["Fecha de Ingreso"] ?? row["FECHA DE INGRESO"] ?? row["fecha_ingreso"] ?? row["Fecha Ingreso"] ?? ""
    const fecha_ingreso = parsearFecha(fechaRaw as string | number)

    excelMap.set(clave, { legajo, apellido, nombre, identificacion, domicilio, celular, email, sector, fecha_ingreso })
  }

  if (excelMap.size === 0) {
    const headersEncontrados = rows[0] ? Object.keys(rows[0]).join(" | ") : "sin filas"
    return Response.json(
      { error: `No se encontraron filas válidas. Columnas detectadas: ${headersEncontrados}` },
      { status: 400 }
    )
  }

  const enDB = await prisma.colaborador.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
    select: { id: true, legajo: true, nombre: true, apellido: true, identificacion: true, domicilio: true, celular: true, email: true, sector: true, estado: true },
  })

  const creados: FilaAsociado[] = []
  const actualizados: FilaAsociado[] = []
  let sinCambios = 0

  for (const [clave, fila] of excelMap) {
    // Buscar por legajo si existe, con fallback a DNI (cubre el caso de importaciones previas sin legajo)
    const existente = fila.legajo
      ? (enDB.find((c) => c.legajo === fila.legajo) ?? (fila.identificacion ? enDB.find((c) => c.identificacion === fila.identificacion) : undefined))
      : (fila.identificacion ? enDB.find((c) => c.identificacion === fila.identificacion) : undefined)

    if (!existente) {
      creados.push(fila)
      continue
    }

    const cambioNombre =
      fila.apellido.toLowerCase() !== existente.apellido.toLowerCase() ||
      fila.nombre.toLowerCase() !== existente.nombre.toLowerCase()
    const cambioDNI = fila.identificacion && fila.identificacion !== (existente.identificacion ?? "")
    const cambioCelular = fila.celular && fila.celular !== (existente.celular ?? "")
    const cambioEmail = fila.email && fila.email !== (existente.email ?? "")
    const cambioSector = fila.sector && fila.sector !== (existente.sector ?? "")
    const estabaDesactivado = existente.estado === "DESACTIVADO"

    if (cambioNombre || cambioDNI || cambioCelular || cambioEmail || cambioSector || estabaDesactivado) {
      actualizados.push(fila)
    } else {
      sinCambios++
    }
  }

  const desactivados: ColabDesactivado[] = enDB
    .filter((c) => c.legajo && !excelMap.has(c.legajo) && c.estado === "ACTIVO")
    .map((c) => ({ id: c.id, legajo: c.legajo!, apellido: c.apellido, nombre: c.nombre }))

  const preview: PreviewAsociados = {
    tipo: "asociados",
    sheets,
    sheet_actual: sheetActual,
    creados,
    actualizados,
    sinCambios,
    desactivados,
  }
  return Response.json(preview)
}

async function previewServicios(
  rows: RowRaw[],
  empresaId: string,
  sheets: string[],
  sheetActual: string
): Promise<Response> {
  const mapaServicios = new Map<string, { nombreCompleto: string; objetivos: Set<string> }>()
  for (const row of rows) {
    const legajo = col(row, "NRO SOC", "NRO_SOC", "NROSOC", "nro soc")
    const nombreCompleto = col(row, "NOMBRE", "nombre")
    const objetivo = col(row, "OBJETIVO", "objetivo")
    if (!legajo || !objetivo) continue

    if (!mapaServicios.has(legajo)) {
      mapaServicios.set(legajo, { nombreCompleto, objetivos: new Set() })
    }
    mapaServicios.get(legajo)!.objetivos.add(objetivo)
  }

  const [colaboradores, puntos] = await Promise.all([
    prisma.colaborador.findMany({
      where: { empresa_id: empresaId, deleted_at: null, legajo: { not: null } },
      select: { id: true, legajo: true, nombre: true, apellido: true },
    }),
    prisma.puntoFichaje.findMany({
      where: { empresa_id: empresaId, activo: true },
      select: { id: true, nombre: true },
    }),
  ])

  const colabPorLegajo = new Map(colaboradores.map((c) => [c.legajo!, c]))

  const objetivosUnicos = new Set<string>()
  for (const { objetivos } of mapaServicios.values()) {
    for (const obj of objetivos) objetivosUnicos.add(obj)
  }

  const sinPunto: string[] = []
  for (const objetivo of objetivosUnicos) {
    const match = puntos.find(
      (p) =>
        p.nombre.toLowerCase().includes(objetivo.toLowerCase()) ||
        objetivo.toLowerCase().includes(p.nombre.toLowerCase())
    )
    if (!match) sinPunto.push(objetivo)
  }

  const asignaciones: FilaServicio[] = []
  const sinColaborador: string[] = []

  for (const [legajo, { nombreCompleto, objetivos }] of mapaServicios) {
    const colab = colabPorLegajo.get(legajo)
    if (!colab) {
      sinColaborador.push(`${legajo} ${nombreCompleto}`)
    } else {
      asignaciones.push({
        legajo,
        apellido: colab.apellido,
        nombre: colab.nombre,
        objetivos: Array.from(objetivos),
      })
    }
  }

  const preview: PreviewServicios = {
    tipo: "servicios",
    sheets,
    sheet_actual: sheetActual,
    asignaciones,
    sinColaborador,
    sinPunto,
  }
  return Response.json(preview)
}
