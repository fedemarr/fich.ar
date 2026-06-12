import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { read, utils } from "xlsx"

type RowRaw = Record<string, string | number | boolean | null | undefined>

function col(row: RowRaw, ...keys: string[]): string {
  for (const k of keys) {
    const variants = [k, k.toLowerCase(), k.toUpperCase(), k.replace(/\s/g, "_"), k.replace(/\s/g, "")]
    for (const v of variants) {
      const val = row[v]
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

export interface FilaAsociado {
  legajo: string
  apellido: string
  nombre: string
  identificacion: string
  domicilio: string
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
  const session = await auth()
  if (!session?.user) return Response.json({ error: "No auth" }, { status: 401 })

  const empresaId = session.user.empresaId
  if (!empresaId) return Response.json({ error: "Sin empresa" }, { status: 403 })

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
  const rows = utils.sheet_to_json<RowRaw>(sheet, { defval: "" })

  if (rows.length === 0) {
    return Response.json({ error: "El archivo no tiene filas válidas en la hoja seleccionada" }, { status: 400 })
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
    const legajo = col(row, "NRO SOC", "NRO_SOC", "NROSOC", "nro soc")
    const nombreCompleto = col(row, "NOMBRE", "nombre")
    if (!legajo || !nombreCompleto) continue

    const { apellido, nombre } = splitNombre(nombreCompleto)
    const identificacion = col(row, "DNI", "dni").replace(/\./g, "").trim()
    const domicilio = col(row, "DOMICILIO", "domicilio")

    excelMap.set(legajo, { legajo, apellido, nombre, identificacion, domicilio })
  }

  if (excelMap.size === 0) {
    return Response.json(
      { error: "No se encontraron filas con NRO SOC y NOMBRE. Verificá las columnas del archivo." },
      { status: 400 }
    )
  }

  const enDB = await prisma.colaborador.findMany({
    where: { empresa_id: empresaId, deleted_at: null, legajo: { not: null } },
    select: { id: true, legajo: true, nombre: true, apellido: true, identificacion: true, domicilio: true, estado: true },
  })

  const creados: FilaAsociado[] = []
  const actualizados: FilaAsociado[] = []
  let sinCambios = 0

  for (const [legajo, fila] of excelMap) {
    const existente = enDB.find((c) => c.legajo === legajo)
    if (!existente) {
      creados.push(fila)
      continue
    }

    const cambioNombre =
      fila.apellido.toLowerCase() !== existente.apellido.toLowerCase() ||
      fila.nombre.toLowerCase() !== existente.nombre.toLowerCase()
    const cambioDNI = fila.identificacion && fila.identificacion !== (existente.identificacion ?? "")
    const cambioDomicilio = fila.domicilio && fila.domicilio !== (existente.domicilio ?? "")
    const estabaDesactivado = existente.estado === "DESACTIVADO"

    if (cambioNombre || cambioDNI || cambioDomicilio || estabaDesactivado) {
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
