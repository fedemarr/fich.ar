import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rutas públicas — sin auth
  if (pathname.startsWith("/login")) return NextResponse.next()
  if (pathname.startsWith("/api/webhooks")) return NextResponse.next()
  if (pathname.startsWith("/fichar/")) return NextResponse.next()

  // Cron jobs — requieren header Authorization: Bearer <CRON_SECRET>
  if (pathname.startsWith("/api/cron")) {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Rutas de API — cada endpoint maneja su propio auth con verificarAcceso()
  if (pathname.startsWith("/api/")) return NextResponse.next()

  // Páginas — requieren sesión válida
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const rol = token.rol as string
  const empresaSlug = token.empresaSlug as string

  // Panel /admin — solo SUPER_ADMIN
  if (pathname.startsWith("/admin")) {
    if (rol !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url))
    }
    return NextResponse.next()
  }

  // Dashboard /[slug]/... — verificar que el slug coincide con la empresa
  const slugEnURL = pathname.split("/")[1]
  if (slugEnURL && empresaSlug && slugEnURL !== empresaSlug && rol !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL(`/${empresaSlug}/resumen`, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
