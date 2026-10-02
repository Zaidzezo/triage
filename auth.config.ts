import GitHub from "next-auth/providers/github"
import type { NextAuthConfig } from "next-auth"

const clientId = process.env.GITHUB_CLIENT_ID
const clientSecret = process.env.GITHUB_CLIENT_SECRET

if (!clientId || !clientSecret) {
  throw new Error(
    "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be configured"
  )
}

export default {
  providers: [
    GitHub({
      clientId,
      clientSecret,
    }),
  ],
} satisfies NextAuthConfig