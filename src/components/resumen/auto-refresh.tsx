"use client"

import { useEffect, useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export function AutoRefresh({ intervalSeconds = 30 }: { intervalSeconds?: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const refresh = useCallback(() => {
    setLoading(true)
    router.refresh()
    setLastUpdate(new Date())
    setTimeout(() => setLoading(false), 800)
  }, [router])

  useEffect(() => {
    const id = setInterval(refresh, intervalSeconds * 1000)
    return () => clearInterval(id)
  }, [refresh, intervalSeconds])

  const minutos = Math.floor((Date.now() - lastUpdate.getTime()) / 60000)
  const label = minutos === 0 ? "ahora" : `hace ${minutos}m`

  return (
    <button
      onClick={refresh}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      title="Actualizar datos"
    >
      <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
      <span>Actualizado {label}</span>
    </button>
  )
}
