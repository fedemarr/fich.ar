"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react"

interface SectorInfo {
  nombre: string
  sede: string
  estado?: "PENDIENTE" | "LISTO"
}

interface ColaboradorLocal {
  id: string
  nombre: string
  apellido: string
}

export default function SectorPage() {
  const { token } = useParams<{ token: string }>()
  const [sector, setSector] = useState<SectorInfo | null>(null)
  const [colaborador, setColaborador] = useState<ColaboradorLocal | null>(null)
  const [dni, setDni] = useState("")
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; mensaje: string; estado?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cargar colaborador guardado
  useEffect(() => {
    try {
      const guardado = localStorage.getItem("fichar_colaborador_id")
      const guardadoNombre = localStorage.getItem("fichar_colaborador_nombre")
      const guardadoApellido = localStorage.getItem("fichar_colaborador_apellido")
      if (guardado && guardadoNombre) {
        setColaborador({ id: guardado, nombre: guardadoNombre, apellido: guardadoApellido ?? "" })
      }
    } catch {}
    setCargando(false)
  }, [])

  async function identificarYMarcar(colaborador_id?: string) {
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch("/api/operaciones/rutina/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_sector_token: token,
          colaborador_id: colaborador_id ?? colaborador?.id,
        }),
      })
      const data: { ok?: boolean; mensaje?: string; estado?: string; sector?: SectorInfo; error?: string } = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error al registrar")
        return
      }
      setResultado({ ok: true, mensaje: data.mensaje ?? "¡Listo!", estado: data.estado })
      if (data.sector) setSector(data.sector)
    } catch {
      setError("Error de conexión")
    } finally {
      setEnviando(false)
    }
  }

  async function ingresarDni() {
    if (!dni.trim()) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch("/api/operaciones/rutina/identificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_sector_token: token, dni: dni.trim() }),
      })
      const data: { colaborador?: ColaboradorLocal; error?: string } = await res.json()
      if (!res.ok || !data.colaborador) {
        setError(data.error ?? "DNI no encontrado")
        setEnviando(false)
        return
      }
      const c = data.colaborador
      setColaborador(c)
      try {
        localStorage.setItem("fichar_colaborador_id", c.id)
        localStorage.setItem("fichar_colaborador_nombre", c.nombre)
        localStorage.setItem("fichar_colaborador_apellido", c.apellido)
      } catch {}
      await identificarYMarcar(c.id)
    } catch {
      setError("Error de conexión")
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm text-center space-y-6">

        {/* Header */}
        <div>
          <p className="text-xs text-gray-400 mb-1">powered by <strong>Fich.ar</strong></p>
          {sector && (
            <p className="text-sm text-gray-600 font-medium">
              📍 {sector.nombre}
              {sector.sede && <span className="text-gray-400"> · {sector.sede}</span>}
            </p>
          )}
        </div>

        {/* Resultado */}
        {resultado ? (
          <div className="space-y-3">
            {resultado.estado === "LISTO" ? (
              <CheckCircle2 size={64} className="mx-auto text-green-500" />
            ) : (
              <Clock size={64} className="mx-auto text-amber-500" />
            )}
            <p className="text-lg font-semibold text-gray-800">{resultado.mensaje}</p>
            {colaborador && (
              <p className="text-sm text-gray-500">{colaborador.nombre} {colaborador.apellido}</p>
            )}
          </div>
        ) : colaborador ? (
          /* Ya identificado — mostrar botón marcar listo */
          <div className="space-y-4">
            <div className="text-left bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Asociado</p>
              <p className="font-medium text-gray-800">{colaborador.nombre} {colaborador.apellido}</p>
            </div>
            <button
              onClick={() => identificarYMarcar()}
              disabled={enviando}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-xl text-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {enviando ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
              Sector listo ✓
            </button>
            <button
              onClick={() => { setColaborador(null); try { localStorage.removeItem("fichar_colaborador_id") } catch {} }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              No soy yo
            </button>
          </div>
        ) : (
          /* Sin identificar — pedir DNI */
          <div className="space-y-4">
            <div>
              <p className="text-xl font-bold text-gray-800">Ingresá tu DNI</p>
              <p className="text-sm text-gray-400 mt-1">Para registrar el sector como listo</p>
            </div>
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Número de DNI"
              className="w-full text-center text-2xl font-bold border-2 border-gray-200 rounded-xl py-4 focus:outline-none focus:border-emerald-500"
              onKeyDown={(e) => e.key === "Enter" && ingresarDni()}
              autoFocus
            />
            <button
              onClick={ingresarDni}
              disabled={!dni.trim() || enviando}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-xl text-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {enviando ? <Loader2 size={20} className="animate-spin" /> : "Continuar →"}
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl p-3">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
