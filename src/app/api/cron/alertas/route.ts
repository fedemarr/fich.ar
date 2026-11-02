import { generarAlertasAusencias } from "@/lib/alertas-ausencias"

// Vercel Cron — runs 13:00 UTC = 10:00 ARG (empresas sin alertas al final del día)
export async function GET(req: Request) {
  return generarAlertasAusencias(req, false)
}
