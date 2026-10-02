import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { prisma } from "@/app/lib/prisma"
import { encrypt } from "@/app/lib/encryption"

interface GitHubProfile {
  id?: string | number
  login?: string
}

function getGitHubProfile(profile: unknown): GitHubProfile {
  if (!profile || typeof profile !== "object") {
    return {}
  }

  const value = profile as Record<string, unknown>

  return {
    id:
      typeof value.id === "string" || typeof value.id === "number"
        ? value.id
        : undefined,
    login: typeof value.login === "string" ? value.login : undefined,
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "github") {
        return false
      }

      const githubProfile = getGitHubProfile(profile)

      if (githubProfile.id == null || !githubProfile.login) {
        return false
      }

      if (!account.access_token) {
        return false
      }

      await prisma.user.upsert({
        where: {
          githubId: String(githubProfile.id),
        },

        update: {
          githubUsername: githubProfile.login,
          avatarUrl: user.image,
          accessToken: encrypt(account.access_token),
        },

        create: {
          githubId: String(githubProfile.id),
          githubUsername: githubProfile.login,
          avatarUrl: user.image,
          accessToken: encrypt(account.access_token),
        },
      })

      return true
    },

    async jwt({ token, account, profile }) {
      if (account && profile) {
        const githubProfile = getGitHubProfile(profile)

        if (githubProfile.id != null && githubProfile.login) {
          token.githubUsername = githubProfile.login
          token.githubId = String(githubProfile.id)
        }

        if (account.access_token) {
          token.accessToken = encrypt(account.access_token)
        }
      }

      return token
    },

    async session({ session, token }) {
      session.user.githubUsername =
        typeof token.githubUsername === "string"
          ? token.githubUsername
          : ""

      session.user.githubId =
        typeof token.githubId === "string"
          ? token.githubId
          : ""

      return session
    },
  },
})