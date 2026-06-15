import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import type { RolUsuario } from "@/generated/prisma/client"
import { authConfig } from "./auth.config"

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
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials)
          console.log("[AUTH] parsed ok:", parsed.success)
          if (!parsed.success) return null

          const { email, password } = parsed.data
          console.log("[AUTH] email:", email)

          const usuario = await prisma.usuario.findFirst({
            where: { email, deleted_at: null },
            include: { empresa: { select: { slug: true } } },
          })
          console.log("[AUTH] usuario encontrado:", !!usuario, "activo:", usuario?.activo)

          if (!usuario || !usuario.activo) return null
          const ok = await bcrypt.compare(password, usuario.password)
          console.log("[AUTH] password ok:", ok)
          if (!ok) return null

          return {
            id: usuario.id,
            email: usuario.email,
            name: usuario.nombre,
            empresaId: usuario.empresa_id,
            empresaSlug: usuario.empresa.slug,
            rol: usuario.rol,
          }
        } catch (e) {
          console.error("[AUTH] error en authorize:", e)
          return null
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
