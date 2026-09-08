import { cookies } from "next/headers"
import { decode } from "next-auth/jwt"
import { decrypt } from "@/app/lib/encryption"

const COOKIE_NAME =
  process.env.NEXTAUTH_URL?.startsWith("https://") ||
  process.env.AUTH_URL?.startsWith("https://")
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"

export async function getAccessToken(): Promise<string> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) throw new Error("NOT_AUTHENTICATED")

  const payload = await decode({
    token,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET!,
    salt: COOKIE_NAME,
  })

  const encrypted = payload?.accessToken as string | undefined
  if (!encrypted) throw new Error("NOT_AUTHENTICATED")

  return decrypt(encrypted)
}