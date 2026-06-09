"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DateRange } from "react-day-picker"

interface SelectorFechaProps {
  fechaInicial: string
  hastaInicial: string | null
}

export function SelectorFecha({ fechaInicial, hastaInicial }: SelectorFechaProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<"unica" | "rango">(hastaInicial ? "rango" : "unica")
  const [fechaUnica, setFechaUnica] = useState<Date>(new Date(fechaInicial + "T12:00:00"))
  const [rango, setRango] = useState<DateRange>({
    from: new Date(fechaInicial + "T12:00:00"),
    to: hastaInicial ? new Date(hastaInicial + "T12:00:00") : undefined,
  })

  function aplicar() {
    const params = new URLSearchParams(searchParams.toString())
    if (modo === "unica") {
      params.set("fecha", fechaUnica.toISOString().split("T")[0])
      params.delete("hasta")
    } else if (rango.from) {
      params.set("fecha", rango.from.toISOString().split("T")[0])
      if (rango.to) params.set("hasta", rango.to.toISOString().split("T")[0])
      else params.delete("hasta")
    }
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  function quitar() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("fecha")
    params.delete("hasta")
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  const label = hastaInicial
    ? `${fechaInicial} — ${hastaInicial}`
    : new Date(fechaInicial + "T12:00:00").toLocaleDateString("es-AR", {
        day: "2-digit", month: "long", year: "numeric",
      })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <CalendarIcon size={14} className="text-gray-400" />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="end">
        <Tabs value={modo} onValueChange={(v) => setModo(v as "unica" | "rango")}>
          <TabsList className="w-full mb-3">
            <TabsTrigger value="unica" className="flex-1">Fecha única</TabsTrigger>
            <TabsTrigger value="rango" className="flex-1">Rango</TabsTrigger>
          </TabsList>
        </Tabs>

        {modo === "unica" ? (
          <Calendar
            mode="single"
            selected={fechaUnica}
            onSelect={(d) => d && setFechaUnica(d)}
          />
        ) : (
          <Calendar
            mode="range"
            selected={rango}
            onSelect={(r) => r && setRango(r)}
          />
        )}

        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={quitar}>
            Quitar
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-[#E8593C] hover:bg-[#D04828] text-white"
            onClick={aplicar}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
