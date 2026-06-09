import { Users } from "lucide-react"

export default function ColaboradoresPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-[#E8593C]" />
        <h1 className="text-xl font-semibold text-gray-900">Colaboradores</h1>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        Próximamente — Fase 2
      </div>
    </div>
  )
}
