import { auth } from "@/lib/auth"
import { read, utils } from "xlsx"

type RowRaw = Record<string, string | number | boolean | null | undefined>

function col(row: RowRaw, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (val !== undefined && val !== null && val !== "") return val.toString().trim()
  }
  return ""
}

function normalizarCelular(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("549")) return "+" + digits
  if (digits.startsWith("54")) return "+549" + digits.slice(2)
  if (digits.startsWith("9") && digits.length === 12) return "+" + digits
  if (digits.length === 10) return "+549" + digits
  return "+" + digits
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
      const apellido = col(row, "Apellido", "APELLIDO", "apellido")
      const nombre = col(row, "Nombre", "NOMBRE", "nombre")
      const celularRaw = col(row, "Celular", "CELULAR", "Teléfono", "TELEFONO", "telefono", "Tel", "TEL")
      const celular = normalizarCelular(celularRaw)
      const legajo = col(row, "Legajo", "LEGAJO", "legajo")
      const sector = col(row, "Sector", "SECTOR", "sector", "Área", "AREA", "area")
      const identificacion = col(row, "DNI", "dni", "Identificación", "IDENTIFICACION", "identificacion", "Documento", "DOCUMENTO")
      const email = col(row, "Email", "EMAIL", "email", "Mail", "MAIL")
      return { apellido, nombre, celular, celularRaw, legajo, sector, identificacion, email }
    })
    .filter((r) => r.nombre && r.celular)

  return Response.json({ rows: parsed })
}
