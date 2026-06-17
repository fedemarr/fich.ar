import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NovedadesCliente } from "@/components/novedades/novedades-cliente"
import type { TipoNovedad, Colaborador } from "@/generated/prisma/client"

export interface InasistenciaDetectada {
  colaborador: Colaborador
  fecha: string
  novedadId: string | null
  novedadTipo: TipoNovedad | null
  aprobada: boolean
}

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

  const hoy = new Date()
  const mesActual = sp.mes ? parseInt(sp.mes) : hoy.getMonth() + 1
  const anioActual = sp.anio ? parseInt(sp.anio) : hoy.getFullYear()

  const empresaId = session.user.empresaId

  // Last 14 calendar days (covers ~10 weekdays)
  const hace14Dias = new Date()
  hace14Dias.setDate(hace14Dias.getDate() - 14)
  hace14Dias.setHours(0, 0, 0, 0)

  // Calendar month range for Reporte tab
  const desdeCalendario = new Date(anioActual, mesActual - 1, 1)
  const hastaCalendario = new Date(anioActual, mesActual, 0, 23, 59, 59)

  const [colaboradores, fichadasRecientes, novedadesRecientes, novedadesMes, fichadasMesRaw] = await Promise.all([
    prisma.colaborador.findMany({
      where: { empresa_id: empresaId, deleted_at: null, estado: "ACTIVO" },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    }),
    prisma.fichada.findMany({
      where: {
        empresa_id: empresaId,
        tipo: "ENTRADA",
        timestamp: { gte: hace14Dias },
      },
      select: { colaborador_id: true, timestamp: true },
    }),
    prisma.novedad.findMany({
      where: { empresa_id: empresaId, fecha: { gte: hace14Dias } },
    }),
    prisma.novedad.findMany({
      where: {
        empresa_id: empresaId,
        fecha: { gte: desdeCalendario, lte: hastaCalendario },
      },
      include: { colaborador: true },
      orderBy: { fecha: "asc" },
    }),
    prisma.fichada.findMany({
      where: {
        empresa_id: empresaId,
        tipo: "ENTRADA",
        timestamp: { gte: desdeCalendario, lte: hastaCalendario },
        es_valida: true,
      },
      select: { colaborador_id: true, timestamp: true },
    }),
  ])

  // Build presence set: "colaborador_id|YYYY-MM-DD"
  const presencias = new Set<string>()
  for (const f of fichadasRecientes) {
    const fecha = f.timestamp.toISOString().split("T")[0]
    presencias.add(`${f.colaborador_id}|${fecha}`)
  }

  // Build novedad map: "colaborador_id|YYYY-MM-DD"
  const novedadesMap = new Map<string, { id: string; tipo: TipoNovedad; aprobada: boolean }>()
  for (const n of novedadesRecientes) {
    const fecha = new Date(n.fecha).toISOString().split("T")[0]
    novedadesMap.set(`${n.colaborador_id}|${fecha}`, {
      id: n.id,
      tipo: n.tipo,
      aprobada: n.aprobada,
    })
  }

  // Compute inasistencias for last 14 weekdays
  const inasistencias: InasistenciaDetectada[] = []
  for (let i = 1; i <= 14; i++) {
    const dia = new Date()
    dia.setDate(dia.getDate() - i)
    dia.setHours(0, 0, 0, 0)
    const dow = dia.getDay()
    if (dow === 0 || dow === 6) continue // skip weekends

    const fechaStr = dia.toISOString().split("T")[0]

    for (const colab of colaboradores) {
      const key = `${colab.id}|${fechaStr}`
      if (!presencias.has(key)) {
        const novedad = novedadesMap.get(key)
        inasistencias.push({
          colaborador: colab,
          fecha: fechaStr,
          novedadId: novedad?.id ?? null,
          novedadTipo: novedad?.tipo ?? null,
          aprobada: novedad?.aprobada ?? false,
        })
      }
    }
  }

  // Sort: date desc, then name asc
  inasistencias.sort((a, b) => {
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
    return a.colaborador.apellido.localeCompare(b.colaborador.apellido)
  })

  // Set "colaborador_id|dia" para el calendario del mes
  const presenciasMes = new Set<string>()
  for (const f of fichadasMesRaw) {
    const dia = new Date(f.timestamp).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "numeric",
    })
    presenciasMes.add(`${f.colaborador_id}|${dia}`)
  }

  return (
    <NovedadesCliente
      slug={slug}
      colaboradores={colaboradores}
      novedadesMes={novedadesMes}
      inasistencias={inasistencias}
      presenciasMes={presenciasMes}
      tabInicial={tab}
      mesInicial={mesActual}
      anioInicial={anioActual}
    />
  )
}
