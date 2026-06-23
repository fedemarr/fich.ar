"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Monitor, Minus } from "lucide-react"
import type { PuntoFichaje } from "@/generated/prisma/client"

type DiaKey = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo"
type DiaValor = "libre" | "presencial" | "virtual"

const DIAS_PRINCIPALES: { key: DiaKey; label: string; abrev: string }[] = [
  { key: "lunes",     label: "Lunes",     abrev: "LUN" },
  { key: "martes",    label: "Martes",    abrev: "MAR" },
  { key: "miercoles", label: "Miércoles", abrev: "MIÉ" },
  { key: "jueves",    label: "Jueves",    abrev: "JUE" },
  { key: "viernes",   label: "Viernes",   abrev: "VIE" },
]

const DIAS_FIN: { key: DiaKey; label: string; abrev: string }[] = [
  { key: "sabado",  label: "Sábado",  abrev: "SÁB" },
  { key: "domingo", label: "Domingo", abrev: "DOM" },
]

const defaultDias: Record<DiaKey, DiaValor> = {
  lunes:     "presencial",
  martes:    "presencial",
  miercoles: "presencial",
  jueves:    "presencial",
  viernes:   "presencial",
  sabado:    "libre",
  domingo:   "libre",
}

function siguienteEstado(actual: DiaValor): DiaValor {
  if (actual === "libre")      return "presencial"
  if (actual === "presencial") return "virtual"
  return "libre"
}

const ESTADO_CONFIG: Record<DiaValor, {
  label: string
  bg: string
  border: string
  text: string
  icon: React.ReactNode
}> = {
  libre: {
    label: "Libre",
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-400",
    icon: <Minus size={20} strokeWidth={1.5} />,
  },
  presencial: {
    label: "Presencial",
    bg: "bg-[#EFF6FF]",
    border: "border-[#2563EB]",
    text: "text-[#2563EB]",
    icon: <Building2 size={20} strokeWidth={1.5} />,
  },
  virtual: {
    label: "Virtual",
    bg: "bg-purple-50",
    border: "border-purple-400",
    text: "text-purple-500",
    icon: <Monitor size={20} strokeWidth={1.5} />,
  },
}

interface Props {
  open: boolean
  onClose: () => void
  colaboradorNombre: string
  puntos: PuntoFichaje[]
  onGuardar: (jornadaId: string) => void
}

export function JornadaPersonalizadaDialog({ open, onClose, colaboradorNombre, puntos, onGuardar }: Props) {
  const [dias, setDias] = useState<Record<DiaKey, DiaValor>>({ ...defaultDias })
  const [puntoId, setPuntoId] = useState(puntos[0]?.id ?? "")
  const [horaInicio, setHoraInicio] = useState("09:00")
  const [horaFin, setHoraFin] = useState("17:00")
  const [tolerancia, setTolerancia] = useState("15")
  const [guardando, setGuardando] = useState(false)

  function toggleDia(dia: DiaKey) {
    setDias((prev) => ({ ...prev, [dia]: siguienteEstado(prev[dia]) }))
  }

  async function guardar() {
    if (!puntoId) {
      toast.error("Seleccioná un punto de fichaje")
      return
    }
    setGuardando(true)
    try {
      const payload = {
        punto_fichaje_id: puntoId,
        nombre: `Personalizada — ${colaboradorNombre}`,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        tolerancia_min: parseInt(tolerancia) || 15,
        lunes_presencial:     dias.lunes === "presencial",
        martes_presencial:    dias.martes === "presencial",
        miercoles_presencial: dias.miercoles === "presencial",
        jueves_presencial:    dias.jueves === "presencial",
        viernes_presencial:   dias.viernes === "presencial",
        sabado_presencial:    dias.sabado === "presencial",
        domingo_presencial:   dias.domingo === "presencial",
        lunes_virtual:        dias.lunes === "virtual",
        martes_virtual:       dias.martes === "virtual",
        miercoles_virtual:    dias.miercoles === "virtual",
        jueves_virtual:       dias.jueves === "virtual",
        viernes_virtual:      dias.viernes === "virtual",
        sabado_virtual:       dias.sabado === "virtual",
        domingo_virtual:      dias.domingo === "virtual",
      }
      const res = await fetch("/api/puntos/jornadas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        toast.error("Error al crear la jornada")
        return
      }
      const data = await res.json() as { id: string }
      onGuardar(data.id)
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  function DiaCard({ dia }: { dia: { key: DiaKey; label: string; abrev: string } }) {
    const estado = dias[dia.key]
    const cfg = ESTADO_CONFIG[estado]
    return (
      <button
        type="button"
        onClick={() => toggleDia(dia.key)}
        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all select-none w-full ${cfg.bg} ${cfg.border} hover:opacity-80 active:scale-95`}
      >
        <span className="text-[11px] font-bold text-gray-500 tracking-wider">{dia.abrev}</span>
        <span className={cfg.text}>{cfg.icon}</span>
        <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Jornada personalizada</DialogTitle>
          <p className="text-sm text-gray-500 mt-0.5">{colaboradorNombre}</p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Punto */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Punto de fichaje</Label>
            <Select value={puntoId} onValueChange={(v) => { if (v) setPuntoId(v) }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar punto" />
              </SelectTrigger>
              <SelectContent>
                {puntos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horario */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Horario</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-gray-400">Entrada</span>
                <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400">Salida</span>
                <Input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400">Tolerancia (min)</span>
                <Input type="number" min={0} max={60} value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Semana — Lunes a Viernes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Semana</Label>
              <span className="text-[11px] text-gray-400">Tocá cada día para cambiar</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {DIAS_PRINCIPALES.map((d) => <DiaCard key={d.key} dia={d} />)}
            </div>
          </div>

          {/* Fin de semana */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Fin de semana</Label>
            <div className="grid grid-cols-2 gap-2">
              {DIAS_FIN.map((d) => <DiaCard key={d.key} dia={d} />)}
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
            <span className="flex items-center gap-1.5 text-[#2563EB]">
              <Building2 size={12} /> Presencial
            </span>
            <span className="flex items-center gap-1.5 text-purple-500">
              <Monitor size={12} /> Virtual
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <Minus size={12} /> Libre
            </span>
            <span className="ml-auto text-gray-300">Tocá para cambiar el estado</span>
          </div>

          {/* Acciones */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              onClick={guardar}
              disabled={guardando}
            >
              {guardando ? "Guardando..." : "Guardar jornada"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
