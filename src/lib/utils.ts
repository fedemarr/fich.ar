import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normaliza celulares argentinos a +549XXXXXXXXXX
export function normalizarCelular(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return raw
  if (digits.startsWith("549")) return "+" + digits
  if (digits.startsWith("54")) return "+549" + digits.slice(2)
  if (digits.length === 10) return "+549" + digits
  return "+" + digits
}

// Argentina siempre UTC-3, sin horario de verano
const TZ = "America/Argentina/Buenos_Aires"

// Hoy como YYYY-MM-DD en hora ARG
export function hoyARG(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ })
}

// Convierte Date a YYYY-MM-DD en hora ARG
export function fechaARG(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TZ })
}

// Hora numérica (0-23) en ARG a partir de un Date UTC
export function horaARG(date: Date): number {
  return (date.getUTCHours() - 3 + 24) % 24
}

// Inicio del día en UTC para una fecha YYYY-MM-DD en ARG (ARG 00:00 = UTC 03:00)
export function inicioDiaARG(fechaStr: string): Date {
  return new Date(fechaStr + "T03:00:00.000Z")
}

// Fin del día en UTC para una fecha YYYY-MM-DD en ARG (ARG 23:59:59 = UTC next day 02:59:59)
export function finDiaARG(fechaStr: string): Date {
  const d = new Date(fechaStr + "T03:00:00.000Z")
  d.setTime(d.getTime() + 24 * 60 * 60 * 1000 - 1)
  return d
}

// Formatea timestamp como "HH:MM" en hora ARG
export function formatHoraARG(date: Date | string): string {
  return new Date(date).toLocaleTimeString("es-AR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  })
}
