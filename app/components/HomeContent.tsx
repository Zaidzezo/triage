"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  Terminal,
} from "lucide-react";
import {
  Inter,
  JetBrains_Mono,
  Space_Grotesk,
} from "next/font/google";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import IssueCard, {
  Issue,
  RepoInfo,
  AiScore,
} from "./IssueCard";

import FilterSidebar, {
  Filters,
  DEFAULT_FILTERS,
} from "./FilterSidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const T = {
  bg: "#08090D",
  bg2: "#0D1018",
  glass: "rgba(18, 22, 32, 0.58)",
  glassStrong: "rgba(20, 25, 37, 0.78)",
  border: "rgba(255,255,255,0.09)",
  borderBright: "rgba(255,255,255,0.15)",
  text: "#F5F7FB",
  muted: "#9299A8",
  faint: "#565D6C",
  violet: "#9B8CFF",
  violetDim: "rgba(155,140,255,0.12)",
  lime: "#B8F36B",
  amber: "#FFC978",
  red: "#FF8E9E",
};

const EASE = [0.22, 1, 0.36, 1] as const;

type SortKey = "newest" | "oldest" | "most-comments" | "least-comments";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "most-comments": "Most comments",
  "least-comments": "Least comments",
};

// Single source of truth for suggested searches
const SUGGESTED = [
  { label: "Next.js", query: "next", accent: T.violet },
  { label: "React", query: "react", accent: T.lime },
  { label: "Programming", query: "programming", accent: T.amber },
  { label: "Documentation", query: "documentation", accent: "#8FC7FF" },
];

const DAY = 24 * 60 * 60 * 1000;

function filterIssues(issues: Issue[], filters: Filters): Issue[] {
  const now = Date.now();

  return issues.filter((issue) => {
    if (filters.difficulty !== "any") {
      if (!issue.aiScore || issue.aiScore.difficulty !== filters.difficulty) {
        return false;
      }
    }

    if (filters.comments !== "any") {
      const count = issue.commentsCount;
      if (filters.comments === "none" && count !== 0) return false;
      if (filters.comments === "1-5" && (count < 1 || count > 5)) return false;
      if (filters.comments === "6-20" && (count < 6 || count > 20)) return false;
      if (filters.comments === "20+" && count <= 20) return false;
    }

    if (filters.assigned === "unassigned" && issue.isAssigned) return false;
    if (filters.assigned === "assigned" && !issue.isAssigned) return false;
    if (filters.linkedPr === "has-pr" && !issue.hasLinkedPr) return false;
    if (filters.linkedPr === "no-pr" && issue.hasLinkedPr) return false;

    if (
      filters.authorType.length > 0 &&
      !filters.authorType.includes(issue.authorAssociation)
    ) {
      return false;
    }

    if (filters.stars !== "any") {
      const stars = issue.repo?.stars ?? 0;
      if (stars < Number(filters.stars)) return false;
    }

    if (filters.language !== "any") {
      const language = issue.repo?.language ?? null;
      if (language !== filters.language) return false;
    }

    if (filters.repoHealth !== "any") {
      const healthy = issue.repo?.health?.reviewedInLast10 ?? false;
      if (filters.repoHealth === "reviewed" && !healthy) return false;
      if (filters.repoHealth === "unreviewed" && healthy) return false;
    }

    if (filters.date !== "any") {
      const created = new Date(issue.createdAt).getTime();
      const age = now - created;
      if (filters.date === "day" && age > DAY) return false;
      if (filters.date === "week" && age > DAY * 7) return false;
      if (filters.date === "month" && age > DAY * 30) return false;
    }

    return true;
  });
}

function sortIssues(issues: Issue[], sort: SortKey): Issue[] {
  const sorted = [...issues];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    case "oldest":
      return sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    case "most-comments":
      return sorted.sort((a, b) => b.commentsCount - a.commentsCount);
    case "least-comments":
      return sorted.sort((a, b) => a.commentsCount - b.commentsCount);
  }
}

function Noise() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        opacity: 0.035,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

