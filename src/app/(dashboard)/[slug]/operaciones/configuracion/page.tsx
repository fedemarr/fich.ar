import { OperacionesConfig } from "@/components/operaciones/operaciones-config"

export const metadata = { title: "Configurar Operaciones" }

export default function OperacionesConfigPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <OperacionesConfig />
    </div>
  )
}
