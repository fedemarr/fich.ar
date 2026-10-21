"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

export interface FichadaResumen {
  id: string
  tipo: "ENTRADA" | "SALIDA"
  hora: string
  colaborador: string
  punto: string | null
}

const INICIALES = 10
const PASO = 20

// Recibe las fichadas de más reciente a más vieja
export function UltimasFichadas({ fichadas }: { fichadas: FichadaResumen[] }) {
  const [visibles, setVisibles] = useState(INICIALES)

  if (fichadas.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Sin fichadas registradas hoy</p>
  }

  const mostradas = fichadas.slice(0, visibles)
  const restantes = fichadas.length - mostradas.length

  return (
    <div>
      <div className="space-y-2">
        {mostradas.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                f.tipo === "ENTRADA" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
              }`}>
                {f.tipo === "ENTRADA" ? "↑ Entrada" : "↓ Salida"}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate">{f.colaborador}</p>
                {f.punto && <p className="text-xs text-gray-400 truncate">{f.punto}</p>}
              </div>
            </div>
            <span className="text-xs text-gray-500 shrink-0">{f.hora}</span>
          </div>
        ))}
      </div>

      {(restantes > 0 || visibles > INICIALES) && (
        <div className="flex items-center justify-center gap-4 pt-3 mt-1 border-t border-gray-100">
          {restantes > 0 && (
            <button
              type="button"
              onClick={() => setVisibles((v) => v + PASO)}
              className="flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
            >
              <ChevronDown size={15} />
              Ver más ({restantes})
            </button>
          )}
          {visibles > INICIALES && (
            <button
              type="button"
              onClick={() => setVisibles(INICIALES)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronUp size={15} />
              Ver menos
            </button>
          )}
        </div>
      )}
    </div>
  )
}
