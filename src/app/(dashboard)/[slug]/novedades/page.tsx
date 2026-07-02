import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NovedadesCliente } from "@/components/novedades/novedades-cliente"
import { hoyARG, fechaARG, inicioDiaARG } from "@/lib/utils"
import type { TipoNovedad, Colaborador } from "@/generated/prisma/client"
import { getColaboradoresSoloActivos } from "@/lib/queries"

export interface InasistenciaDetectada {
  colaborador: Colaborador
  fecha: string
  novedadId: string | null
  novedadTipo: TipoNovedad | null
  aprobada: boolean
  conFichada: boolean   // fichó entrada ese día
}

export type AnalisisDia = { tarde: boolean; anticipada: boolean; salidaTarde?: boolean }

export default async function NovedadesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; mes?: string; anio?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { slug } = await params
  const sp = await searchParams
  const tab = sp.tab ?? "inasistencias"

  const hoyStr = hoyARG()
  const [anioHoy, mesHoy] = hoyStr.split("-").map(Number)
  const mesActual = sp.mes ? parseInt(sp.mes) : mesHoy
  const anioActual = sp.anio ? parseInt(sp.anio) : anioHoy

  const empresaId = session.user.empresaId

  // Últimos 14 días calendario en hora ARG (cubre ~10 días hábiles)
  const hace14Str = (() => {
    const d = new Date(hoyStr + "T12:00:00Z")
    d.setDate(d.getDate() - 14)
    return fechaARG(d)
  })()
  const hace14 = inicioDiaARG(hace14Str)

  // Rango del mes para el calendario — usamos UTC boundaries del mes
  const desdeCalendario = new Date(`${anioActual}-${String(mesActual).padStart(2,"0")}-01T03:00:00.000Z`)
  const diasMes = new Date(anioActual, mesActual, 0).getDate()
  const hastaCalendario = new Date(`${anioActual}-${String(mesActual).padStart(2,"0")}-${String(diasMes).padStart(2,"0")}T02:59:59.999Z`)
  // fin del último día del mes en ARG = siguiente mes día 1 03:00 UTC - 1ms
  const hastaCalendarioReal = new Date(
    `${anioActual}-${String(mesActual).padStart(2,"0")}-${String(diasMes).padStart(2,"0")}T03:00:00.000Z`
  )
  hastaCalendarioReal.setTime(hastaCalendarioReal.getTime() + 24 * 60 * 60 * 1000 - 1)

  const [colaboradores, fichadasRecientes, novedadesRecientes, novedadesMes, fichadasMesRaw] = await Promise.all([
    getColaboradoresSoloActivos(empresaId),
    prisma.fichada.findMany({
      where: {
        empresa_id: empresaId,
        tipo: "ENTRADA",
        timestamp: { gte: hace14 },
      },
      select: { colaborador_id: true, timestamp: true, analisis: true },
    }),
    prisma.novedad.findMany({
      where: { empresa_id: empresaId, fecha: { gte: hace14 } },
      select: { id: true, colaborador_id: true, fecha: true, tipo: true, aprobada: true },
    }),
    prisma.novedad.findMany({
      where: {
        empresa_id: empresaId,
        fecha: { gte: desdeCalendario, lte: hastaCalendarioReal },
      },
      select: {
        id: true, empresa_id: true, colaborador_id: true, fecha: true,
        tipo: true, observacion: true, aprobada: true, created_at: true, updated_at: true,
        colaborador: true,
      },
      orderBy: { fecha: "asc" },
    }),
    // Traemos ENTRADA + SALIDA con analisis para el calendario
    prisma.fichada.findMany({
      where: {
        empresa_id: empresaId,
        timestamp: { gte: desdeCalendario, lte: hastaCalendarioReal },
        es_valida: true,
      },
      select: { colaborador_id: true, timestamp: true, tipo: true, analisis: true },
    }),
  ])

  // Presencias recientes: "colaborador_id|YYYY-MM-DD" en hora ARG
  const presencias = new Set<string>()
  // Tipo sugerido de novedad según análisis de fichada: P si llegó en tiempo, PT si llegó tarde
  const fichadaAnalisis = new Map<string, TipoNovedad>()
  for (const f of fichadasRecientes) {
    const fechaStr = fechaARG(f.timestamp)
    presencias.add(`${f.colaborador_id}|${fechaStr}`)
    fichadaAnalisis.set(
      `${f.colaborador_id}|${fechaStr}`,
      f.analisis === "LLEGADA_TARDE" ? "PT" : "P"
    )
  }

  // Mapa de novedades recientes: "colaborador_id|YYYY-MM-DD"
  const novedadesMap = new Map<string, { id: string; tipo: TipoNovedad; aprobada: boolean }>()
  for (const n of novedadesRecientes) {
    const fechaStr = fechaARG(new Date(n.fecha))
    novedadesMap.set(`${n.colaborador_id}|${fechaStr}`, {
      id: n.id,
      tipo: n.tipo,
      aprobada: n.aprobada,
    })
  }

  // Inasistencias + presencias recientes:
  // - Hoy (i=0) y ayer (i=1): muestra TODOS (para que el admin pueda completar quién vino y quién no)
  // - Días anteriores (i>=2): solo muestra ausentes (sin fichada)
  const inasistencias: InasistenciaDetectada[] = []
  for (let i = 0; i <= 14; i++) {
    const d = new Date(hoyStr + "T12:00:00Z")
    d.setDate(d.getDate() - i)
    const diaStr = fechaARG(d)
    // Día de la semana en ARG
    const dow = new Date(diaStr + "T12:00:00Z").getUTCDay()
    if (dow === 0 || dow === 6) continue

    for (const colab of colaboradores) {
      const key = `${colab.id}|${diaStr}`
      const esPresenteConFichada = presencias.has(key)
      const novedad = novedadesMap.get(key)

      // Para días anteriores a ayer: solo mostrar si no tiene fichada
      if (i >= 2 && esPresenteConFichada) continue

      // Tipo a mostrar: novedad existente → esa; con fichada sin novedad → P o PT según análisis; sin ninguna → null
      let novedadTipo: TipoNovedad | null = novedad?.tipo ?? null
      if (novedadTipo === null && esPresenteConFichada) {
        novedadTipo = fichadaAnalisis.get(key) ?? "P"
      }

      inasistencias.push({
        colaborador: colab,
        fecha: diaStr,
        novedadId: novedad?.id ?? null,
        novedadTipo,
        aprobada: novedad?.aprobada ?? false,
        conFichada: esPresenteConFichada,
      })
    }
  }

  inasistencias.sort((a, b) => {
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
    return a.colaborador.apellido.localeCompare(b.colaborador.apellido)
  })

  // Presencias del mes: "colaborador_id|dia_num" en hora ARG
  const presenciasMes = new Set<string>()
  // Analisis del mes: clave = "colaborador_id|dia_num"
  const analisisMesObj: Record<string, AnalisisDia> = {}

  for (const f of fichadasMesRaw) {
    const fechaStr = fechaARG(f.timestamp)
    const dia = parseInt(fechaStr.split("-")[2])
    const key = `${f.colaborador_id}|${dia}`

    if (f.tipo === "ENTRADA") {
      presenciasMes.add(key)
      if (f.analisis === "LLEGADA_TARDE") {
        analisisMesObj[key] = { ...(analisisMesObj[key] ?? { tarde: false, anticipada: false }), tarde: true }
      }
    } else if (f.tipo === "SALIDA") {
      if (f.analisis === "SALIDA_ANTICIPADA") {
        analisisMesObj[key] = { ...(analisisMesObj[key] ?? { tarde: false, anticipada: false, salidaTarde: false }), anticipada: true }
      } else if (f.analisis === "SALIDA_TARDE") {
        analisisMesObj[key] = { ...(analisisMesObj[key] ?? { tarde: false, anticipada: false, salidaTarde: false }), salidaTarde: true }
      }
    }
  }

  return (
    <NovedadesCliente
      slug={slug}
      colaboradores={colaboradores}
      novedadesMes={novedadesMes}
      inasistencias={inasistencias}
      presenciasMes={presenciasMes}
      analisisMes={analisisMesObj}
      tabInicial={tab}
      mesInicial={mesActual}
      anioInicial={anioActual}
    />
  )
}
