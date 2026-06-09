import { Megaphone } from "lucide-react"

export default function ComunicacionesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone size={20} className="text-[#E8593C]" />
        <h1 className="text-xl font-semibold text-gray-900">Comunicaciones</h1>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        Próximamente — Fase 3
      </div>
    </div>
  )
}
