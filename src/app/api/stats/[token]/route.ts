import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function inicioRango(periodo: string) {
  const ahora = new Date()
  const tz = "America/Argentina/Buenos_Aires"
  const hoy = new Date(ahora.toLocaleString("en-US", { timeZone: tz }))
  hoy.setHours(0, 0, 0, 0)

  if (periodo === "hoy") return hoy
  if (periodo === "semana") {
    const d = new Date(hoy)
    d.setDate(d.getDate() - 6)
    return d
  }
  // mes
  const d = new Date(hoy)
  d.setDate(1)
  return d
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get("periodo") ?? "mes"

  const empresa = await prisma.empresa.findUnique({
    where: { stats_token: token },
    select: {
      id: true, nombre: true, logo_url: true,
      modulo_operaciones: true, operaciones_v2: true,
    },
  })
  if (!empresa) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const desde = inicioRango(periodo)
  const hasta = new Date()

  // ─── Sedes / puntos ────────────────────────────────────────────────────────
  const puntos = await prisma.puntoFichaje.findMany({
    where: { empresa_id: empresa.id, activo: true },
    select: { id: true, nombre: true, sede_id: true, sede: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  })

  // ─── Colaboradores activos ──────────────────────────────────────────────────
  const totalColaboradores = await prisma.colaborador.count({
    where: { empresa_id: empresa.id, estado: "ACTIVO", deleted_at: null },
  })

  // ─── Fichadas del período ───────────────────────────────────────────────────
  const fichadas = await prisma.fichada.findMany({
    where: {
      empresa_id: empresa.id,
      timestamp: { gte: desde, lte: hasta },
      es_valida: true,
    },
    select: {
      punto_fichaje_id: true, tipo: true, timestamp: true, analisis: true,
    },
  })

  // ─── Novedades (AU = ausencia) del período ──────────────────────────────────
  const novedades = await prisma.novedad.findMany({
    where: {
      empresa_id: empresa.id,
      fecha: { gte: desde, lte: hasta },
      tipo: "AU",
    },
    select: { fecha: true },
  })

  // ─── Stats asistencia por punto ─────────────────────────────────────────────
  const statsPorPunto = puntos.map(p => {
    const fichadasPunto = fichadas.filter(f => f.punto_fichaje_id === p.id)
    const entradas = fichadasPunto.filter(f => f.tipo === "ENTRADA").length
    const tardes = fichadasPunto.filter(f => f.analisis === "LLEGADA_TARDE").length

    return {
      punto_id: p.id,
      punto_nombre: p.nombre,
      sede_nombre: p.sede?.nombre ?? null,
      entradas,
      tardanzas: tardes,
    }
  })

  // ─── Stats operaciones v2 (si aplica) ───────────────────────────────────────
  let statsOperaciones: {
    punto_id: string
    sectores_total: number
    rutinas_completadas: number
    rondas_total: number
    rondas_aprobadas: number
    reclamos_total: number
    reclamos_cerrados: number
  }[] = []

  if (empresa.operaciones_v2) {
    const sedes = await prisma.sede.findMany({
      where: { empresa_id: empresa.id, activo: true },
      select: { id: true, nombre: true },
    })

    statsOperaciones = await Promise.all(
      sedes.map(async sede => {
        const sectores = await prisma.sector.count({
          where: { empresa_id: empresa.id, sede_id: sede.id, activo: true },
        })
        const rutinas = await prisma.rutinaDiaria.count({
          where: {
            empresa_id: empresa.id,
            sector: { sede_id: sede.id },
            estado: "LISTO",
            fecha: { gte: desde, lte: hasta },
          },
        })
        const rondas = await prisma.rondaMuestreo.findMany({
          where: {
            empresa_id: empresa.id,
            sede_id: sede.id,
            fecha: { gte: desde, lte: hasta },
          },
          include: { verificaciones: { select: { resultado_final: true } } },
        })
        const reclamos = await prisma.reclamo.findMany({
          where: {
            empresa_id: empresa.id,
            sector: { sede_id: sede.id },
            hora_aviso: { gte: desde, lte: hasta },
          },
          select: { estado: true },
        })

        const totalVerif = rondas.flatMap(r => r.verificaciones)
        const aprobadas = totalVerif.filter(v => v.resultado_final === "APROBADO").length

        return {
          punto_id: sede.id,
          sectores_total: sectores,
          rutinas_completadas: rutinas,
          rondas_total: rondas.length,
          rondas_aprobadas: aprobadas,
          reclamos_total: reclamos.length,
          reclamos_cerrados: reclamos.filter(r => r.estado === "CERRADO").length,
        }
      })
    )
  }

  // ─── Totales globales ───────────────────────────────────────────────────────
  const totalEntradas = fichadas.filter(f => f.tipo === "ENTRADA").length
  const totalTardanzas = fichadas.filter(f => f.analisis === "LLEGADA_TARDE").length
  const totalAusencias = novedades.length

  // Score asistencia: (entradas / (colaboradores * días hábiles estimados)) * 100
  const diasRango = Math.max(1, Math.ceil((hasta.getTime() - desde.getTime()) / 86400000))
  const esperadas = totalColaboradores * diasRango
  const scoreAsistencia = esperadas > 0 ? Math.round((totalEntradas / esperadas) * 100) : 0

  return NextResponse.json({
    empresa: { nombre: empresa.nombre, logo_url: empresa.logo_url },
    periodo,
    totales: {
      colaboradores: totalColaboradores,
      entradas: totalEntradas,
      tardanzas: totalTardanzas,
      ausencias: totalAusencias,
      score_asistencia: Math.min(scoreAsistencia, 100),
    },
    por_punto: statsPorPunto,
    operaciones: statsOperaciones,
    tiene_operaciones: empresa.operaciones_v2,
  })
}
