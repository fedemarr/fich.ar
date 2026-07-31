import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"

export async function GET() {
  const { error } = await verificarAcceso("VER_TODAS_EMPRESAS")
  if (error) return error

  const now = new Date()
  const nowARG = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const mesARG = nowARG.getUTCMonth() + 1
  const anioARG = nowARG.getUTCFullYear()
  const inicioMes = new Date(
    `${anioARG}-${String(mesARG).padStart(2, "0")}-01T03:00:00.000Z`
  )

  const [empresasRaw, fichadasMesRaw, cobrosRaw, erroresWA, auditLogsRaw] = await Promise.all([
    prisma.empresa.findMany({
      where: { deleted_at: null },
      include: {
        _count: {
          select: {
            colaboradores: { where: { estado: "ACTIVO", deleted_at: null } },
          },
        },
      },
      orderBy: { nombre: "asc" },
    }),

    prisma.fichada.groupBy({
      by: ["empresa_id"],
      where: { timestamp: { gte: inicioMes } },
      _count: { _all: true },
    }),

    prisma.cobro.findMany({
      where: { estado: "PENDIENTE" },
      select: { empresa_id: true, monto: true, moneda: true },
    }),

    prisma.webhookWA.findMany({
      where: { error: { not: null } },
      orderBy: { created_at: "desc" },
      take: 20,
      select: {
        id: true,
        from_number: true,
        body: true,
        error: true,
        created_at: true,
        procesado: true,
      },
    }),

    prisma.auditLog.findMany({
      orderBy: { created_at: "desc" },
      take: 300,
      select: {
        id: true,
        empresa_id: true,
        usuario_id: true,
        rol: true,
        accion: true,
        entidad: true,
        entidad_id: true,
        ip: true,
        created_at: true,
      },
    }),
  ])

  // Mapas de stats por empresa
  const fichadasPorEmpresa = new Map(fichadasMesRaw.map((f) => [f.empresa_id, f._count._all]))
  const pendientePorEmpresa = new Map<string, number>()
  for (const c of cobrosRaw) {
    pendientePorEmpresa.set(c.empresa_id, (pendientePorEmpresa.get(c.empresa_id) ?? 0) + c.monto)
  }

  const empresas = empresasRaw.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    slug: e.slug,
    activa: e.activa,
    colaboradores: e._count.colaboradores,
    fichadasMes: fichadasPorEmpresa.get(e.id) ?? 0,
    pendiente: pendientePorEmpresa.get(e.id) ?? 0,
  }))

  // Detección de auditorías sospechosas
  const SENSIBLES = ["ELIMINAR", "DELETE", "RESET", "DESACTIVAR", "IMPORTAR", "PURGE"]

  // Detectar IPs con muchas acciones recientes (últimas 2h)
  const hace2h = new Date(now.getTime() - 2 * 60 * 60 * 1000)
  const ipCount = new Map<string, number>()
  for (const log of auditLogsRaw) {
    if (log.ip && new Date(log.created_at) >= hace2h) {
      ipCount.set(log.ip, (ipCount.get(log.ip) ?? 0) + 1)
    }
  }
  const ipsAltaFrecuencia = new Set([...ipCount.entries()].filter(([, c]) => c >= 15).map(([ip]) => ip))

  const sospechosos = auditLogsRaw
    .map((log) => {
      const motivos: string[] = []
      const ts = new Date(log.created_at)
      const horaARG = (ts.getUTCHours() - 3 + 24) % 24

      if (horaARG >= 23 || horaARG < 6) {
        const hh = String(horaARG).padStart(2, "0")
        const mm = String(ts.getUTCMinutes()).padStart(2, "0")
        motivos.push(`Fuera de horario (${hh}:${mm} ARG)`)
      }

      if (SENSIBLES.some((a) => log.accion.toUpperCase().includes(a))) {
        motivos.push(`Acción sensible: ${log.accion}`)
      }

      if (log.ip && ipsAltaFrecuencia.has(log.ip)) {
        motivos.push(`IP con alta frecuencia (${ipCount.get(log.ip)} acciones/2h)`)
      }

      return motivos.length > 0 ? { ...log, motivos, created_at: log.created_at.toISOString() } : null
    })
    .filter(Boolean)
    .slice(0, 40)

  const totalColaboradores = empresas.reduce((s, e) => s + e.colaboradores, 0)
  const totalFichadasMes = empresas.reduce((s, e) => s + e.fichadasMes, 0)
  const totalPendiente = cobrosRaw.reduce((s, c) => s + c.monto, 0)

  return NextResponse.json({
    kpis: {
      empresas: empresasRaw.length,
      colaboradores: totalColaboradores,
      fichadasMes: totalFichadasMes,
      pendiente: totalPendiente,
      mes: mesARG,
      anio: anioARG,
    },
    empresas,
    erroresWA: erroresWA.map((e) => ({ ...e, created_at: e.created_at.toISOString() })),
    sospechosos,
  })
}
