import { generarAlertasAusencias } from "@/lib/alertas-ausencias"

// Vercel Cron — runs 02:30 UTC = 23:30 ARG del día anterior (empresas con alertas_fin_dia)
export async function GET(req: Request) {
  return generarAlertasAusencias(req, true)
}
