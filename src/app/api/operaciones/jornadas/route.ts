import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"

// Devuelve las jornadas del sistema y sincroniza Turno records automáticamente
export async function GET() {
  const { error, session } = await verificarAcceso("VER_PUNTOS", "operaciones")
  if (error) return error

  const empresaId = session.user.empresaId

  const jornadas = await prisma.jornada.findMany({
    where: { empresa_id: empresaId, activo: true },
    include: { punto_fichaje: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  })

  // Sincronizar: crear Turno para cada Jornada que no tenga uno con el mismo nombre
  if (jornadas.length > 0) {
    const turnosExistentes = await prisma.turno.findMany({
      where: { empresa_id: empresaId, activo: true },
      select: { nombre: true, hora_inicio: true, hora_fin: true },
    })
    const existentes = new Map(turnosExistentes.map((t) => [t.nombre, t]))

    const nuevos = jornadas.filter((j) => !existentes.has(j.nombre))
    if (nuevos.length > 0) {
      await prisma.turno.createMany({
        data: nuevos.map((j) => ({
          empresa_id: empresaId,
          nombre: j.nombre,
          hora_inicio: j.hora_inicio,
          hora_fin: j.hora_fin,
        })),
        skipDuplicates: true,
      })
    }

    // Actualizar horarios si cambiaron
    for (const j of jornadas) {
      const t = existentes.get(j.nombre)
      if (t && (t.hora_inicio !== j.hora_inicio || t.hora_fin !== j.hora_fin)) {
        await prisma.turno.updateMany({
          where: { empresa_id: empresaId, nombre: j.nombre },
          data: { hora_inicio: j.hora_inicio, hora_fin: j.hora_fin },
        })
      }
    }
  }

  // Devolver turnos (ya sincronizados) con info de jornada para mostrar en la UI
  const turnos = await prisma.turno.findMany({
    where: { empresa_id: empresaId, activo: true },
    orderBy: { nombre: "asc" },
  })

  // Enriquecer con info del punto de la jornada correspondiente
  const jornadasMap = new Map(jornadas.map((j) => [j.nombre, j.punto_fichaje.nombre]))
  const turnosEnriquecidos = turnos.map((t) => ({
    ...t,
    punto_nombre: jornadasMap.get(t.nombre) ?? null,
  }))

  return NextResponse.json({ turnos: turnosEnriquecidos, jornadas })
}
