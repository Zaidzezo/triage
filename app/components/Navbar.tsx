"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useState, useRef, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"

const P = "#E05530"

export default function Navbar() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`/?repo=${encodeURIComponent(query.trim())}`)
  }

  const initials = (session?.user?.githubUsername ?? session?.user?.name ?? "?")
    .slice(0, 2)
    .toUpperCase()

  return (
    <nav style={{
      height: 56,
      background: "#fff",
      borderBottom: "1px solid #E5E7EB",
      display: "flex",
      alignItems: "center",
      padding: "0 32px",
      gap: 20,
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "#FFF0EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>🦊</div>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#111827", letterSpacing: "-0.3px" }}>Triage</span>
      </Link>

      {/* Center search */}
      <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 540 }}>
        <div style={{
          display: "flex", alignItems: "center",
          border: "1px solid #E5E7EB", borderRadius: 8,
          padding: "0 12px", height: 36, background: "#F9FAFB", gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find issues by repo, e.g. facebook/react"
            style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "#374151" }}
          />
          <span style={{
            fontSize: 11, color: "#9CA3AF", background: "#F3F4F6",
            border: "1px solid #E5E7EB", borderRadius: 4, padding: "2px 5px", flexShrink: 0,
          }}>⌘K</span>
        </div>
      </form>

      {/* Right nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: "auto" }}>
        {[
          { href: "/", label: "Discover", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> },
          { href: "/saved", label: "Saved", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> },
          { href: "/activity", label: "My activity", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
        ].map(({ href, label, icon }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 11px", borderRadius: 6, textDecoration: "none",
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              color: isActive ? P : "#374151",
              background: isActive ? "#FFF0EB" : "transparent",
            }}>
              {icon}{label}
            </Link>
          )
        })}

        {/* Avatar */}
        {session ? (
          <div ref={dropdownRef} style={{ position: "relative", marginLeft: 8 }}>
            <button
              onClick={() => setDropdownOpen(p => !p)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 8px", border: "1px solid #E5E7EB",
                borderRadius: 8, background: "#fff", cursor: "pointer",
              }}
            >
              {session.user?.image
                ? <img src={session.user.image} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#FFF0EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: P, fontWeight: 600 }}>{initials}</div>
              }
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {dropdownOpen && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)",
                background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
                padding: "4px 0", minWidth: 168, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 100,
              }}>
                <div style={{ padding: "8px 14px 10px", borderBottom: "1px solid #F3F4F6" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#111827" }}>{session.user?.name ?? session.user?.githubUsername}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9CA3AF" }}>@{session.user?.githubUsername}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  style={{ width: "100%", textAlign: "left", padding: "9px 14px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#DC2626" }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
  suppressHydrationWarning
  onClick={() => signIn("github")}
  style={{ marginLeft: 8, padding: "6px 14px", background: P, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
>
  Sign in
</button>
        )}
      </div>
    </nav>
  )
}