function CursorSpotlight() {
  const reduce = useReducedMotion();
  const [position, setPosition] = useState({ x: -500, y: -500 });

  useEffect(() => {
    if (reduce) return;

    let frame = 0;
    let targetX = -500;
    let targetY = -500;
    let currentX = -500;
    let currentY = -500;

    const move = (event: MouseEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const animate = () => {
      const nextX = currentX + (targetX - currentX) * 0.08;
      const nextY = currentY + (targetY - currentY) * 0.08;

      // Only update state when movement is meaningful — avoids infinite setState
      if (Math.abs(nextX - currentX) > 0.1 || Math.abs(nextY - currentY) > 0.1) {
        currentX = nextX;
        currentY = nextY;
        setPosition({ x: currentX, y: currentY });
      }

      frame = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", move);
    frame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(frame);
    };
  }, [reduce]);

  if (reduce) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
        background: `radial-gradient(
          520px circle at ${position.x}px ${position.y}px,
          rgba(155,140,255,0.07),
          transparent 70%
        )`,
      }}
    />
  );
}

function GlassCard({
  children,
  radius = 18,
  style,
}: {
  children: React.ReactNode;
  radius?: number;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ duration: 0.25, ease: EASE }}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        background: T.glass,
        backdropFilter: "blur(22px)",
        WebkitBackdropFilter: "blur(22px)",
        border: `1px solid ${T.border}`,
        boxShadow:
          "0 28px 80px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)",
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.055), transparent 35%, rgba(155,140,255,0.035))",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <motion.div
      initial={{ opacity: 0.45 }}
      animate={{ opacity: [0.38, 0.65, 0.38] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      style={{
        height: 188,
        marginBottom: 12,
        borderRadius: 16,
        border: `1px solid ${T.border}`,
        background: "linear-gradient(145deg, rgba(22,26,37,0.72), rgba(10,13,20,0.72))",
      }}
    >
      <div style={{ padding: 20 }}>
        <div
          style={{
            width: 170,
            height: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            marginBottom: 18,
          }}
        />
        <div
          style={{
            width: "66%",
            height: 17,
            borderRadius: 7,
            background: "rgba(255,255,255,0.09)",
            marginBottom: 12,
          }}
        />
        <div
          style={{
            width: "92%",
            height: 9,
            borderRadius: 999,
            background: "rgba(255,255,255,0.055)",
            marginBottom: 8,
          }}
        />
        <div
          style={{
            width: "76%",
            height: 9,
            borderRadius: 999,
            background: "rgba(255,255,255,0.055)",
          }}
        />
      </div>
    </motion.div>
  );
}

function EmptyVisual() {
  const reduce = useReducedMotion();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 300,
        marginBottom: 16,
        overflow: "hidden",
        borderRadius: 22,
        border: `1px solid ${T.border}`,
        background: "linear-gradient(145deg, rgba(23,27,40,0.76), rgba(9,12,18,0.76))",
        boxShadow:
          "0 40px 90px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 80% 75% at 50% 50%, black, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 75% at 50% 50%, black, transparent 78%)",
        }}
      />

      <motion.div
        aria-hidden
        animate={
          reduce
            ? undefined
            : { scale: [1, 1.08, 1], opacity: [0.22, 0.4, 0.22] }
        }
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          left: "50%",
          top: "46%",
          width: 300,
          height: 180,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(155,140,255,0.22), transparent 70%)",
          filter: "blur(32px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 210,
          height: 125,
          transform: "translate(-50%, -50%)",
          borderRadius: 18,
          border: `1px solid ${T.borderBright}`,
          background:
            "linear-gradient(145deg, rgba(34,39,57,0.86), rgba(11,14,22,0.84))",
          boxShadow:
            "0 30px 70px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 7.5,
              color: T.faint,
            }}
          >
            triage.scan
          </span>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 8,
            }}
          >
            <Search size={12} color={T.violet} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 8.5,
                color: "#C7C2FF",
              }}
            >
              repository
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-grotesk)",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.04em",
            }}
          >
            Waiting for input
          </div>
        </div>

        <div
          style={{
            height: 6,
            width: "65%",
            borderRadius: 999,
            background:
              "linear-gradient(90deg, rgba(155,140,255,0.38), rgba(155,140,255,0.04))",
          }}
        />
      </div>
    </div>
  );
}

