import { z } from "zod"

export const MAX_FOTOS_SUPERVISION = 6

interface OpcionChecklist {
  valor: string
  label: string
  ok: boolean
}

interface ItemChecklist {
  key: "limpieza" | "insumos" | "personal" | "epp" | "maquinas"
  titulo: string
  opciones: OpcionChecklist[]
}

export const ITEMS_SUPERVISION: ItemChecklist[] = [
  {
    key: "limpieza",
    titulo: "Rutina de limpieza",
    opciones: [
      { valor: "completa", label: "Completa", ok: true },
      { valor: "incompleta_con_detalles", label: "Incompleta con detalles", ok: false },
      { valor: "incompleta_sin_detalles", label: "Incompleta sin detalles", ok: false },
    ],
  },
  {
    key: "insumos",
    titulo: "Materiales e insumos",
    opciones: [
      { valor: "suficientes", label: "Suficientes", ok: true },
      { valor: "insuficientes", label: "Insuficientes", ok: false },
      { valor: "realizar_pedido", label: "Realizar pedido", ok: false },
    ],
  },
  {
    key: "personal",
    titulo: "Personal",
    opciones: [
      { valor: "completo", label: "Completo", ok: true },
      { valor: "ausente_con_aviso", label: "Ausente con aviso", ok: false },
      { valor: "ausente_sin_aviso", label: "Ausente sin aviso", ok: false },
    ],
  },
  {
    key: "epp",
    titulo: "EPP (elementos de protección personal)",
    opciones: [
      { valor: "completo", label: "Completo y en uso", ok: true },
      { valor: "con_novedades", label: "Faltante / no lo usa", ok: false },
    ],
  },
  {
    key: "maquinas",
    titulo: "Máquinas",
    opciones: [
      { valor: "en_condiciones", label: "En condiciones", ok: true },
      { valor: "con_novedades", label: "Con novedades", ok: false },
    ],
  },
]

export const SATISFACCION_LABELS: Record<number, string> = {
  0: "Muy insatisfecho",
  1: "Poco satisfecho",
  2: "Algo satisfecho",
  3: "Inconforme con detalles",
  4: "Conforme",
  5: "Muy conforme",
}

export type ChecklistV2 = {
  version: 2
  limpieza: string
  insumos: string
  personal: string
  epp: string
  maquinas: string
  satisfaccion: number | null
}

function enumDe(key: ItemChecklist["key"]) {
  const valores = ITEMS_SUPERVISION.find((i) => i.key === key)!.opciones.map((o) => o.valor)
  return z.enum(valores as [string, ...string[]])
}

export const checklistV2Schema = z.object({
  version: z.literal(2),
  limpieza: enumDe("limpieza"),
  insumos: enumDe("insumos"),
  personal: enumDe("personal"),
  epp: enumDe("epp"),
  maquinas: enumDe("maquinas"),
  satisfaccion: z.number().int().min(0).max(5).nullable(),
})

// Rondas anteriores al checklist ampliado (PWA cacheada o datos ya guardados)
export const checklistV1Schema = z.object({
  limpieza: z.boolean(),
  insumos: z.boolean(),
  personal: z.boolean(),
})

export interface ItemMostrable {
  titulo: string
  valor: string
  ok: boolean
}

// Convierte cualquier versión guardada en filas para mostrar en el historial
export function checklistParaMostrar(raw: unknown): { items: ItemMostrable[]; satisfaccion: number | null } {
  const v2 = checklistV2Schema.safeParse(raw)
  if (v2.success) {
    const items = ITEMS_SUPERVISION.map((item) => {
      const op = item.opciones.find((o) => o.valor === v2.data[item.key])
      return { titulo: item.titulo, valor: op?.label ?? "—", ok: op?.ok ?? false }
    })
    return { items, satisfaccion: v2.data.satisfaccion }
  }
  const v1 = checklistV1Schema.safeParse(raw)
  if (v1.success) {
    return {
      items: [
        { titulo: "Limpieza", valor: v1.data.limpieza ? "Completa" : "Incompleta", ok: v1.data.limpieza },
        { titulo: "Insumos", valor: v1.data.insumos ? "Suficientes" : "Insuficientes", ok: v1.data.insumos },
        { titulo: "Personal", valor: v1.data.personal ? "Completo" : "Incompleto", ok: v1.data.personal },
      ],
      satisfaccion: null,
    }
  }
  return { items: [], satisfaccion: null }
}

export function hayNovedad(c: Omit<ChecklistV2, "version">): boolean {
  const algunoMal = ITEMS_SUPERVISION.some((item) => {
    const op = item.opciones.find((o) => o.valor === c[item.key])
    return op ? !op.ok : false
  })
  return algunoMal || (c.satisfaccion !== null && c.satisfaccion <= 3)
}
