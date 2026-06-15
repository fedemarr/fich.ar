import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import type { RolUsuario } from "@/generated/prisma/client"
import { authConfig } from "./auth.config"
import { rateLimitLogin } from "./rate-limit"
import { registrarAudit } from "./audit"

declare module "next-auth" {
  interface User {
    empresaId: string
    empresaSlug: string
    rol: RolUsuario
  }
  interface Session {
    user: {
      id: string
      email: string
      name: string
      empresaId: string
      empresaSlug: string
      rol: RolUsuario
    }
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        try {
          const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? email
          const { success } = await rateLimitLogin.limit(ip)
          if (!success) return null
        } catch {
          // Redis no disponible — login sin rate limiting
        }

        const usuario = await prisma.usuario.findUnique({
          where: { email, deleted_at: null },
          include: { empresa: { select: { slug: true } } },
        })

        if (!usuario || !usuario.activo) {
          await registrarAudit({
            rol: "DESCONOCIDO",
            accion: "LOGIN_FALLIDO",
            detalle: { email },
          })
          return null
        }
        const ok = await bcrypt.compare(password, usuario.password)
        if (!ok) {
          await registrarAudit({
            empresa_id: usuario.empresa_id,
            usuario_id: usuario.id,
            rol: usuario.rol,
            accion: "LOGIN_FALLIDO",
            detalle: { email },
          })
          return null
        }

        await registrarAudit({
          empresa_id: usuario.empresa_id,
          usuario_id: usuario.id,
          rol: usuario.rol,
          accion: "LOGIN",
          detalle: { email },
        })

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre,
          empresaId: usuario.empresa_id,
          empresaSlug: usuario.empresa.slug,
          rol: usuario.rol,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.empresaId = user.empresaId
        token.empresaSlug = user.empresaSlug
        token.rol = user.rol as string
      }
      return token
    },
    session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          empresaId: token.empresaId as string,
          empresaSlug: token.empresaSlug as string,
          rol: token.rol as RolUsuario,
        },
      }
    },
  },
})
