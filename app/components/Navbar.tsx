"use client"

import { useSession, signIn, signOut } from "next-auth/react"

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b">
      <h1 className="font-bold text-xl">Triage</h1>

      <div>
        {session ? (
          <div className="flex items-center gap-4">
            <span>{session.user?.name}</span>
            <button
              onClick={() => signOut()}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("github")}
            className="bg-gray-900 text-white px-4 py-2 rounded"
          >
            Sign in with GitHub
          </button>
        )}
      </div>
    </nav>
  )
}