export default function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();

  const [searchInput, setSearchInput] = useState(searchParams.get("repo") ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Record<string, AiScore>>({});
  const [scoringIds, setScoringIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("newest");
  const [sortOpen, setSortOpen] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);

  // ── Close sort dropdown on outside click ──────────────────────────
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close sort dropdown on Escape
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSortOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ── Load saved issue IDs ───────────────────────────────────────────
  useEffect(() => {
    fetch("/api/saved")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.saved)) {
          setSavedIds(
            new Set(data.saved.map((s: any) => s.issue.id as string))
          );
        }
      })
      .catch(() => {});
  }, []);

  // ── Re-run search when URL ?repo= param changes ───────────────────
  // This also handles Navbar searches while already on "/"
  useEffect(() => {
    const search = searchParams.get("repo");
    if (search) {
      setSearchInput(search);
      fetchIssues(search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Search ────────────────────────────────────────────────────────
  async function fetchIssues(queryOverride?: string) {
    const query = (queryOverride ?? searchInput).trim();
    if (!query) return;

    setIsLoading(true);
    setError(null);
    setRepo(null);
    setIssues([]);
    setFilters(DEFAULT_FILTERS);
    setSort("newest");
    setSortOpen(false);
    // Clear stale scores from a previous search
    setScores({});
    setScoringIds(new Set());

    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: query }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to search GitHub issues.");
        return;
      }

      const returnedIssues: Issue[] = Array.isArray(data.issues) ? data.issues : [];
      const returnedRepo =
        data.mode === "repository" && data.repos?.[0] ? data.repos[0] : null;

      setRepo(returnedRepo);

      // Preserve any scores already embedded in the API response
      const initialScores: Record<string, AiScore> = {};
      returnedIssues.forEach((issue: Issue) => {
        if (issue.aiScore) initialScores[issue.id] = issue.aiScore;
      });
      setScores(initialScores);
      setIssues(returnedIssues);
      setHasSearched(true);

      router.replace(`/?repo=${encodeURIComponent(query)}`, { scroll: false });
    } catch {
      setError("Something went wrong while searching GitHub.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── AI score ──────────────────────────────────────────────────────
  async function handleScore(issueId: string) {
    if (scoringIds.has(issueId)) return;

    setScoringIds((prev) => new Set(prev).add(issueId));

    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueIds: [issueId] }),
      });

      const data = await response.json();

      if (data.scores?.[0]) {
        const score = data.scores[0];
        const aiScore: AiScore = {
          difficulty: score.difficulty,
          explanation: score.explanation,
        };

        setScores((prev) => ({ ...prev, [score.issueId]: aiScore }));
        setIssues((prev) =>
          prev.map((issue) =>
            issue.id === score.issueId ? { ...issue, aiScore } : issue
          )
        );
      }
    } catch {
      // silently ignore — user can retry
    }

    setScoringIds((prev) => {
      const next = new Set(prev);
      next.delete(issueId);
      return next;
    });
  }

  // ── Save / unsave ─────────────────────────────────────────────────
  async function handleToggleSave(issueId: string) {
    const wasSaved = savedIds.has(issueId);

    // Optimistic update
    setSavedIds((prev) => {
      const next = new Set(prev);
      wasSaved ? next.delete(issueId) : next.add(issueId);
      return next;
    });

    try {
      const response = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });

      const data = await response.json();

      // Reconcile with server truth
      setSavedIds((prev) => {
        const next = new Set(prev);
        data.saved ? next.add(issueId) : next.delete(issueId);
        return next;
      });
    } catch {
      // Roll back on network error
      setSavedIds((prev) => {
        const next = new Set(prev);
        wasSaved ? next.add(issueId) : next.delete(issueId);
        return next;
      });
    }
  }

  // ── Derived data ──────────────────────────────────────────────────

  // Memoized so downstream memos don't recompute on every render
  const issuesWithScores = useMemo(
    () =>
      issues.map((issue) => ({
        ...issue,
        aiScore: scores[issue.id] ?? issue.aiScore ?? null,
      })),
    [issues, scores]
  );

  const availableLanguages = useMemo(
    () =>
      Array.from(
        new Set(
          issuesWithScores
            .map((issue) => issue.repo?.language)
            .filter((l): l is string => Boolean(l))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [issuesWithScores]
  );

  const filteredIssues = useMemo(
    () => sortIssues(filterIssues(issuesWithScores, filters), sort),
    [issuesWithScores, filters, sort]
  );

  const repositoryCount = useMemo(
    () => new Set(issuesWithScores.map((i) => i.repo?.fullName).filter(Boolean)).size,
    [issuesWithScores]
  );

  // Derived from repositoryCount — no need to iterate issuesWithScores again
  const isGlobalSearch = repositoryCount > 1;
  const hasResults = issuesWithScores.length > 0;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <main
      className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}
      style={{
        minHeight: "calc(100vh - 72px)",
        color: T.text,
        background: `
          radial-gradient(circle at 50% -10%, rgba(155,140,255,0.08), transparent 36%),
          ${T.bg}
        `,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        overflowX: "hidden",
      }}
    >
      <CursorSpotlight />
      <Noise />

      <div style={{ position: "relative", zIndex: 4 }}>
        {/* ── Hero ── */}
        <section
          style={{ maxWidth: 1440, margin: "0 auto", padding: "58px 40px 34px" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: EASE }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 18,
                padding: "6px 10px",
                borderRadius: 999,
                background: T.violetDim,
                border: "1px solid rgba(155,140,255,0.20)",
                color: "#C9C4FF",
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: T.violet,
                  boxShadow: `0 0 12px ${T.violet}`,
                }}
              />
              OPEN-SOURCE DISCOVERY
            </div>

            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-grotesk)",
                fontSize: "clamp(44px, 5vw, 68px)",
                lineHeight: 0.97,
                letterSpacing: "-0.055em",
                fontWeight: 750,
                maxWidth: 760,
              }}
            >
              Find the work.
              <br />
              <span style={{ color: T.violet }}>Know what matters.</span>
            </h1>

            <p
              style={{
                margin: "18px 0 0",
                maxWidth: 620,
                color: T.muted,
                fontSize: 14.5,
                lineHeight: 1.7,
              }}
            >
              Search GitHub issues across repositories, then narrow the results
              by repository quality, technology, freshness, and contribution fit.
            </p>

            {/* Search form */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                fetchIssues();
              }}
              style={{ display: "flex", gap: 9, marginTop: 28, maxWidth: 720 }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 54,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 15px",
                  borderRadius: 12,
                  border: `1px solid ${T.borderBright}`,
                  background: T.glassStrong,
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  boxShadow:
                    "0 20px 60px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                <Search size={16} color={T.muted} />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search GitHub issues..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: T.text,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
                  }}
                />
                <kbd
                  style={{
                    padding: "3px 6px",
                    borderRadius: 5,
                    border: `1px solid ${T.border}`,
                    background: "rgba(255,255,255,0.035)",
                    color: T.faint,
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                  }}
                >
                  ENTER
                </kbd>
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={reduce ? undefined : { y: -1 }}
                whileTap={reduce ? undefined : { scale: 0.985 }}
                style={{
                  height: 54,
                  padding: "0 21px",
                  border: "none",
                  borderRadius: 12,
                  background: T.violet,
                  color: T.bg,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.7 : 1,
                  boxShadow: "0 14px 38px rgba(155,140,255,0.20)",
                  whiteSpace: "nowrap",
                }}
              >
                {isLoading ? "Searching..." : "Search issues"}
              </motion.button>
            </form>

            {/* Quick-search pills — derived from SUGGESTED */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 7,
                marginTop: 13,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  color: T.faint,
                  fontSize: 9.5,
                }}
              >
                try:
              </span>
              {SUGGESTED.map((item) => (
                <button
                  key={item.query}
                  type="button"
                  onClick={() => {
                    setSearchInput(item.query);
                    fetchIssues(item.query);
                  }}
                  style={{
                    padding: "5px 9px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.025)",
                    border: `1px solid ${T.border}`,
                    color: T.muted,
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    cursor: "pointer",
                  }}
                >
                  {item.query}
                </button>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                maxWidth: 1440,
                margin: "0 auto",
                padding: "0 40px 18px",
              }}
            >
              <div
                style={{
                  padding: "12px 15px",
                  borderRadius: 11,
                  background: "rgba(255,142,158,0.08)",
                  border: "1px solid rgba(255,142,158,0.22)",
                  color: T.red,
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main content ── */}
        <section
          style={{ maxWidth: 1440, margin: "0 auto", padding: "20px 40px 80px" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "250px minmax(0,1fr)",
              gap: 22,
              alignItems: "start",
            }}
          >
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              onClear={() => setFilters(DEFAULT_FILTERS)}
              availableLanguages={availableLanguages}
            />

            <div style={{ minWidth: 0 }}>
              {isLoading ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 190,
                        height: 11,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.08)",
                      }}
                    />
                    <div
                      style={{
                        width: 130,
                        height: 32,
                        borderRadius: 9,
                        background: "rgba(255,255,255,0.06)",
                      }}
                    />
                  </div>
                  {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
                </div>
              ) : !hasResults && hasSearched ? (
                /* Search returned zero results */
                <GlassCard radius={16}>
                  <div
                    style={{ padding: "52px 24px", textAlign: "center" }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: T.violet,
                        fontSize: 10,
                        marginBottom: 10,
                      }}
                    >
                      // NO RESULTS
                    </div>
                    <h3
                      style={{
                        margin: "0 0 7px",
                        fontFamily: "var(--font-grotesk)",
                        fontSize: 22,
                      }}
                    >
                      No issues found.
                    </h3>
                    <p style={{ margin: 0, color: T.muted, fontSize: 13 }}>
                      Try a different repository or keyword.
                    </p>
                  </div>
                </GlassCard>
              ) : !hasResults ? (
                /* Initial state — nothing searched yet */
                <GlassCard radius={22}>
                  <div style={{ padding: "24px 24px 32px" }}>
                    <EmptyVisual />
                    <div
                      style={{
                        maxWidth: 650,
                        margin: "0 auto",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          color: T.violet,
                          fontFamily: "var(--font-mono)",
                          fontSize: 9.5,
                          marginBottom: 10,
                        }}
                      >
                        <Sparkles size={12} />
                        READY TO TRIAGE
                      </div>

                      <h2
                        style={{
                          margin: "0 0 10px",
                          fontFamily: "var(--font-grotesk)",
                          fontSize: 27,
                          letterSpacing: "-0.04em",
                        }}
                      >
                        Search the open-source ecosystem.
                      </h2>

                      <p
                        style={{
                          margin: "0 auto",
                          maxWidth: 520,
                          color: T.muted,
                          fontSize: 13.5,
                          lineHeight: 1.7,
                        }}
                      >
                        Search words such as
                        <span
                          style={{
                            color: "#C7C2FF",
                            fontFamily: "var(--font-mono)",
                            margin: "0 5px",
                          }}
                        >
                          book
                        </span>
                        ,
                        <span
                          style={{
                            color: "#C7C2FF",
                            fontFamily: "var(--font-mono)",
                            margin: "0 5px",
                          }}
                        >
                          programming
                        </span>
                        or
                        <span
                          style={{
                            color: "#C7C2FF",
                            fontFamily: "var(--font-mono)",
                            margin: "0 5px",
                          }}
                        >
                          react
                        </span>
                        to discover issues across repositories.
                      </p>

                      {/* Suggested search grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
                          gap: 8,
                          marginTop: 32,
                        }}
                      >
                        {SUGGESTED.map((item) => (
                          <motion.button
                            key={item.label}
                            type="button"
                            whileHover={reduce ? undefined : { y: -2 }}
                            onClick={() => {
                              setSearchInput(item.query);
                              fetchIssues(item.query);
                            }}
                            style={{
                              textAlign: "left",
                              padding: "13px 12px",
                              border: `1px solid ${T.border}`,
                              borderRadius: 11,
                              background: "rgba(255,255,255,0.025)",
                              cursor: "pointer",
                              color: T.text,
                            }}
                          >
                            <div
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: item.accent,
                                boxShadow: `0 0 10px ${item.accent}`,
                                marginBottom: 9,
                              }}
                            />
                            <div
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                marginBottom: 3,
                              }}
                            >
                              {item.label}
                            </div>
                            <div
                              style={{
                                color: T.faint,
                                fontFamily: "var(--font-mono)",
                                fontSize: 8,
                              }}
                            >
                              search: {item.query}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  {/* Toolbar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 14,
                      marginBottom: 13,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: T.lime,
                            boxShadow: `0 0 12px ${T.lime}`,
                          }}
                        />
                        <span
                          style={{
                            color: "#C7C2FF",
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                          }}
                        >
                          {repositoryCount}{" "}
                          {repositoryCount === 1 ? "repository" : "repositories"}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: 7,
                          fontFamily: "var(--font-grotesk)",
                          fontSize: 22,
                          fontWeight: 700,
                          letterSpacing: "-0.035em",
                        }}
                      >
                        {filteredIssues.length} issue
                        {filteredIssues.length !== 1 ? "s" : ""} found
                      </div>

                      {isGlobalSearch && (
                        <div
                          style={{
                            marginTop: 4,
                            color: T.faint,
                            fontFamily: "var(--font-mono)",
                            fontSize: 8.5,
                          }}
                        >
                          cross-repository search
                        </div>
                      )}
                    </div>

                    {/* Sort dropdown */}
                    <div ref={sortRef} style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setSortOpen((prev) => !prev)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          height: 36,
                          padding: "0 11px",
                          border: `1px solid ${T.borderBright}`,
                          borderRadius: 9,
                          background: T.glassStrong,
                          color: T.muted,
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 650,
                        }}
                      >
                        <SlidersHorizontal size={13} />
                        {SORT_LABELS[sort]}
                      </button>

                      {sortOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "calc(100% + 7px)",
                            minWidth: 180,
                            padding: 5,
                            borderRadius: 11,
                            border: `1px solid ${T.borderBright}`,
                            background: "rgba(13,16,24,0.96)",
                            backdropFilter: "blur(24px)",
                            WebkitBackdropFilter: "blur(24px)",
                            boxShadow: "0 24px 60px rgba(0,0,0,0.42)",
                            zIndex: 20,
                          }}
                        >
                          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setSort(key);
                                setSortOpen(false);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "9px 10px",
                                border: "none",
                                borderRadius: 7,
                                background:
                                  sort === key ? T.violetDim : "transparent",
                                color: sort === key ? "#D2CDFF" : T.muted,
                                cursor: "pointer",
                                fontSize: 11,
                                fontWeight: sort === key ? 700 : 500,
                              }}
                            >
                              {SORT_LABELS[key]}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* No filter matches */}
                  {filteredIssues.length === 0 ? (
                    <GlassCard radius={16}>
                      <div
                        style={{ padding: "52px 24px", textAlign: "center" }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: T.violet,
                            fontSize: 10,
                            marginBottom: 10,
                          }}
                        >
                          // NO MATCHES
                        </div>
                        <h3
                          style={{
                            margin: "0 0 7px",
                            fontFamily: "var(--font-grotesk)",
                            fontSize: 22,
                          }}
                        >
                          Nothing matches those filters.
                        </h3>
                        <p style={{ margin: 0, color: T.muted, fontSize: 13 }}>
                          Clear one or more filters and try again.
                        </p>
                        <button
                          type="button"
                          onClick={() => setFilters(DEFAULT_FILTERS)}
                          style={{
                            marginTop: 18,
                            padding: "9px 13px",
                            border: "1px solid rgba(155,140,255,0.22)",
                            borderRadius: 8,
                            background: T.violetDim,
                            color: "#D2CDFF",
                            cursor: "pointer",
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    </GlassCard>
                  ) : (
                    filteredIssues.map((issue, index) => {
                      if (!issue.repo) return null;
                      return (
                        <motion.div
                          key={issue.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.45,
                            delay: index * 0.025,
                            ease: EASE,
                          }}
                        >
                          <IssueCard
                            issue={issue}
                            repo={issue.repo}
                            isSaved={savedIds.has(issue.id)}
                            isScoring={scoringIds.has(issue.id)}
                            onSave={() => handleToggleSave(issue.id)}
                            onScore={() => handleScore(issue.id)}
                          />
                        </motion.div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </section>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${T.bg}; }
        input::placeholder { color: ${T.faint}; }
        button { font-family: inherit; }
        ::selection { background: rgba(155,140,255,0.28); color: ${T.text}; }

        @media (max-width: 900px) {
          section { padding-left: 22px !important; padding-right: 22px !important; }
          section > div > div { grid-template-columns: 1fr !important; }
          .filter-sidebar { position: static !important; width: 100% !important; }
        }
        @media (max-width: 700px) {
          section { padding-left: 16px !important; padding-right: 16px !important; }
          form { flex-direction: column !important; }
          form button { width: 100%; }
        }
        @media (max-width: 560px) {
          section { padding-left: 14px !important; padding-right: 14px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
        }
      `}</style>
    </main>
  );
}