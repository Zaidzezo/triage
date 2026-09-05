import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { prisma } from "@/app/lib/prisma"

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "github") return false

      await prisma.user.upsert({
        where: { githubId: String(profile?.id) },
        update: {
          githubUsername: (profile as any)?.login,
          avatarUrl: user.image,
          accessToken: account.access_token!,
        },
        create: {
          githubId: String(profile?.id),
          githubUsername: (profile as any)?.login,
          avatarUrl: user.image,
          accessToken: account.access_token!,
        },
      })

      return true
    },

    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.githubUsername = (profile as any)?.login
        token.githubId = String(profile?.id)
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