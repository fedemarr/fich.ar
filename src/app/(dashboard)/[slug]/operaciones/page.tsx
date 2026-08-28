import { OperacionesDashboard } from "@/components/operaciones/operaciones-dashboard"

export const metadata = { title: "Operaciones" }

export default function OperacionesPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <OperacionesDashboard />
    </div>
  )
}
