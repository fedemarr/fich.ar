import { createHmac } from "crypto"
import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"

export async function GET() {
  const lastError = await redis.get<string>("wa:last_error")
  return NextResponse.json({ last_error: lastError ?? "none" })
}

export async function POST(req: Request) {
  const body = await req.text()
  const secret = process.env.META_APP_SECRET ?? ""
  const hash = createHmac("sha256", secret).update(body).digest("hex")
  return NextResponse.json({
    prefix: hash.slice(0, 8),
    secret_length: secret.length,
  })
}
