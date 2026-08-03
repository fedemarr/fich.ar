import { OperacionesDashboard } from "@/components/operaciones/operaciones-dashboard"

export const metadata = { title: "Operaciones" }

export default function OperacionesPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <OperacionesDashboard />
    </div>
  )
}
