import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { LayoutDashboard } from "lucide-react"
import { GraficoFichadas } from "@/components/resumen/grafico-fichadas"
import type { DatoGrafico } from "@/types"

export default async function ResumenPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { slug } = await params

  const empresa = await prisma.empresa.findUnique({
    where: { slug },
    select: { id: true, nombre: true },
  })
  if (!empresa) redirect("/login")

  const hoy = new Date()
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const finDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000)

  const [totalColaboradores, fichadasHoy] = await Promise.all([
    prisma.colaborador.count({
      where: { empresa_id: empresa.id, estado: "ACTIVO", deleted_at: null },
    }),
    prisma.fichada.findMany({
      where: {
        empresa_id: empresa.id,
        timestamp: { gte: inicioDia, lt: finDia },
        es_valida: true,
      },
      include: { colaborador: { select: { id: true, nombre: true, apellido: true } } },
      orderBy: { timestamp: "asc" },
    }),
  ])

  const ingresos = fichadasHoy.filter((f) => f.tipo === "ENTRADA").length
  const salidas = fichadasHoy.filter((f) => f.tipo === "SALIDA").length
  const presentes = new Set(
    fichadasHoy.filter((f) => f.tipo === "ENTRADA").map((f) => f.colaborador_id)
  ).size

  // Build hourly chart data (7am to 8pm)
  const horasRange = Array.from({ length: 14 }, (_, i) => i + 7) // 7 to 20
  const conteoHoras: Record<number, { ingresos: number; salidas: number }> = {}
  for (const h of horasRange) conteoHoras[h] = { ingresos: 0, salidas: 0 }

  for (const f of fichadasHoy) {
    const hora = new Date(f.timestamp).getHours()
    if (hora >= 7 && hora <= 20) {
      if (f.tipo === "ENTRADA") conteoHoras[hora].ingresos++
      else conteoHoras[hora].salidas++
    }
  }

  const datosGrafico: DatoGrafico[] = horasRange.map((h) => ({
    hora: String(h).padStart(2, "0"),
    ingresos: conteoHoras[h].ingresos,
    salidas: conteoHoras[h].salidas,
  }))

  const fechaFormateada = hoy.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard size={20} className="text-[#2563EB]" />
        <h1 className="text-xl font-semibold text-gray-900">Resumen del día</h1>
        <span className="text-sm text-gray-500 ml-2 capitalize">{fechaFormateada}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Colaboradores" value={totalColaboradores} variant="neutral" />
        <KpiCard label="Presentes" value={presentes} variant="coral" />
        <KpiCard label="Ingresos" value={ingresos} variant="coral" />
        <KpiCard label="Salidas" value={salidas} variant="dark" />
      </div>

      {/* Gráfico */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">
          Comportamiento de fichadas
        </h2>
        <p className="text-xs text-gray-400 mb-4">Entradas y salidas por hora del día</p>
        <GraficoFichadas datos={datosGrafico} />
      </div>

      {/* Últimas fichadas */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Últimas fichadas de hoy
        </h2>
        {fichadasHoy.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Sin fichadas registradas hoy
          </p>
        ) : (
          <div className="space-y-2">
            {fichadasHoy.slice(-10).reverse().map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      f.tipo === "ENTRADA"
                        ? "bg-green-50 text-green-700"
                        : "bg-orange-50 text-orange-700"
                    }`}
                  >
                    {f.tipo === "ENTRADA" ? "↑ Entrada" : "↓ Salida"}
                  </span>
                  <span className="text-sm text-gray-800">
                    {f.colaborador.nombre} {f.colaborador.apellido}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(f.timestamp).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: "neutral" | "coral" | "dark"
}) {
  const styles = {
    neutral: "bg-white border border-dashed border-gray-300",
    coral: "bg-[#2563EB] text-white",
    dark: "bg-[#1D4ED8] text-white",
  }
  const textStyles = { neutral: "text-gray-900", coral: "text-white", dark: "text-white" }
  const labelStyles = {
    neutral: "text-gray-500",
    coral: "text-blue-100",
    dark: "text-blue-100",
  }

  return (
    <div className={`rounded-xl p-5 ${styles[variant]}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${labelStyles[variant]}`}>
        {label}
      </p>
      <p className={`text-3xl font-bold mt-1 ${textStyles[variant]}`}>{value}</p>
    </div>
  )
}
