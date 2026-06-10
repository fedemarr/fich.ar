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
    const existente = await prisma.colaborador.findFirst({
      where: { empresa_id: empresaId, celular: fila.celular, deleted_at: null },
    })

    if (existente) {
      await prisma.colaborador.update({
        where: { id: existente.id },
        data: {
          nombre: fila.nombre || existente.nombre,
          apellido: fila.apellido || existente.apellido,
          legajo: fila.legajo || existente.legajo,
          sector: fila.sector || existente.sector,
          identificacion: fila.identificacion || existente.identificacion,
          email: fila.email || existente.email,
        },
      })
      actualizados++
    } else {
      await prisma.colaborador.create({
        data: {
          empresa_id: empresaId,
          nombre: fila.nombre,
          apellido: fila.apellido,
          celular: fila.celular,
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
