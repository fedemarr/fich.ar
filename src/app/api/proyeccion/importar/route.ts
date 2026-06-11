import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parsearPlanilla } from "@/lib/importar-planilla"
import { z } from "zod"

// POST /api/proyeccion/importar
// Body: FormData { file, mes, anio }
// Devuelve un preview con matcheos de servicio → punto QR antes de confirmar

export async function POST(req: Request): Promise<Response> {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No auth" }, { status: 401 })

  const empresaId = session.user.empresaId
  if (!empresaId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const mesRaw = formData.get("mes")
  const anioRaw = formData.get("anio")

  if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 })

  const params = z
    .object({ mes: z.coerce.number().int().min(1).max(12), anio: z.coerce.number().int().min(2024) })
    .safeParse({ mes: mesRaw, anio: anioRaw })
  if (!params.success) return NextResponse.json({ error: "Mes/año inválido" }, { status: 400 })

  const { mes, anio } = params.data
  const buffer = await file.arrayBuffer()
  const planilla = parsearPlanilla(buffer)

  if (planilla.hojas.length === 0) {
    return NextResponse.json(
      { error: "No se encontraron hojas válidas. Verificá que el archivo tenga hojas con datos de empleados." },
      { status: 400 }
    )
  }

  // Obtener puntos QR y colaboradores de la empresa para el preview
  const [puntos, colaboradores] = await Promise.all([
    prisma.puntoFichaje.findMany({
      where: { empresa_id: empresaId, activo: true },
      select: { id: true, nombre: true },
    }),
    prisma.colaborador.findMany({
      where: { empresa_id: empresaId, deleted_at: null, legajo: { not: null } },
      select: { id: true, legajo: true, nombre: true, apellido: true },
    }),
  ])

  const colabPorLegajo = new Map(colaboradores.map((c) => [c.legajo!, c]))

  // Por cada hoja, buscar el punto QR correspondiente (fuzzy match)
  const matchServicios = planilla.hojas.map((hoja) => {
    const nombreNorm = hoja.servicio.toLowerCase().replace(/\s+/g, " ").trim()
    const punto = puntos.find((p) => {
      const puntoNorm = p.nombre.toLowerCase().replace(/\s+/g, " ").trim()
      return puntoNorm.includes(nombreNorm) || nombreNorm.includes(puntoNorm)
    })

    // Empleados nuevos (no tienen legajo en DB)
    const nuevos = hoja.filas.filter((f) => !colabPorLegajo.has(f.nroSocio))

    return {
      servicio: hoja.servicio,
      empleados: hoja.filas.length,
      nuevos: nuevos.length,
      punto_id: punto?.id ?? null,
      punto_nombre: punto?.nombre ?? null,
    }
  })

  return NextResponse.json({
    mes,
    anio,
    servicios: matchServicios,
    total_empleados: planilla.totalEmpleados,
    total_servicios: planilla.totalServicios,
    // Devolvemos los datos parseados para que el confirm no reprocese el archivo
    _hojas: planilla.hojas,
  })
}
