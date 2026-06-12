import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/colaboradores/reset
// Elimina (soft-delete) todos los colaboradores de la empresa.
// Pensado para el setup inicial antes del primer import real.
export async function POST(): Promise<Response> {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "No auth" }, { status: 401 })

  const empresaId = session.user.empresaId
  if (!empresaId) return Response.json({ error: "Sin empresa" }, { status: 403 })

  const colaboradores = await prisma.colaborador.findMany({
    where: { empresa_id: empresaId, deleted_at: null },
    select: { id: true },
  })
  const ids = colaboradores.map((c) => c.id)

  if (ids.length === 0) return Response.json({ ok: true, eliminados: 0 })

  // Limpiar todo lo asociado a estos colaboradores (setup inicial)
  await prisma.fichada.deleteMany({ where: { colaborador_id: { in: ids } } })
  await prisma.colaboradorJornada.deleteMany({ where: { colaborador_id: { in: ids } } })
  await prisma.novedad.deleteMany({ where: { colaborador_id: { in: ids } } })
  await prisma.notificacion.deleteMany({ where: { colaborador_id: { in: ids } } })

  await prisma.colaborador.updateMany({
    where: { id: { in: ids } },
    data: { deleted_at: new Date(), estado: "DESACTIVADO" },
  })

  return Response.json({ ok: true, eliminados: ids.length })
}
