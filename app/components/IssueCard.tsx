"use client"

import { useState } from "react"

const P = "#E05530"

export interface AiScore {
  difficulty: "easy" | "medium" | "hard"
  explanation: string
}

export interface Issue {
  id: string
  number: number
  title: string
  url: string
  bodyPreview: string | null
  state: string
  authorAssociation: string
  commentsCount: number
  isAssigned: boolean
  hasLinkedPr: boolean
  createdAt: string
  aiScore: AiScore | null
}

export interface RepoInfo {
  fullName: string
  stars: number
  language: string | null
  description: string | null
}

interface Props {
  issue: Issue
  repo: RepoInfo
  isSaved: boolean
  isScoring: boolean
  onSave: () => void
  onScore: () => void
}

function formatStars(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(n)
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 2_592_000) return `${Math.floor(s / 86400)} days ago`
  if (s < 31_536_000) return `${Math.floor(s / 2_592_000)} months ago`
  return `${Math.floor(s / 31_536_000)}y ago`
}

const AUTHOR_MAP: Record<string, string> = {
  OWNER: "Owner", COLLABORATOR: "Collaborator",
  CONTRIBUTOR: "Contributor", MEMBER: "Member", NONE: "None",
}

const DIFF_MAP = {
  easy: { color: "#16A34A", label: "Easy" },
  medium: { color: "#D97706", label: "Medium" },
  hard: { color: "#DC2626", label: "Hard" },
}

export default function IssueCard({ issue, repo, isSaved, isScoring, onSave, onScore }: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasScore = !!issue.aiScore

  function handleAiClick() {
    if (!hasScore) onScore()
    setExpanded(p => !p)
  }

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff", marginBottom: 10, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 13px" }}>

        {/* Top row: repo info + metadata + actions */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>

          {/* Left: repo name + stars */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#374151" style={{ flexShrink: 0 }}>
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{repo.fullName}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <span style={{ fontSize: 12, color: "#6B7280" }}>{formatStars(repo.stars)}</span>
              </div>
            </div>
            {/* Repo health placeholder badge */}
            <span style={{
              fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99,
              background: "#DCFCE7", color: "#16A34A", border: "1px solid #BBF7D0", flexShrink: 0,
            }}>Active</span>
          </div>

          {/* Right: metadata + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6B7280" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {issue.commentsCount}
            </span>
            <span style={{ color: "#D1D5DB" }}>·</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6B7280" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {timeAgo(issue.createdAt)}
            </span>
            <span style={{ color: "#D1D5DB" }}>·</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6B7280" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              {AUTHOR_MAP[issue.authorAssociation] ?? issue.authorAssociation}
            </span>
            {hasScore && (
              <>
                <span style={{ color: "#D1D5DB" }}>·</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6B7280" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: DIFF_MAP[issue.aiScore!.difficulty].color, display: "inline-block" }} />
                  {DIFF_MAP[issue.aiScore!.difficulty].label}
                </span>
              </>
            )}
            <span style={{ color: "#D1D5DB" }}>·</span>
            {/* Save heart */}
            <button onClick={onSave} style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: isSaved ? "#EF4444" : "#D1D5DB", lineHeight: 1 }} title={isSaved ? "Unsave" : "Save"}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
            {/* External link */}
            <a href={issue.url} target="_blank" rel="noopener noreferrer" style={{ color: "#D1D5DB", lineHeight: 1 }} title="Open on GitHub">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Issue title */}
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "0 0 6px", lineHeight: 1.4 }}>
          {issue.title}
        </h3>

        {/* Body preview */}
        {issue.bodyPreview && (
          <p style={{
            fontSize: 13, color: "#6B7280", margin: "0 0 12px", lineHeight: 1.55,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          } as React.CSSProperties}>
            {issue.bodyPreview}
          </p>
        )}

        {/* Tags + AI button row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {!issue.isAssigned && (
              <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 99, background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#16A34A" }}>good first issue</span>
            )}
            {issue.isAssigned && (
              <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 99, border: "1px solid #E5E7EB", color: "#6B7280" }}>assigned</span>
            )}
            {issue.hasLinkedPr && (
              <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 99, background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#2563EB" }}>linked PR</span>
            )}
          </div>

          <button
            onClick={handleAiClick}
            disabled={isScoring}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px",
              background: isScoring ? "#F3F4F6" : P,
              color: isScoring ? "#9CA3AF" : "#fff",
              border: "none", borderRadius: 7,
              fontSize: 13, fontWeight: 600,
              cursor: isScoring ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {isScoring ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Scoring…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                {hasScore ? (expanded ? "Hide summary" : "AI summarize") : "AI summarize"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI summary panel */}
      {hasScore && expanded && (
        <div style={{ borderTop: "1px solid #FEE9DF", background: "#FFFBF9", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={P}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: P }}>AI summary</span>
          </div>
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.65, margin: "0 0 14px" }}>
            {issue.aiScore!.explanation}
          </p>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 5px" }}>Difficulty</p>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: DIFF_MAP[issue.aiScore!.difficulty].color }} />
              {DIFF_MAP[issue.aiScore!.difficulty].label}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}