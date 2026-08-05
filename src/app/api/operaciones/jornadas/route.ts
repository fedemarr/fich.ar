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

  // Sincronizar: crear Turno para cada Jornada que no tenga uno activo con el mismo nombre
  // No re-crear los que fueron borrados manualmente (activo=false)
  if (jornadas.length > 0) {
    const turnosTodos = await prisma.turno.findMany({
      where: { empresa_id: empresaId },
      select: { nombre: true, hora_inicio: true, hora_fin: true, activo: true },
    })
    const activos = new Map(turnosTodos.filter((t) => t.activo).map((t) => [t.nombre, t]))
    const borrados = new Set(turnosTodos.filter((t) => !t.activo).map((t) => t.nombre))

    // Solo crear los que nunca existieron (ni activos ni borrados)
    const nuevos = jornadas.filter((j) => !activos.has(j.nombre) && !borrados.has(j.nombre))
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

    // Actualizar horarios si cambiaron en los activos
    for (const j of jornadas) {
      const t = activos.get(j.nombre)
      if (t && (t.hora_inicio !== j.hora_inicio || t.hora_fin !== j.hora_fin)) {
        await prisma.turno.updateMany({
          where: { empresa_id: empresaId, nombre: j.nombre, activo: true },
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
  const jornadasInfoMap = new Map(jornadas.map((j) => [j.nombre, { nombre: j.punto_fichaje.nombre, id: j.punto_fichaje_id }]))
  const turnosEnriquecidos = turnos.map((t) => ({
    ...t,
    punto_nombre: jornadasInfoMap.get(t.nombre)?.nombre ?? null,
    punto_id: jornadasInfoMap.get(t.nombre)?.id ?? null,
  }))

  return NextResponse.json({ turnos: turnosEnriquecidos, jornadas })
}
