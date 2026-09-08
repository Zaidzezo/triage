import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { prisma } from "@/app/lib/prisma"
import { encrypt } from "@/app/lib/encryption"

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "github") return false

      await prisma.user.upsert({
        where: { githubId: String(profile?.id) },
        update: {
          githubUsername: (profile as any)?.login,
          avatarUrl: user.image,
          accessToken: encrypt(account.access_token!),
        },
        create: {
          githubId: String(profile?.id),
          githubUsername: (profile as any)?.login,
          avatarUrl: user.image,
          accessToken: encrypt(account.access_token!),
        },
      })

      return true
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.githubUsername = (profile as any)?.login
        token.githubId = String(profile?.id)
        token.accessToken = encrypt(account.access_token!)
      }
      return token
    },
    async session({ session, token }) {
      session.user.githubUsername = token.githubUsername as string
      session.user.githubId = token.githubId as string
      return session
    },
  },
})