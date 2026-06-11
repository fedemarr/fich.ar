import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { read, utils } from "xlsx"

type RowRaw = Record<string, string | number | boolean | null | undefined>

function col(row: RowRaw, ...keys: string[]): string {
  for (const k of keys) {
    const variants = [k, k.toLowerCase(), k.toUpperCase(), k.replace(/\s/g, "_")]
    for (const v of variants) {
      const val = row[v]
      if (val !== undefined && val !== null && val !== "") return String(val).trim()
    }
  }
  return ""
}

// POST /api/puntos/importar-servicios
// Formato: Nombre | Dirección | Latitud | Longitud | Radio (opcional)
// Idempotente: actualiza si ya existe un punto con el mismo nombre
export async function POST(req: Request): Promise<Response> {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "No auth" }, { status: 401 })

  const empresaId = session.user.empresaId
  if (!empresaId) return Response.json({ error: "Sin empresa" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return Response.json({ error: "Sin archivo" }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = read(buffer, { type: "array" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = utils.sheet_to_json<RowRaw>(sheet, { defval: "" })

  // Obtener puntos existentes para el upsert
  const existentes = await prisma.puntoFichaje.findMany({
    where: { empresa_id: empresaId },
    select: { id: true, nombre: true },
  })
  const porNombre = new Map(existentes.map((p) => [p.nombre.toLowerCase().trim(), p.id]))

  let creados = 0
  let actualizados = 0
  const errores: string[] = []

  for (const row of rows) {
    const nombre = col(row, "Nombre", "NOMBRE", "nombre", "SERVICIO", "servicio")
    const latStr = col(row, "Latitud", "LATITUD", "latitud", "LAT")
    const lonStr = col(row, "Longitud", "LONGITUD", "longitud", "LON", "LNG")
    const radioStr = col(row, "Radio", "RADIO", "radio", "RADIO_METROS")

    if (!nombre) continue

    const latitud = parseFloat(latStr)
    const longitud = parseFloat(lonStr)

    if (isNaN(latitud) || isNaN(longitud)) {
      errores.push(`"${nombre}": coordenadas inválidas (${latStr}, ${lonStr})`)
      continue
    }

    const radio = parseInt(radioStr) || 200
    const nombreKey = nombre.toLowerCase().trim()
    const existeId = porNombre.get(nombreKey)

    if (existeId) {
      await prisma.puntoFichaje.update({
        where: { id: existeId },
        data: { latitud, longitud, radio_metros: radio, activo: true },
      })
      actualizados++
    } else {
      const nuevo = await prisma.puntoFichaje.create({
        data: { empresa_id: empresaId, nombre, latitud, longitud, radio_metros: radio },
      })
      porNombre.set(nombreKey, nuevo.id)
      creados++
    }
  }

  return Response.json({ ok: true, creados, actualizados, errores })
}
