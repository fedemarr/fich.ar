import { createHmac } from "crypto"
import { NextResponse } from "next/server"

// Endpoint temporal de diagnóstico — eliminar post-presentación
export async function POST(req: Request) {
  const body = await req.text()
  const secret = process.env.META_APP_SECRET ?? ""
  const hash = createHmac("sha256", secret).update(body).digest("hex")
  return NextResponse.json({
    prefix: hash.slice(0, 8),
    secret_length: secret.length,
    secret_set: secret.length > 0,
  })
}
