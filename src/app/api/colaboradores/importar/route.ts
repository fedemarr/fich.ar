import { auth } from "@/lib/auth"
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

function normalizarCelular(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("549")) return "+" + digits
  if (digits.startsWith("54")) return "+549" + digits.slice(2)
  if (digits.length === 10) return "+549" + digits
  return "+" + digits
}

function splitNombre(nombreCompleto: string): { apellido: string; nombre: string } {
  const partes = nombreCompleto.trim().split(/\s+/)
  if (partes.length <= 1) return { apellido: partes[0] ?? "", nombre: "" }
  if (partes.length === 2) return { apellido: partes[0], nombre: partes[1] }
  // 3+ palabras: primera palabra = apellido, resto = nombre
  // (el formato del Excel de Olimpia es: APELLIDO NOMBRE...)
  return { apellido: partes[0], nombre: partes.slice(1).join(" ") }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "No auth" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return Response.json({ error: "Sin archivo" }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = read(buffer, { type: "array" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = utils.sheet_to_json<RowRaw>(sheet, { defval: "" })

  const parsed = rows
    .map((row) => {
      // Formato Olimpia: NRO SOC + NOMBRE (apellido primero)
      const nroSoc = col(row, "NRO SOC", "NRO_SOC", "NROSOC", "nro soc", "Nro Soc", "legajo", "LEGAJO")
      const nombreCompleto = col(row, "NOMBRE", "nombre", "Nombre")

      // Formato con columnas separadas (apellido, nombre, celular)
      const apellidoCol = col(row, "Apellido", "APELLIDO")
      const nombreCol = col(row, "Nombre", "NOMBRE")
      const celularRaw = col(row, "Celular", "CELULAR", "Teléfono", "TELEFONO", "telefono", "Tel", "TEL")

      let apellido: string
      let nombre: string

      if (apellidoCol && nombreCol && apellidoCol !== nombreCol) {
        // Formato con columnas separadas
        apellido = apellidoCol
        nombre = nombreCol
      } else if (nombreCompleto) {
        // Formato Olimpia: nombre completo en una sola columna
        const split = splitNombre(nombreCompleto)
        apellido = split.apellido
        nombre = split.nombre
      } else {
        return null
      }

      const celular = normalizarCelular(celularRaw)
      const legajo = nroSoc || col(row, "Legajo", "LEGAJO")
      const sector = col(row, "Sector", "SECTOR")
      const identificacion = col(row, "DNI", "dni", "Identificación", "IDENTIFICACION")
      const email = col(row, "Email", "EMAIL", "email")

      return { apellido, nombre, celular, celularRaw, legajo, sector, identificacion, email }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && !!(r.apellido || r.nombre))

  return Response.json({ rows: parsed })
}
