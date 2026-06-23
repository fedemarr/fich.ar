"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { CalendarDays } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { JornadaPersonalizadaDialog } from "./jornada-personalizada-dialog"
import type { Colaborador, ColaboradorJornada, Jornada, PuntoFichaje } from "@/generated/prisma/client"

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  apellido: z.string().min(1, "Requerido"),
  celular: z.string().min(10, "Ingresá el celular con código de país (+54...)"),
  identificacion: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  legajo: z.string().optional(),
  sector: z.string().optional(),
  domicilio: z.string().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO", "DESACTIVADO"]),
  jornada_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

type ColaboradorConJornada = Colaborador & {
  jornadas: (ColaboradorJornada & {
    jornada: Jornada & { punto_fichaje: PuntoFichaje }
  })[]
}

type JornadaConPunto = Jornada & { punto_fichaje: PuntoFichaje }

interface ColaboradorDialogProps {
  open: boolean
  onClose: () => void
  colaborador: ColaboradorConJornada | null
  jornadas: JornadaConPunto[]
  empresaId: string
  onSuccess: () => void
}

function diasResumen(j: Jornada): string {
  const dias: Record<string, string> = {
    lunes: "L", martes: "M", miercoles: "Mi", jueves: "J",
    viernes: "V", sabado: "Sa", domingo: "Do"
  }
  const presencial: string[] = []
  const virtual: string[] = []
  for (const [d, abrev] of Object.entries(dias)) {
    const jAny = j as Record<string, unknown>
    if (jAny[`${d}_presencial`]) presencial.push(abrev)
    if (jAny[`${d}_virtual`]) virtual.push(abrev)
  }
  const partes: string[] = []
  if (presencial.length) partes.push(`P: ${presencial.join("-")}`)
  if (virtual.length) partes.push(`V: ${virtual.join("-")}`)
  return partes.join(" · ") || "Sin días"
}

export function ColaboradorDialog({
  open,
  onClose,
  colaborador,
  jornadas,
  onSuccess,
}: ColaboradorDialogProps) {
  const esEdicion = !!colaborador
  const [jornadaPersonalizadaAbierta, setJornadaPersonalizadaAbierta] = useState(false)
  const [jornadaSeleccionadaLabel, setJornadaSeleccionadaLabel] = useState<string | null>(null)

  // Puntos únicos derivados de las jornadas disponibles
  const puntos = Array.from(
    new Map(jornadas.map((j) => [j.punto_fichaje.id, j.punto_fichaje])).values()
  )

  const { register, handleSubmit, setValue, reset, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { estado: "ACTIVO" },
    })

  const jornadaIdActual = watch("jornada_id")

  useEffect(() => {
    setJornadaSeleccionadaLabel(null)
    if (colaborador) {
      reset({
        nombre: colaborador.nombre,
        apellido: colaborador.apellido,
        celular: colaborador.celular,
        identificacion: colaborador.identificacion ?? "",
        email: colaborador.email ?? "",
        legajo: colaborador.legajo ?? "",
        sector: colaborador.sector ?? "",
        domicilio: colaborador.domicilio ?? "",
        estado: colaborador.estado,
        jornada_id: colaborador.jornadas[0]?.jornada_id ?? "",
      })
    } else {
      reset({ estado: "ACTIVO", nombre: "", apellido: "", celular: "", identificacion: "" })
    }
  }, [colaborador, open, reset])

  async function onSubmit(data: FormData) {
    const url = esEdicion ? `/api/colaboradores/${colaborador.id}` : "/api/colaboradores"
    const method = esEdicion ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      toast.error("Error al guardar el colaborador")
      return
    }

    toast.success(esEdicion ? "Colaborador actualizado" : "Colaborador creado")
    onSuccess()
  }

  function handleJornadaPersonalizadaGuardada(jornadaId: string) {
    setValue("jornada_id", jornadaId)
    setJornadaSeleccionadaLabel("Jornada personalizada configurada ✓")
    toast.success("Jornada personalizada lista — guardá el colaborador para aplicarla")
  }

  const nombreCompleto = (() => {
    const n = watch("nombre") ?? colaborador?.nombre ?? ""
    const a = watch("apellido") ?? colaborador?.apellido ?? ""
    return `${a} ${n}`.trim() || "Colaborador"
  })()

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{esEdicion ? "Editar colaborador" : "Nuevo colaborador"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            {/* Datos personales */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input {...register("nombre")} />
                {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Apellido</Label>
                <Input {...register("apellido")} />
                {errors.apellido && <p className="text-xs text-red-500">{errors.apellido.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Celular (con código de país)</Label>
                <Input placeholder="+5491112345678" {...register("celular")} />
                {errors.celular && <p className="text-xs text-red-500">{errors.celular.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>DNI <span className="text-[#2563EB] text-xs font-medium">— para fichar por QR</span></Label>
                <Input placeholder="Sin puntos" inputMode="numeric" {...register("identificacion")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email (opcional)</Label>
                <Input type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Legajo (opcional)</Label>
                <Input {...register("legajo")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sector (opcional)</Label>
                <Input {...register("sector")} />
              </div>
              <div className="space-y-1.5">
                <Label>Domicilio (opcional)</Label>
                <Input {...register("domicilio")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                defaultValue={colaborador?.estado ?? "ACTIVO"}
                onValueChange={(v) => setValue("estado", v as FormData["estado"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="INACTIVO">Inactivo</SelectItem>
                  <SelectItem value="DESACTIVADO">Desactivado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ─── Jornada ───────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label>Jornada asignada</Label>

              {/* Jornada predefinida */}
              <Select
                defaultValue={colaborador?.jornadas[0]?.jornada_id ?? ""}
                onValueChange={(v) => {
                  setValue("jornada_id", v ?? undefined)
                  setJornadaSeleccionadaLabel(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar jornada predefinida..." />
                </SelectTrigger>
                <SelectContent>
                  {jornadas.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      <span className="font-medium">{j.nombre}</span>
                      <span className="text-gray-400 ml-1.5 text-xs">
                        {j.hora_inicio}–{j.hora_fin} · {diasResumen(j)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Separador */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1 h-px bg-gray-200" />
                o
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Botón jornada personalizada */}
              <button
                type="button"
                onClick={() => setJornadaPersonalizadaAbierta(true)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-colors text-sm font-medium ${
                  jornadaSeleccionadaLabel
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                    : "border-gray-200 text-gray-500 hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-[#EFF6FF]"
                }`}
              >
                <CalendarDays size={18} />
                {jornadaSeleccionadaLabel ?? "Configurar jornada personalizada..."}
              </button>

              {/* Jornada actual (modo edición) */}
              {esEdicion && colaborador.jornadas[0] && !jornadaSeleccionadaLabel && !jornadaIdActual && (
                <p className="text-xs text-gray-400">
                  Actual: <span className="font-medium text-gray-600">{colaborador.jornadas[0].jornada.nombre}</span>
                  {" "}— {colaborador.jornadas[0].jornada.punto_fichaje.nombre}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear colaborador"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de jornada personalizada — se abre encima del dialog principal */}
      <JornadaPersonalizadaDialog
        open={jornadaPersonalizadaAbierta}
        onClose={() => setJornadaPersonalizadaAbierta(false)}
        colaboradorNombre={nombreCompleto}
        puntos={puntos}
        onGuardar={handleJornadaPersonalizadaGuardada}
      />
    </>
  )
}
