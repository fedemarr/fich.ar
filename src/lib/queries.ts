import { unstable_cache, revalidateTag } from "next/cache"
import { prisma } from "./prisma"

// Tags por empresa — usados tanto para cachear como para invalidar
export const tags = {
  colaboradores: (id: string) => `col-${id}`,
  jornadas: (id: string) => `jornadas-${id}`,
  puntos: (id: string) => `puntos-${id}`,
}

// Wrapper necesario porque Next.js 16 requiere segundo argumento en revalidateTag
export function invalidateTag(tag: string) {
  revalidateTag(tag, "default")
}

export function getColaboradoresActivos(empresaId: string) {
  return unstable_cache(
    () =>
      prisma.colaborador.findMany({
        where: { empresa_id: empresaId, deleted_at: null },
        include: {
          jornadas: {
            where: { fecha_hasta: null },
            include: { jornada: { include: { punto_fichaje: true } } },
            take: 1,
          },
        },
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      }),
    [tags.colaboradores(empresaId)],
    { revalidate: 30, tags: [tags.colaboradores(empresaId)] }
  )()
}

export function getJornadas(empresaId: string) {
  return unstable_cache(
    () =>
      prisma.jornada.findMany({
        where: { empresa_id: empresaId, activo: true },
        include: { punto_fichaje: true },
      }),
    [tags.jornadas(empresaId)],
    { revalidate: 60, tags: [tags.jornadas(empresaId)] }
  )()
}

export function getPuntos(empresaId: string) {
  return unstable_cache(
    () =>
      prisma.puntoFichaje.findMany({
        where: { empresa_id: empresaId, activo: true },
        include: {
          jornadas: {
            where: { activo: true },
            include: { colaboradores: { where: { fecha_hasta: null } } },
          },
        },
        orderBy: { created_at: "asc" },
      }),
    [tags.puntos(empresaId)],
    { revalidate: 60, tags: [tags.puntos(empresaId)] }
  )()
}

export function getColaboradoresSoloActivos(empresaId: string) {
  return unstable_cache(
    () =>
      prisma.colaborador.findMany({
        where: { empresa_id: empresaId, deleted_at: null, estado: "ACTIVO" },
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      }),
    [`col-solo-${empresaId}`],
    { revalidate: 30, tags: [tags.colaboradores(empresaId)] }
  )()
}
