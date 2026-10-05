import { verificarAcceso } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"
import { read, utils } from "xlsx"
import { autodetectarMapeo, mapeoValido, separarNombreCompleto, CAMPOS_MAPEO, type Mapeo } from "@/lib/mapeo-colaboradores"
import { normalizarLegajo } from "@/lib/legajo"

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

function parsearFecha(raw: string | number | boolean | null | undefined): string {
  if (raw === null || raw === undefined || raw === "" || typeof raw === "boolean") return ""
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

// Acepta "09:00", "9:00", "9", o serial de Excel ("0.375")
function parsearHora(raw: string): string {
  if (!raw) return ""
  const str = raw.trim()
  const m = str.match(/^(\d{1,2})[:.hH](\d{2})/)
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`
  const n = Number(str.replace(",", "."))
  if (!isNaN(n)) {
    if (n >= 0 && n < 1) {
      const totalMin = Math.round(n * 24 * 60)
      const h = Math.floor(totalMin / 60) % 24
      const min = totalMin % 60
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
    }
    if (n >= 1 && n < 24) return `${String(Math.floor(n)).padStart(2, "0")}:00`
  }
  return ""
}

function parsearHorasNumero(raw: string): number | null {
  if (!raw) return null
  const n = Number(raw.trim().replace(",", "."))
  return isNaN(n) ? null : n
}

function sumarHoras(horaInicio: string, horas: number): string {
  const [h, m] = horaInicio.split(":").map(Number)
  const totalMin = h * 60 + m + Math.round(horas * 60)
  const hf = Math.floor(totalMin / 60) % 24
  const mf = ((totalMin % 60) + 60) % 60
  return `${String(hf).padStart(2, "0")}:${String(mf).padStart(2, "0")}`
}

function matchPunto(nombreBuscado: string, puntos: { id: string; nombre: string }[]): string | undefined {
  const low = nombreBuscado.toLowerCase()
  return puntos.find((p) => p.nombre.toLowerCase().includes(low) || low.includes(p.nombre.toLowerCase()))?.id
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
  punto_qr_nombre?: string
  punto_qr_id?: string | null
  hora_entrada?: string
  hora_salida?: string
}

export interface FilaExistente extends FilaAsociado {
  titular: string
}

export interface ColabDesactivado {
  id: string
  legajo: string
  apellido: string
  nombre: string
}

export interface DuplicadoArchivo {
  legajo: string
  nombre: string
}

export interface PreviewAsociados {
  tipo: "asociados"
  sheets: string[]
  sheet_actual: string
  columnas: string[]
  muestra: Record<string, string>[]
  mapeo: Mapeo
  creados: FilaAsociado[]
  actualizados: FilaExistente[]
  sinCambios: number
  duplicados_archivo: DuplicadoArchivo[]
  desactivados: ColabDesactivado[]
  sinPuntoQr: string[]
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

function parsearMapeo(raw: FormDataEntryValue | null, headers: string[]): Mapeo | null {
  if (typeof raw !== "string" || !raw) return null
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  if (!data || typeof data !== "object") return null
  const obj = data as Record<string, unknown>
  const mapeo: Mapeo = { palabras_apellido: obj.palabras_apellido === 1 ? 1 : 2 }
  for (const { key } of CAMPOS_MAPEO) {
    const v = obj[key]
    if (typeof v === "string" && headers.includes(v)) mapeo[key] = v
  }
  return mapeo
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
    if (rowStr.includes("apellido") || rowStr.includes("nombre") || rowStr.includes("soc") || rowStr.includes("dni") || rowStr.includes("legajo")) {
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

  if (tipo === "asociados") {
    const columnas = headers.filter(Boolean)
    const mapeo = parsearMapeo(formData.get("mapeo"), columnas) ?? autodetectarMapeo(columnas)
    return previewAsociados(rows, columnas, mapeo, empresaId, sheets, sheetToUse)
  }
  return previewServicios(rows, empresaId, sheets, sheetToUse)
}

function valor(row: RowRaw, columna: string | undefined): string {
  if (!columna) return ""
  const v = row[columna]
  return v === undefined || v === null ? "" : v.toString().trim()
}

async function previewAsociados(
  rows: RowRaw[],
  columnas: string[],
  mapeo: Mapeo,
  empresaId: string,
  sheets: string[],
  sheetActual: string
): Promise<Response> {
  const muestra = rows.slice(0, 3).map((r) => {
    const fila: Record<string, string> = {}
    for (const c of columnas) fila[c] = valor(r, c)
    return fila
  })

  const base = { tipo: "asociados" as const, sheets, sheet_actual: sheetActual, columnas, muestra, mapeo }
  const vacio: PreviewAsociados = {
    ...base, creados: [], actualizados: [], sinCambios: 0, duplicados_archivo: [], desactivados: [], sinPuntoQr: [],
  }

  // Mapeo incompleto: se devuelve igual para que el usuario lo corrija en el paso de columnas
  if (mapeoValido(mapeo)) return Response.json(vacio)

  const puntos = await prisma.puntoFichaje.findMany({
    where: { empresa_id: empresaId, activo: true },
    select: { id: true, nombre: true },
  })

  const sinPuntoQrSet = new Set<string>()
  const excelMap = new Map<string, FilaAsociado>()
  const duplicados_archivo: DuplicadoArchivo[] = []

  for (const row of rows) {
    let apellido: string
    let nombre: string
    if (mapeo.apellido && mapeo.nombre) {
      apellido = valor(row, mapeo.apellido)
      nombre = valor(row, mapeo.nombre)
    } else {
      const sep = separarNombreCompleto(valor(row, mapeo.nombre_completo), mapeo.palabras_apellido ?? 2)
      apellido = sep.apellido
      nombre = sep.nombre
    }
    if (!apellido && !nombre) continue

    const legajo = normalizarLegajo(valor(row, mapeo.legajo)) ?? ""
    const identificacion = valor(row, mapeo.dni).replace(/\./g, "").trim()

    // Clave única: legajo si existe, sino DNI, sino nombre normalizado
    const clave = legajo
      ? legajo
      : identificacion ? `__dni__${identificacion}` : `__nom__${`${apellido} ${nombre}`.toLowerCase().replace(/\s+/g, "_")}`

    if (excelMap.has(clave)) {
      if (legajo) duplicados_archivo.push({ legajo, nombre: `${apellido} ${nombre}`.trim() })
      continue
    }

    const sectorRaw = valor(row, mapeo.sector)
    const puesto = valor(row, mapeo.puesto)
    const sector = sectorRaw && puesto ? `${sectorRaw} — ${puesto}` : sectorRaw || puesto

    // Punto QR + horario (opcional, por fila) — define la jornada del colaborador
    const puntoQrNombre = valor(row, mapeo.punto_qr)
    let punto_qr_nombre: string | undefined
    let punto_qr_id: string | null | undefined
    let hora_entrada: string | undefined
    let hora_salida: string | undefined

    if (puntoQrNombre) {
      punto_qr_nombre = puntoQrNombre
      const matchId = matchPunto(puntoQrNombre, puntos)
      punto_qr_id = matchId ?? null
      if (!matchId) sinPuntoQrSet.add(`${legajo} ${apellido} ${nombre} — "${puntoQrNombre}"`)

      const horaInicio = parsearHora(valor(row, mapeo.hora_entrada))
      const horas = parsearHorasNumero(valor(row, mapeo.horas))
      if (horaInicio && horas != null) {
        hora_entrada = horaInicio
        hora_salida = sumarHoras(horaInicio, horas)
      }
    }

    excelMap.set(clave, {
      legajo,
      apellido,
      nombre,
      identificacion,
      domicilio: valor(row, mapeo.domicilio),
      celular: normalizarCelular(valor(row, mapeo.celular)),
      email: valor(row, mapeo.email),
      sector,
      fecha_ingreso: mapeo.fecha_ingreso ? parsearFecha(row[mapeo.fecha_ingreso]) : "",
      punto_qr_nombre, punto_qr_id, hora_entrada, hora_salida,
    })
  }

  if (excelMap.size === 0) {
    return Response.json(
      { error: `No se encontraron filas válidas con las columnas elegidas. Columnas: ${columnas.join(" | ")}` },
      { status: 400 }
    )
  }

  const enDB = await prisma.colaborador.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
    select: { id: true, legajo: true, nombre: true, apellido: true, identificacion: true, domicilio: true, celular: true, email: true, sector: true, estado: true },
  })

  const creados: FilaAsociado[] = []
  const actualizados: FilaExistente[] = []
  let sinCambios = 0

  for (const fila of excelMap.values()) {
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
    const cambioJornada = Boolean(fila.punto_qr_id && fila.hora_entrada && fila.hora_salida)
    const estabaDesactivado = existente.estado === "DESACTIVADO"

    if (cambioNombre || cambioDNI || cambioCelular || cambioEmail || cambioSector || cambioJornada || estabaDesactivado) {
      actualizados.push({ ...fila, titular: `${existente.apellido}, ${existente.nombre}` })
    } else {
      sinCambios++
    }
  }

  const desactivados: ColabDesactivado[] = enDB
    .filter((c) => c.legajo && !excelMap.has(c.legajo) && c.estado === "ACTIVO")
    .map((c) => ({ id: c.id, legajo: c.legajo!, apellido: c.apellido, nombre: c.nombre }))

  const preview: PreviewAsociados = {
    ...base,
    sinPuntoQr: Array.from(sinPuntoQrSet),
    creados,
    actualizados,
    sinCambios,
    duplicados_archivo,
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
