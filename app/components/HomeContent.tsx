"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import IssueCard, { Issue, RepoInfo, AiScore } from "./IssueCard"
import FilterSidebar, { Filters, DEFAULT_FILTERS } from "./FilterSidebar"
import Image from "next/image"

const P = "#E05530"

type SortKey = "newest" | "oldest" | "most-comments" | "least-comments"

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "most-comments": "Most comments",
  "least-comments": "Least comments",
}

const EXAMPLES = ["vercel/next.js", "facebook/react", "microsoft/vscode"]

const SUGGESTED = [
  { label: "Good first issue", repo: "vercel/next.js", emoji: "⭐" },
  { label: "Documentation",   repo: "facebook/react",    emoji: "📄" },
  { label: "Accessibility",   repo: "microsoft/vscode",  emoji: "♿" },
  { label: "React",           repo: "facebook/react",    emoji: "⚛️"  },
]

function filterIssues(issues: Issue[], f: Filters): Issue[] {
  return issues.filter(i => {
    if (f.difficulty !== "any") {
      if (!i.aiScore || i.aiScore.difficulty !== f.difficulty) return false
    }
    if (f.comments !== "any") {
      const c = i.commentsCount
      if (f.comments === "none" && c !== 0) return false
      if (f.comments === "1-5" && (c < 1 || c > 5)) return false
      if (f.comments === "6-20" && (c < 6 || c > 20)) return false
      if (f.comments === "20+" && c <= 20) return false
    }
    if (f.assigned === "unassigned" && i.isAssigned) return false
    if (f.assigned === "assigned" && !i.isAssigned) return false
    if (f.linkedPr === "has-pr" && !i.hasLinkedPr) return false
    if (f.linkedPr === "no-pr" && i.hasLinkedPr) return false
    if (f.authorType.length > 0 && !f.authorType.includes(i.authorAssociation)) return false
    return true
  })
}

function sortIssues(issues: Issue[], s: SortKey): Issue[] {
  const sorted = [...issues]
  switch (s) {
    case "newest": return sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    case "oldest": return sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    case "most-comments": return sorted.sort((a, b) => b.commentsCount - a.commentsCount)
    case "least-comments": return sorted.sort((a, b) => a.commentsCount - b.commentsCount)
  }
}

function SkeletonCard() {
  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff", padding: 16, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div className="skeleton" style={{ width: 140, height: 16 }} />
        <div className="skeleton" style={{ width: 80, height: 16, marginLeft: "auto" }} />
      </div>
      <div className="skeleton" style={{ width: "72%", height: 18, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: "90%", height: 14, marginBottom: 5 }} />
      <div className="skeleton" style={{ width: "60%", height: 14 }} />
    </div>
  )
}

