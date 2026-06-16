import { auth } from "@/lib/auth"
import { read, utils } from "xlsx"

type RowRaw = Record<string, string | undefined>

function pickCol(row: RowRaw, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k]
    if (val && val.toString().trim()) return val.toString().trim()
  }
  return ""
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
      // Acepta columnas en español con/sin acentos y en mayúsculas/minúsculas
      const cliente = pickCol(row,
        "CLIENTES", "clientes", "Clientes",
        "RAZON SOCIAL", "Razón Social", "Razon Social", "RAZON_SOCIAL", "razon_social",
        "CLIENTE", "cliente"
      )
      const codigo = pickCol(row,
        "CODIGOS", "codigos", "Codigo", "Código", "CODIGO",
        "COD", "cod", "Cod"
      )
      const direccion = pickCol(row,
        "DIRECCION", "direccion", "Dirección", "Direccion", "DIRECCIÓN",
        "DIR", "dir", "Direc"
      )
      return { cliente, codigo, direccion }
    })
    .filter(
      (r) =>
        r.codigo &&
        r.direccion &&
        r.direccion !== "#N/D" &&
        r.direccion !== "#N/A" &&
        !r.direccion.startsWith("#")
    )

  return Response.json({ rows: parsed })
}
