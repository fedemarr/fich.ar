import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"

export async function GET() {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)

  // Todos los sectores activos de la empresa
  const sectores = await prisma.sector.findMany({
    where: { empresa_id: session.user.empresaId, activo: true },
    select: {
      id: true,
      nombre: true,
      sede: { select: { nombre: true } },
    },
    orderBy: [{ sede: { nombre: "asc" } }, { nombre: "asc" }],
  })

  // Rutinas de hoy
  const rutinas = await prisma.rutinaDiaria.findMany({
    where: {
      empresa_id: session.user.empresaId,
      fecha: { gte: hoy, lt: manana },
    },
    select: {
      sector_id: true,
      estado: true,
      hora_escaneo: true,
      colaborador: { select: { nombre: true, apellido: true } },
    },
  })

  const rutinaMap = new Map(rutinas.map(r => [r.sector_id, r]))

  const resultado = sectores.map(s => {
    const rutina = rutinaMap.get(s.id)
    return {
      sector_id: s.id,
      sector_nombre: s.nombre,
      sede_nombre: s.sede.nombre,
      estado: rutina?.estado ?? "PENDIENTE",
      colaborador_nombre: rutina?.colaborador
        ? `${rutina.colaborador.nombre} ${rutina.colaborador.apellido}`
        : undefined,
      hora_escaneo: rutina?.hora_escaneo
        ? rutina.hora_escaneo.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })
        : undefined,
    }
  })

  return NextResponse.json({ rutinas: resultado })
}
