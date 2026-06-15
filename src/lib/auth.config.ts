import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Edge-safe: mapea campos del JWT al session.user para que estén en req.auth
    session({ session, token }) {
      const u = session.user as unknown as Record<string, unknown>
      u.id = token.id
      u.empresaId = token.empresaId
      u.empresaSlug = token.empresaSlug
      u.rol = token.rol
      return session
    },

    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const user = auth?.user as Record<string, unknown> | undefined
      const isLoggedIn = !!user

      // Cron jobs — Vercel envía Authorization: Bearer <CRON_SECRET>
      if (pathname.startsWith("/api/cron")) {
        const header = request.headers.get("authorization") ?? ""
        return header === `Bearer ${process.env.CRON_SECRET}`
      }

      // Rutas API y públicas — siempre permitir
      if (pathname.startsWith("/api/")) return true
      if (pathname.startsWith("/fichar/")) return true
      if (pathname.startsWith("/api/webhooks")) return true

      const isAuthPage = pathname === "/login"

      // No logueado en página protegida → redirige a login
      if (!isLoggedIn && !isAuthPage) return false

      // Logueado en /login → redirige al dashboard
      if (isLoggedIn && isAuthPage) {
        const slug = (user?.empresaSlug as string) ?? ""
        return Response.redirect(new URL(`/${slug}/resumen`, request.nextUrl))
      }

      // Panel admin → solo SUPER_ADMIN
      if (pathname.startsWith("/admin")) {
        if (user?.rol !== "SUPER_ADMIN") return false
        return true
      }

      // Dashboard: verificar que el slug de la URL coincide con la empresa del usuario
      const slugEnURL = pathname.split("/")[1]
      const empresaSlug = user?.empresaSlug as string | undefined
      const rol = user?.rol as string | undefined

      if (slugEnURL && empresaSlug && slugEnURL !== empresaSlug && rol !== "SUPER_ADMIN") {
        return Response.redirect(new URL(`/${empresaSlug}/resumen`, request.nextUrl))
      }

      return true
    },
  },
  session: { strategy: "jwt" },
}
