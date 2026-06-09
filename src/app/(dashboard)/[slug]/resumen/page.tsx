import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { LayoutDashboard } from "lucide-react"

interface ResumenPageProps {
  params: Promise<{ slug: string }>
}

export default async function ResumenPage({ params }: ResumenPageProps) {
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
  const presentesIds = new Set(
    fichadasHoy.filter((f) => f.tipo === "ENTRADA").map((f) => f.colaborador_id)
  )
  const presentes = presentesIds.size

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard size={20} className="text-[#E8593C]" />
        <h1 className="text-xl font-semibold text-gray-900">Resumen del día</h1>
        <span className="text-sm text-gray-500 ml-2">
          {hoy.toLocaleDateString("es-AR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Colaboradores"
          value={totalColaboradores}
          variant="neutral"
        />
        <KpiCard label="Presentes" value={presentes} variant="coral" />
        <KpiCard label="Ingresos" value={ingresos} variant="coral" />
        <KpiCard label="Salidas" value={salidas} variant="dark" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-medium text-gray-600 mb-4">
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
    coral: "bg-[#E8593C] text-white",
    dark: "bg-[#D04828] text-white",
  }

  const textStyles = {
    neutral: "text-gray-900",
    coral: "text-white",
    dark: "text-white",
  }

  const labelStyles = {
    neutral: "text-gray-500",
    coral: "text-orange-100",
    dark: "text-orange-100",
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
