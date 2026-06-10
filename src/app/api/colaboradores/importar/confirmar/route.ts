import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface FilaColaborador {
  apellido: string
  nombre: string
  celular: string
  legajo: string
  sector: string
  identificacion: string
  email: string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "No auth" }, { status: 401 })

  const empresaId = (session.user as { empresa_id?: string }).empresa_id
  if (!empresaId) return Response.json({ error: "Sin empresa" }, { status: 403 })

  const { rows } = (await req.json()) as { rows: FilaColaborador[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: "Sin filas" }, { status: 400 })
  }

  let creados = 0
  let actualizados = 0

  for (const fila of rows) {
    let existente = null

    // Buscar por celular primero (más exacto)
    if (fila.celular) {
      existente = await prisma.colaborador.findFirst({
        where: { empresa_id: empresaId, celular: fila.celular, deleted_at: null },
      })
    }

    // Si no hay celular, buscar por legajo
    if (!existente && fila.legajo) {
      existente = await prisma.colaborador.findFirst({
        where: { empresa_id: empresaId, legajo: fila.legajo, deleted_at: null },
      })
    }

    if (existente) {
      await prisma.colaborador.update({
        where: { id: existente.id },
        data: {
          nombre: fila.nombre || existente.nombre,
          apellido: fila.apellido || existente.apellido,
          ...(fila.celular && { celular: fila.celular }),
          ...(fila.legajo && { legajo: fila.legajo }),
          ...(fila.sector && { sector: fila.sector }),
          ...(fila.identificacion && { identificacion: fila.identificacion }),
          ...(fila.email && { email: fila.email }),
        },
      })
      actualizados++
    } else {
      await prisma.colaborador.create({
        data: {
          empresa_id: empresaId,
          nombre: fila.nombre || "Sin nombre",
          apellido: fila.apellido,
          celular: fila.celular || `SIN_CEL_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          legajo: fila.legajo || null,
          sector: fila.sector || null,
          identificacion: fila.identificacion || null,
          email: fila.email || null,
        },
      })
      creados++
    }
  }

  return Response.json({ ok: true, creados, actualizados })
}
