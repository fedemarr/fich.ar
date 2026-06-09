import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage = nextUrl.pathname === "/login"
      const isApiRoute = nextUrl.pathname.startsWith("/api")

      if (isApiRoute) return true
      if (!isLoggedIn && !isAuthPage) return false
      if (isLoggedIn && isAuthPage) {
        const slug = (auth?.user as { empresaSlug?: string })?.empresaSlug ?? ""
        return Response.redirect(new URL(`/${slug}/resumen`, nextUrl))
      }
      return true
    },
  },
  session: { strategy: "jwt" },
}
