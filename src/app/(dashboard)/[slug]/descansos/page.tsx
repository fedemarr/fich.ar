import { DescansosCliente } from "@/components/descansos/descansos-cliente"

export const metadata = { title: "Descansos" }

export default function DescansosPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <DescansosCliente />
    </div>
  )
}
