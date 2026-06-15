import { NextResponse } from "next/server"
import { verificarAcceso } from "@/lib/auth-helpers"

interface IpApiResult {
  status: string
  query: string
  country: string
  countryCode: string
  regionName: string
  city: string
  isp: string
  lat: number
  lon: number
}

export async function GET(req: Request) {
  const { error } = await verificarAcceso("VER_AUDITORIA")
  if (error) return error

  const { searchParams } = new URL(req.url)
  const ipsParam = searchParams.get("ips") ?? ""
  const ips = ipsParam
    .split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip && ip !== "unknown" && ip !== "127.0.0.1" && !ip.startsWith("192.168"))
    .slice(0, 100)

  if (ips.length === 0) return NextResponse.json({})

  const res = await fetch(
    "http://ip-api.com/batch?fields=status,query,country,countryCode,regionName,city,isp,lat,lon",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ips),
    }
  )

  if (!res.ok) return NextResponse.json({})

  const data: IpApiResult[] = await res.json()

  const result: Record<string, {
    ciudad: string; region: string; pais: string; bandera: string; isp: string; lat: number; lon: number
  }> = {}

  for (const item of data) {
    if (item.status === "success") {
      const bandera = item.countryCode
        ? String.fromCodePoint(...item.countryCode.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
        : "🌐"
      result[item.query] = {
        ciudad: item.city,
        region: item.regionName,
        pais: item.country,
        bandera,
        isp: item.isp,
        lat: item.lat,
        lon: item.lon,
      }
    }
  }

  return NextResponse.json(result)
}
