import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verificarAcceso } from "@/lib/auth-helpers"
import {
  armarDictados,
  cargarClases,
  fichadasDeClases,
  nombresDeProfes,
  programadasEnFecha,
  yaEmpezo,
} from "@/lib/clases"
import { fechaARG, finDiaARG, hoyARG, inicioDiaARG } from "@/lib/utils"

interface LiquidacionProfe {
  colaborador_id: string
  profe: string
  dictadas: number
  como_reemplazo: number
  tarde: number
  minutos: number
  reemplazado: number
  no_dictadas: number
}

// GET ?mes=YYYY-MM — clases dictadas por profe en el mes (hasta hoy)
export async function GET(req: Request) {
  const { error, session } = await verificarAcceso("VER_FICHADAS")
  if (error) return error
  const empresaId = session.user.empresaId

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { fichaje_por_clase: true } })
  if (!empresa?.fichaje_por_clase) {
    return NextResponse.json({ error: "Esta empresa no ficha por clase" }, { status: 403 })
  }

  const hoy = hoyARG()
  const mes = new URL(req.url).searchParams.get("mes") ?? hoy.slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: "Mes inválido" }, { status: 400 })
  }

  const [anio, nroMes] = mes.split("-").map(Number)
  const diasDelMes = new Date(Date.UTC(anio, nroMes, 0)).getUTCDate()
  const fechas = Array.from({ length: diasDelMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)
    .filter((f) => f <= hoy)

  if (fechas.length === 0) return NextResponse.json({ mes, profes: [] })

  const filtro = session.user.rol === "SUPERVISOR" ? { puntosIds: session.user.puntosIds } : undefined
  const clases = await cargarClases(empresaId, filtro)
  const nombres = nombresDeProfes(clases)
  const fichadas = await fichadasDeClases(
    empresaId,
    inicioDiaARG(fechas[0]),
    finDiaARG(fechas[fechas.length - 1]),
    clases.map((c) => c.id)
  )

  const porProfe = new Map<string, LiquidacionProfe>()
  function profe(id: string, nombre: string): LiquidacionProfe {
    let p = porProfe.get(id)
    if (!p) {
      p = { colaborador_id: id, profe: nombre, dictadas: 0, como_reemplazo: 0, tarde: 0, minutos: 0, reemplazado: 0, no_dictadas: 0 }
      porProfe.set(id, p)
    }
    return p
  }

  const ahora = new Date()
  for (const fecha of fechas) {
    const delDia = fichadas.filter((f) => fechaARG(f.timestamp) === fecha)
    for (const clase of programadasEnFecha(clases, fecha)) {
      const { dictados } = armarDictados(delDia, clase.id, nombres)
      for (const d of dictados) {
        const p = profe(d.colaborador_id, d.profe)
        p.dictadas++
        p.minutos += d.minutos ?? 0
        if (d.tarde) p.tarde++
        if (d.reemplazo_de) p.como_reemplazo++
      }
      // Titulares que no dieron su clase: la cubrió otro, o nadie la dio
      const dieron = new Set(dictados.map((d) => d.colaborador_id))
      for (const t of clase.titulares) {
        if (dieron.has(t.id)) continue
        const p = profe(t.id, `${t.apellido} ${t.nombre}`)
        if (dictados.length > 0) p.reemplazado++
        else if (yaEmpezo(clase, fecha, ahora)) p.no_dictadas++
      }
    }
  }

  const profes = [...porProfe.values()].sort((a, b) => a.profe.localeCompare(b.profe, "es"))
  return NextResponse.json({ mes, profes })
}
