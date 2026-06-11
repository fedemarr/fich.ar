import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { FilaAsignacion } from "@/lib/importar-planilla"

const FilaSchema = z.object({
  nroSocio: z.string(),
  apellidoNombre: z.string(),
  apellido: z.string(),
  nombre: z.string(),
  categoria: z.string(),
  valorHora: z.union([z.number(), z.null()]),
  horaInicio: z.union([z.string(), z.null()]),
  horaFin: z.union([z.string(), z.null()]),
  totalHoras: z.union([z.number(), z.null()]),
  dias: z.array(z.union([z.number(), z.null()])),
})

const HojaSchema = z.object({
  servicio: z.string(),
  punto_id: z.union([z.string(), z.null()]),
  filas: z.array(FilaSchema),
})

const BodySchema = z.object({
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2024),
  hojas: z.array(HojaSchema),
})

// POST /api/proyeccion/importar/confirmar
// Idempotente: si ya existe la proyección del mes la reemplaza
export async function POST(req: Request): Promise<Response> {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "No auth" }, { status: 401 })

  const empresaId = session.user.empresaId
  if (!empresaId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 })

  const rawBody = await req.json()
  const body = BodySchema.safeParse(rawBody)
  if (!body.success) {
    console.error("[proyeccion/confirmar] Zod error:", JSON.stringify(body.error.issues, null, 2))
    return NextResponse.json({ error: "Datos inválidos", issues: body.error.issues }, { status: 400 })
  }

  const { mes, anio, hojas } = body.data

  // Colaboradores por legajo para buscar/crear
  const colaboradoresDB = await prisma.colaborador.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
    select: { id: true, legajo: true, nombre: true, apellido: true },
  })
  const colabPorLegajo = new Map(
    colaboradoresDB.filter((c) => c.legajo).map((c) => [c.legajo!, c.id])
  )

  let creadosColab = 0
  let asignaciones = 0

  // Crear colaboradores nuevos (los que no existen en DB)
  const todosNroSocio = new Set(hojas.flatMap((h) => h.filas.map((f) => f.nroSocio)))
  for (const nroSocio of todosNroSocio) {
    if (colabPorLegajo.has(nroSocio)) continue
    // Buscar datos en la primera hoja que lo tenga
    const fila = hojas.flatMap((h) => h.filas).find((f) => f.nroSocio === nroSocio)
    if (!fila) continue

    const nuevo = await prisma.colaborador.create({
      data: {
        empresa_id: empresaId,
        legajo: fila.nroSocio,
        apellido: fila.apellido,
        nombre: fila.nombre || fila.apellido,
        celular: `SIN_CEL_${fila.nroSocio}`,
        estado: "ACTIVO",
      },
    })
    colabPorLegajo.set(nroSocio, nuevo.id)
    creadosColab++
  }

  // Upsert proyección mensual
  const proyeccion = await prisma.proyeccionMensual.upsert({
    where: { empresa_id_mes_anio: { empresa_id: empresaId, mes, anio } },
    create: { empresa_id: empresaId, mes, anio },
    update: { updated_at: new Date() },
  })

  // Borrar asignaciones previas del mes (reimportación idempotente)
  await prisma.asignacionMensual.deleteMany({
    where: { proyeccion_id: proyeccion.id },
  })

  // Crear asignaciones nuevas
  for (const hoja of hojas) {
    for (const fila of hoja.filas) {
      const colaboradorId = colabPorLegajo.get(fila.nroSocio)
      if (!colaboradorId) continue

      const diasObj = buildDiasObj(fila.dias)

      await prisma.asignacionMensual.create({
        data: {
          empresa_id: empresaId,
          proyeccion_id: proyeccion.id,
          colaborador_id: colaboradorId,
          punto_fichaje_id: hoja.punto_id ?? null,
          servicio_nombre: hoja.servicio,
          nro_socio: fila.nroSocio,
          categoria: fila.categoria || null,
          valor_hora: fila.valorHora,
          hora_inicio: fila.horaInicio,
          hora_fin: fila.horaFin,
          total_horas: fila.totalHoras,
          ...diasObj,
        },
      })
      asignaciones++
    }
  }

  return NextResponse.json({
    ok: true,
    proyeccion_id: proyeccion.id,
    creados_colaboradores: creadosColab,
    asignaciones,
  })
}

// Convierte array de 31 días a { dia_01, dia_02, ... dia_31 }
function buildDiasObj(dias: (number | null)[]): Record<string, number | null> {
  const obj: Record<string, number | null> = {}
  for (let i = 0; i < 31; i++) {
    const key = `dia_${String(i + 1).padStart(2, "0")}`
    obj[key] = dias[i] ?? null
  }
  return obj
}
