import { generarAlertasAusencias } from "@/lib/alertas-ausencias"

// Vercel Cron — runs 21:00 UTC = 18:00 ARG (empresas con alertas_fin_dia)
export async function GET(req: Request) {
  return generarAlertasAusencias(req, true)
}
