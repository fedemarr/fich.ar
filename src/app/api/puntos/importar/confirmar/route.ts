import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface PuntoImport {
  nombre: string
  latitud: number
  longitud: number
  radio_metros: number
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "No auth" }, { status: 401 })

  const { puntos }: { puntos: PuntoImport[] } = await req.json()
  if (!Array.isArray(puntos) || puntos.length === 0) {
    return Response.json({ error: "Sin datos" }, { status: 400 })
  }

  const empresaId = session.user.empresaId
  const creados: string[] = []
  const actualizados: string[] = []

  for (const p of puntos) {
    const existing = await prisma.puntoFichaje.findFirst({
      where: { empresa_id: empresaId, nombre: p.nombre },
    })

    if (existing) {
      await prisma.puntoFichaje.update({
        where: { id: existing.id },
        data: {
          latitud: p.latitud,
          longitud: p.longitud,
          radio_metros: p.radio_metros,
          activo: true,
        },
      })
      actualizados.push(p.nombre)
    } else {
      await prisma.puntoFichaje.create({
        data: {
          empresa_id: empresaId,
          nombre: p.nombre,
          latitud: p.latitud,
          longitud: p.longitud,
          radio_metros: p.radio_metros,
        },
      })
      creados.push(p.nombre)
    }
  }

  return Response.json({ creados: creados.length, actualizados: actualizados.length, nombresCreados: creados, nombresActualizados: actualizados })
}
