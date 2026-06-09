import { MapPin } from "lucide-react"

export default function PuntosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MapPin size={20} className="text-[#E8593C]" />
        <h1 className="text-xl font-semibold text-gray-900">Puntos QR</h1>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        Próximamente — Fase 2
      </div>
    </div>
  )
}
