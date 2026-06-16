import { NextResponse } from "next/server"
import { verificarAcceso } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

const PRINCIPALES = [
  { nombre: "Ohlimpia Oficina",   latitud: -34.5724, longitud: -58.4506, radio_metros: 200 },
  { nombre: "Deposito Logistica", latitud: -34.5838, longitud: -58.4504, radio_metros: 300 },
]

export async function DELETE(_req: Request) {
  const { error, session } = await verificarAcceso("EDITAR_PUNTO")
  if (error) return error

  const empresaId = session.user.empresaId

  // Desactivar todos excepto los principales (case-insensitive)
  const resultado = await prisma.puntoFichaje.updateMany({
    where: {
      empresa_id: empresaId,
      NOT: {
        OR: PRINCIPALES.map((p) => ({
          nombre: { equals: p.nombre, mode: "insensitive" as const },
        })),
      },
    },
    data: { activo: false },
  })

  // Garantizar que los puntos principales existan y estén activos
  for (const p of PRINCIPALES) {
    const existing = await prisma.puntoFichaje.findFirst({
      where: {
        empresa_id: empresaId,
        nombre: { equals: p.nombre, mode: "insensitive" },
      },
    })
    if (existing) {
      await prisma.puntoFichaje.update({
        where: { id: existing.id },
        data: { activo: true, latitud: p.latitud, longitud: p.longitud, radio_metros: p.radio_metros },
      })
    } else {
      await prisma.puntoFichaje.create({
        data: { empresa_id: empresaId, ...p },
      })
    }
  }

  return NextResponse.json({ eliminados: resultado.count })
}
