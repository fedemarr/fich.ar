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