export default function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [searchInput, setSearchInput] = useState(searchParams.get("repo") ?? "")
  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [repo, setRepo]               = useState<RepoInfo | null>(null)
  const [issues, setIssues]           = useState<Issue[]>([])
  const [savedIds, setSavedIds]       = useState<Set<string>>(new Set())
  const [scores, setScores]           = useState<Record<string, AiScore>>({})
  const [scoringIds, setScoringIds]   = useState<Set<string>>(new Set())
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort]               = useState<SortKey>("newest")
  const [sortOpen, setSortOpen]       = useState(false)

  // Load saved IDs on mount
  useEffect(() => {
    fetch("/api/saved")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.saved)) {
          setSavedIds(new Set(d.saved.map((s: any) => s.issue.id as string)))
        }
      })
      .catch(() => {})
  }, [])

  // Auto-search if URL has repo param
  useEffect(() => {
    const r = searchParams.get("repo")
    if (r) fetchIssues(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchIssues(repoOverride?: string) {
    const q = (repoOverride ?? searchInput).trim()
    if (!q) return

    setIsLoading(true)
    setError(null)
    setRepo(null)
    setIssues([])
    setFilters(DEFAULT_FILTERS)

    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: q }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error === "TOKEN_REVOKED"
          ? "Your GitHub session expired. Please sign out and sign in again."
          : (data.error ?? "Failed to fetch issues."))
        return
      }

      setRepo(data.repo)

      // Merge any existing AI scores from DB
      const initial: Record<string, AiScore> = {}
      data.issues.forEach((i: any) => { if (i.aiScore) initial[i.id] = i.aiScore })
      setScores(prev => ({ ...prev, ...initial }))
      setIssues(data.issues)

      router.replace(`/?repo=${encodeURIComponent(q)}`, { scroll: false })
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleScore(issueId: string) {
    if (scoringIds.has(issueId)) return
    setScoringIds(prev => new Set(prev).add(issueId))
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueIds: [issueId] }),
      })
      const data = await res.json()
      if (data.scores?.[0]) {
        const s = data.scores[0]
        setScores(prev => ({ ...prev, [s.issueId]: { difficulty: s.difficulty, explanation: s.explanation } }))
        setIssues(prev => prev.map(i => i.id === s.issueId ? { ...i, aiScore: { difficulty: s.difficulty, explanation: s.explanation } } : i))
      }
    } catch {}
    setScoringIds(prev => { const n = new Set(prev); n.delete(issueId); return n })
  }

  async function handleToggleSave(issueId: string) {
    const was = savedIds.has(issueId)
    setSavedIds(prev => { const n = new Set(prev); was ? n.delete(issueId) : n.add(issueId); return n })
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      })
      const d = await res.json()
      setSavedIds(prev => { const n = new Set(prev); d.saved ? n.add(issueId) : n.delete(issueId); return n })
    } catch {
      setSavedIds(prev => { const n = new Set(prev); was ? n.add(issueId) : n.delete(issueId); return n })
    }
  }

  const issuesWithScores: Issue[] = issues.map(i => ({ ...i, aiScore: scores[i.id] ?? i.aiScore ?? null }))
  const filtered = sortIssues(filterIssues(issuesWithScores, filters), sort)
  const hasResults = repo !== null && issues.length > 0

  return (
    <div style={{ background: "#fff", minHeight: "calc(100vh - 56px)" }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "52px 48px 36px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 40 }}>

        {/* Left */}
        <div style={{ flex: 1, maxWidth: 620 }}>
          <h1 style={{ fontSize: 54, fontWeight: 800, color: "#111827", letterSpacing: "-2px", lineHeight: 1.08, margin: "0 0 14px" }}>
            Find your next<br />great issue
          </h1>
          <p style={{ fontSize: 16, color: "#6B7280", margin: "0 0 28px" }}>
            Discover issues that match your skills and interests.
          </p>

          {/* Hero search */}
          <form onSubmit={e => { e.preventDefault(); fetchIssues() }}
            style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center",
              border: "1.5px solid #E5E7EB", borderRadius: 10,
              padding: "0 14px", height: 50, background: "#fff", gap: 10,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search issues by repo (e.g. facebook/react)..."
                style={{ flex: 1, border: "none", outline: "none", fontSize: 15, color: "#374151", background: "transparent" }}
              />
            </div>
            <button type="submit" disabled={isLoading} style={{
              padding: "0 26px", background: P, color: "#fff", border: "none",
              borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer",
              height: 50, flexShrink: 0, opacity: isLoading ? 0.75 : 1,
            }}>
              {isLoading ? "Searching…" : "Search"}
            </button>
          </form>

          {/* Example chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>Try searching:</span>
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => { setSearchInput(ex); fetchIssues(ex) }}
                style={{ padding: "4px 12px", border: "1.5px solid #E5E7EB", borderRadius: 99, background: "#fff", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500 }}>
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            ILLUSTRATION PLACEHOLDER — 440 × 330 px
            Replace with your <Image> component
            ══════════════════════════════════════════════════ */}
        <div style={{ width: 440, height: 330, flexShrink: 0, position: "relative" }}>

  <Image
    src="/top-right.png" // Change to your actual file name in /public
    alt="Second Illustration"
    width={440}
    height={330}
    style={{ objectFit: "contain" }}
    priority
    unoptimized // Prevents Next.js 500 optimization errors on local dev
  />
</div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 48px 16px" }}>
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "11px 16px", fontSize: 14, color: "#DC2626" }}>
            {error}
          </div>
        </div>
      )}

      {/* ── Main: sidebar + content ───────────────────────── */}
      <div style={{ borderTop: "1px solid #F3F4F6" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 48px 64px", display: "flex", gap: 0 }}>

          <FilterSidebar filters={filters} onChange={setFilters} onClear={() => setFilters(DEFAULT_FILTERS)} />

          {/* Content area */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {isLoading ? (
              <>{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</>

            ) : !hasResults ? (
              /* ── Empty state ── */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>

                <div style={{ width: 440, height: 330, flexShrink: 0 }}>
                <Image
                  src="/illustration.png"
                  alt="Hero Illustration"
                  width={440}
                  height={330}
                  style={{ objectFit: "contain", width: "100%", height: "100%" }}
                  priority
                  unoptimized
                />
              </div>

                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: "0 0 10px", letterSpacing: "-0.5px" }}>
                  Your next contribution starts here.
                </h2>
                <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 24px", maxWidth: 360 }}>
                  Search above to discover issues that match your skills, interests, and available time.
                </p>

                <button
                  onClick={() => { setSearchInput("vercel/next.js"); fetchIssues("vercel/next.js") }}
                  style={{ padding: "12px 28px", background: P, color: "#fff", border: "none", borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}
                >
                  Browse good first issues
                </button>

                <a href="#" style={{ fontSize: 14, color: P, textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  Explore popular repositories
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </a>

                {/* Suggested starting points */}
                <div style={{ marginTop: 44, width: "100%", maxWidth: 640 }}>
                  <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14, fontWeight: 500, letterSpacing: "0.03em" }}>Suggested starting points</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {SUGGESTED.map(s => (
                      <button key={s.label} onClick={() => { setSearchInput(s.repo); fetchIssues(s.repo) }}
                        style={{ padding: "14px 8px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, color: "#374151", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                        <span>{s.emoji}</span>{s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            ) : (
              /* ── Results ── */
              <div>
                {/* Toolbar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
                    {filtered.length.toLocaleString()} issue{filtered.length !== 1 ? "s" : ""} found
                  </span>

                  {/* Sort dropdown */}
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setSortOpen(p => !p)} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 12px", border: "1px solid #E5E7EB", borderRadius: 8,
                      background: "#fff", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/>
                      </svg>
                      {SORT_LABELS[sort]}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {sortOpen && (
                      <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "4px 0", minWidth: 170, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 20 }}>
                        {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                          <button key={k} onClick={() => { setSort(k); setSortOpen(false) }}
                            style={{ width: "100%", textAlign: "left", padding: "8px 14px", border: "none", background: sort === k ? "#FFF3EE" : "none", cursor: "pointer", fontSize: 13, color: sort === k ? P : "#374151", fontWeight: sort === k ? 600 : 400 }}>
                            {SORT_LABELS[k]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Issue cards */}
                {filtered.length === 0
                  ? <div style={{ textAlign: "center", padding: "48px 24px", color: "#9CA3AF", fontSize: 14 }}>No issues match the current filters.</div>
                  : filtered.map(issue => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      repo={repo!}
                      isSaved={savedIds.has(issue.id)}
                      isScoring={scoringIds.has(issue.id)}
                      onSave={() => handleToggleSave(issue.id)}
                      onScore={() => handleScore(issue.id)}
                    />
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}