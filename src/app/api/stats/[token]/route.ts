import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const TZ = "America/Argentina/Buenos_Aires"

const DIAS_JORNADA = [
  "domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado",
] as const

/** Fecha "hoy" en horario Argentina, a medianoche local. */
function hoyARG(): Date {
  const ahora = new Date()
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(ahora)
  const anio = Number(partes.find(p => p.type === "year")!.value)
  const mes = Number(partes.find(p => p.type === "month")!.value)
  const dia = Number(partes.find(p => p.type === "day")!.value)
  // Usamos UTC como representación consistente del día calendario
  return new Date(Date.UTC(anio, mes - 1, dia))
}

function rango(periodo: string) {
  const fin = hoyARG()
  fin.setUTCHours(23, 59, 59, 999)

  const inicio = new Date(hoyARG())
  if (periodo === "semana") {
    inicio.setUTCDate(inicio.getUTCDate() - 6)
  } else if (periodo === "mes") {
    inicio.setUTCDate(1)
  }
  inicio.setUTCHours(0, 0, 0, 0)
  return { inicio, fin }
}

/** Días del mes en curso y cuántos transcurrieron (para la barra de avance). */
function avanceMes() {
  const hoy = hoyARG()
  const anio = hoy.getUTCFullYear()
  const mes = hoy.getUTCMonth()
  const total = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const transcurridos = hoy.getUTCDate()
  return {
    dias_mes: total,
    dias_transcurridos: transcurridos,
    porcentaje: Math.round((transcurridos / total) * 100),
  }
}

/** Cuenta cuántos días del rango caen en cada día de la semana. */
function diasPorSemana(inicio: Date, fin: Date): Record<string, number> {
  const conteo: Record<string, number> = {}
  for (const d of DIAS_JORNADA) conteo[d] = 0
  const cursor = new Date(inicio)
  cursor.setUTCHours(0, 0, 0, 0)
  const tope = new Date(fin)
  while (cursor <= tope) {
    conteo[DIAS_JORNADA[cursor.getUTCDay()]] += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return conteo
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get("periodo") ?? "mes"

  const empresa = await prisma.empresa.findUnique({
    where: { stats_token: token },
    select: { id: true, nombre: true, logo_url: true, operaciones_v2: true },
  })
  if (!empresa) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { inicio, fin } = rango(periodo)

  // ─── Asistencia esperada: asignaciones activas × días programados ───────────
  const asignaciones = await prisma.colaboradorJornada.findMany({
    where: {
      fecha_desde: { lte: fin },
      OR: [{ fecha_hasta: null }, { fecha_hasta: { gte: inicio } }],
      colaborador: { empresa_id: empresa.id, estado: "ACTIVO", deleted_at: null },
      jornada: { activo: true },
    },
    select: {
      dias_franco: true,
      jornada: {
        select: {
          lunes_presencial: true, martes_presencial: true, miercoles_presencial: true,
          jueves_presencial: true, viernes_presencial: true, sabado_presencial: true,
          domingo_presencial: true,
          lunes_virtual: true, martes_virtual: true, miercoles_virtual: true,
          jueves_virtual: true, viernes_virtual: true, sabado_virtual: true,
          domingo_virtual: true,
        },
      },
    },
  })

  const diasSemana = diasPorSemana(inicio, fin)
  const diasRango = Math.max(1, Object.values(diasSemana).reduce((a, b) => a + b, 0))

  let asistenciasEsperadas = 0
  for (const a of asignaciones) {
    const j = a.jornada
    for (const d of DIAS_JORNADA) {
      if (a.dias_franco.includes(d)) continue
      const presencial = j[`${d}_presencial` as keyof typeof j]
      const virtual = j[`${d}_virtual` as keyof typeof j]
      if (presencial || virtual) asistenciasEsperadas += diasSemana[d] ?? 0
    }
  }

  const totalColaboradores = await prisma.colaborador.count({
    where: { empresa_id: empresa.id, estado: "ACTIVO", deleted_at: null },
  })

  // ─── Fichadas del período ───────────────────────────────────────────────────
  const fichadas = await prisma.fichada.findMany({
    where: {
      empresa_id: empresa.id,
      timestamp: { gte: inicio, lte: fin },
      es_valida: true,
    },
    select: { tipo: true, analisis: true, punto_fichaje_id: true },
  })

  const entradas = fichadas.filter(f => f.tipo === "ENTRADA").length
  const tardanzas = fichadas.filter(f => f.analisis === "LLEGADA_TARDE").length
  const anticipadas = fichadas.filter(f => f.analisis === "SALIDA_ANTICIPADA").length

  const scoreAsistencia = asistenciasEsperadas > 0
    ? Math.min(100, Math.round((entradas / asistenciasEsperadas) * 100))
    : null

  // ─── Actividades: rutinas de limpieza + rondas de inspección ────────────────
  let pctLimpieza: number | null = null
  let pctRondas: number | null = null
  let actividades: number | null = null

  if (empresa.operaciones_v2) {
    const sedes = await prisma.sede.findMany({
      where: { empresa_id: empresa.id, activo: true },
      select: { id: true },
    })
    const sedeIds = sedes.map(s => s.id)

    const sectoresTotal = await prisma.sector.count({
      where: { empresa_id: empresa.id, sede_id: { in: sedeIds }, activo: true },
    })
    const rutinasListas = await prisma.rutinaDiaria.count({
      where: {
        empresa_id: empresa.id,
        sector: { sede_id: { in: sedeIds } },
        estado: "LISTO",
        fecha: { gte: inicio, lte: fin },
      },
    })
    const rondas = await prisma.rondaMuestreo.findMany({
      where: {
        empresa_id: empresa.id,
        sede_id: { in: sedeIds },
        fecha: { gte: inicio, lte: fin },
      },
      select: { verificaciones: { select: { resultado_final: true } } },
    })
    const verificaciones = rondas.flatMap(r => r.verificaciones)
    const aprobadas = verificaciones.filter(v => v.resultado_final === "APROBADO").length

    const rutinasEsperadas = sectoresTotal * diasRango

    pctLimpieza = rutinasEsperadas > 0
      ? Math.min(100, Math.round((rutinasListas / rutinasEsperadas) * 100))
      : null
    pctRondas = verificaciones.length > 0
      ? Math.round((aprobadas / verificaciones.length) * 100)
      : null

    const componentes = [pctLimpieza, pctRondas].filter((v): v is number => v !== null)
    actividades = componentes.length > 0
      ? Math.round(componentes.reduce((a, b) => a + b, 0) / componentes.length)
      : null
  }

  // Resultado = promedio de los scores disponibles
  const componentes = [scoreAsistencia, actividades].filter((v): v is number => v !== null)
  const combinado = componentes.length > 0
    ? Math.round(componentes.reduce((a, b) => a + b, 0) / componentes.length)
    : null

  return NextResponse.json({
    empresa: { nombre: empresa.nombre, logo_url: empresa.logo_url },
    periodo,
    avance: avanceMes(),
    totales: {
      colaboradores: totalColaboradores,
      entradas,
      esperadas: asistenciasEsperadas,
      tardanzas,
      anticipadas,
      score_asistencia: scoreAsistencia,
    },
    actividades: {
      disponible: empresa.operaciones_v2,
      pct_limpieza: pctLimpieza,
      pct_rondas: pctRondas,
      pct_total: actividades,
    },
    combinado,
  })
}
