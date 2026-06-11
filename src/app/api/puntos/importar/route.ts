import { auth } from "@/lib/auth"
import { read, utils } from "xlsx"

interface RowRaw {
  CLIENTES?: string
  clientes?: string
  CODIGOS?: string
  codigos?: string
  CODIGO?: string
  DIRECCION?: string
  direccion?: string
  [key: string]: string | undefined
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
      const cliente = (row["CLIENTES"] ?? row["clientes"] ?? "").toString().trim()
      const codigo = (row["CODIGOS"] ?? row["codigos"] ?? row["CODIGO"] ?? "").toString().trim()
      const direccion = (row["DIRECCION"] ?? row["direccion"] ?? "").toString().trim()
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
