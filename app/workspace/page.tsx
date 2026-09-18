"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, GripVertical, LayoutDashboard, Search, X } from "lucide-react";
import { motion, useDragControls } from "framer-motion";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";

import type { Issue, RepoInfo } from "../components/IssueCard";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const T = {
  bg: "#08090D",
  border: "rgba(255,255,255,0.09)",
  borderBright: "rgba(255,255,255,0.15)",
  text: "#F5F7FB",
  muted: "#9299A8",
  faint: "#565D6C",
  violet: "#9B8CFF",
  violetDim: "rgba(155,140,255,0.12)",
};

type Status = "SAVED" | "PLANNED" | "IN_PROGRESS" | "COMPLETED";

interface SavedItem {
  savedAt: string;
  status: Status;
  issue: Issue & { repo: RepoInfo };
}

const STATUSES: { id: Status; label: string; color: string; dim: string }[] = [
  { id: "SAVED",       label: "Saved",       color: "#9B8CFF", dim: "rgba(155,140,255,0.10)" },
  { id: "PLANNED",     label: "Planned",     color: "#7DD3FC", dim: "rgba(125,211,252,0.10)" },
  { id: "IN_PROGRESS", label: "In Progress", color: "#FBBF24", dim: "rgba(251,191,36,0.10)" },
  { id: "COMPLETED",   label: "Completed",   color: "#34D399", dim: "rgba(52,211,153,0.10)" },
];

function matches(item: SavedItem, q: string) {
  const s = q.toLowerCase();
  const body = (item.issue as { bodyPreview?: string }).bodyPreview ?? "";
  return (
    item.issue.title.toLowerCase().includes(s) ||
    body.toLowerCase().includes(s) ||
    item.issue.repo.fullName.toLowerCase().includes(s)
  );
}

export default function WorkspacePage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const columnRefs = useRef<Partial<Record<Status, HTMLDivElement | null>>>({});

  // Load all tracked issues once — filtering and drag & drop are client-side
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/workspace");
        const data = await res.json();
        setItems(Array.isArray(data.saved) ? data.saved : []);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  function columnAtPoint(x: number, y: number): Status | null {
    for (const s of STATUSES) {
      const el = columnRefs.current[s.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return s.id;
    }
    return null;
  }

  async function setStatus(issueId: string, status: Status) {
    const snapshot = items;
    setItems((prev) => prev.map((it) => (it.issue.id === issueId ? { ...it, status } : it)));
    try {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(snapshot); // server rejected — roll back
    }
  }

  async function handleRemove(issueId: string) {
    const snapshot = items;
    setItems((prev) => prev.filter((it) => it.issue.id !== issueId));
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems(snapshot); // network/server error — restore
    }
  }

  const q = query.trim();
  const visible = q ? items.filter((it) => matches(it, q)) : items;
  const completed = items.filter((it) => it.status === "COMPLETED").length;
  const countText = `${items.length} issue${items.length !== 1 ? "s" : ""} tracked · ${completed} completed`;

  return (
    <main
      className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}
      style={{
        minHeight: "100vh",
        color: T.text,
        background: `radial-gradient(circle at 50% -10%, rgba(155,140,255,0.08), transparent 36%), ${T.bg}`,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "58px 28px 90px" }}>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 10px",
              borderRadius: 999,
              background: T.violetDim,
              border: "1px solid rgba(155,140,255,0.20)",
              color: "#C9C4FF",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.08em",
            }}
          >
            <LayoutDashboard size={11} />
            MY CONTRIBUTIONS
          </div>

          <h1
            style={{
              margin: "17px 0 9px",
              fontFamily: "var(--font-grotesk)",
              fontSize: "clamp(42px, 5vw, 62px)",
              lineHeight: 0.98,
              letterSpacing: "-0.055em",
            }}
          >
            Your workspace,
            <br />
            <span style={{ color: T.violet }}>issue by issue.</span>
          </h1>

          <p style={{ margin: 0, color: T.muted, fontSize: 13.5, lineHeight: 1.7 }}>
            {countText}
          </p>
        </motion.div>

        {/* Search — client-side filter, no debounce needed */}
        <div
          style={{
            marginTop: 30,
            marginBottom: 24,
            height: 46,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "0 13px",
            borderRadius: 11,
            border: `1px solid ${T.borderBright}`,
            background: "rgba(20,25,37,0.68)",
          }}
        >
          <Search size={15} color={T.faint} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your tracked issues..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: T.text,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
            }}
          />
        </div>

        {/* States */}
        {!loaded ? (
          <div style={{ color: T.faint, fontFamily: "var(--font-mono)", fontSize: 10 }}>
            // loading workspace...
          </div>
        ) : items.length === 0 && !q ? (
          <div
            style={{
              padding: "70px 30px",
              textAlign: "center",
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              background: "rgba(18,22,32,0.52)",
            }}
          >
            <Bookmark size={24} color={T.violet} style={{ marginBottom: 12 }} />
            <h2 style={{ margin: "0 0 7px", fontFamily: "var(--font-grotesk)", fontSize: 24 }}>
              Nothing tracked yet.
            </h2>
            <p style={{ margin: "0 0 20px", color: T.muted, fontSize: 12.5 }}>
              Save promising issues from Discover and organize them here.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                borderRadius: 9,
                background: T.violetDim,
                border: "1px solid rgba(155,140,255,0.22)",
                color: "#D2CDFF",
                textDecoration: "none",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Go to Discover
            </Link>
          </div>
        ) : visible.length === 0 && q ? (
          <div
            style={{
              padding: "52px 30px",
              textAlign: "center",
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              background: "rgba(18,22,32,0.52)",
            }}
          >
            <p style={{ margin: "0 0 6px", fontFamily: "var(--font-mono)", color: T.violet, fontSize: 10 }}>
              // NO MATCHES
            </p>
            <h2 style={{ margin: "0 0 7px", fontFamily: "var(--font-grotesk)", fontSize: 22 }}>
              No tracked issues match "{query}".
            </h2>
            <p style={{ margin: 0, color: T.muted, fontSize: 12.5 }}>Try a different search term.</p>
          </div>
        ) : (
          /* Board */
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              overflowX: "auto",
              paddingBottom: 10,
            }}
          >
            {STATUSES.map((s) => {
              const colItems = visible.filter((it) => it.status === s.id);
              const active = draggingId !== null && dragOver === s.id;
              return (
                <section key={s.id} style={{ flex: "0 0 262px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <header style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 2px" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: s.color }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", color: T.text }}>
                      {s.label.toUpperCase()}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        color: T.muted,
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${T.border}`,
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      {colItems.length}
                    </span>
                  </header>

                  {/* Drop zone — ref used for hit-testing during drag */}
                  <div
                    ref={(el) => {
                      columnRefs.current[s.id] = el;
                    }}
                    className="scroll-dark"
                    style={{
                      height: "calc(100vh - 330px)",
                      minHeight: 320,
                      overflowY: "auto",
                      borderRadius: 14,
                      border: `1px dashed ${active ? s.color : "transparent"}`,
                      background: active ? s.dim : "rgba(18,22,32,0.40)",
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      transition: "border-color 120ms ease, background 120ms ease",
                    }}
                  >
                    {colItems.length === 0 ? (
                      <div
                        style={{
                          color: T.faint,
                          fontFamily: "var(--font-mono)",
                          fontSize: 9.5,
                          textAlign: "center",
                          padding: "28px 6px",
                        }}
                      >
                        // drop issues here
                      </div>
                    ) : (
                      colItems.map((it) => (
                        <WorkspaceCard
                          key={it.issue.id}
                          item={it}
                          dragging={draggingId === it.issue.id}
                          onRemove={() => handleRemove(it.issue.id)}
                          onDragStart={() => setDraggingId(it.issue.id)}
                          onDragMove={(x, y) => setDragOver(columnAtPoint(x, y))}
                          onDragEnd={(x, y) => {
                            const target = columnAtPoint(x, y);
                            if (target && target !== it.status) {
                              setStatus(it.issue.id, target);
                            }
                            setDraggingId(null);
                            setDragOver(null);
                          }}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function WorkspaceCard({
  item,
  dragging,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  item: SavedItem;
  dragging: boolean;
  onRemove: () => void;
  onDragStart: () => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  // Drag starts only from the grip handle — this keeps page scroll
  // and text selection working on touch devices everywhere else
  const controls = useDragControls();
  const issue = item.issue;

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragElastic={0}
      dragSnapToOrigin
      onDragStart={onDragStart}
      onDrag={(_, info) => onDragMove(info.point.x, info.point.y)}
      onDragEnd={(_, info) => onDragEnd(info.point.x, info.point.y)}
      animate={dragging ? { scale: 1.04, rotate: 1.2, opacity: 0.96 } : { scale: 1, rotate: 0, opacity: 1 }}
      style={{
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        background: "#10131B",
        padding: "11px 11px 10px",
        zIndex: dragging ? 40 : undefined,
        boxShadow: dragging ? "0 18px 44px rgba(0,0,0,0.5)" : "0 1px 0 rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
          title="Drag to move"
          style={{
            display: "inline-flex",
            color: T.faint,
            cursor: "grab",
            touchAction: "none",
            marginLeft: -2,
          }}
        >
          <GripVertical size={13} />
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: T.violet,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {issue.repo.fullName}
        </span>
        <button
          onClick={onRemove}
          title="Remove from workspace"
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: T.faint,
            cursor: "pointer",
            padding: 2,
            display: "inline-flex",
          }}
        >
          <X size={12} />
        </button>
      </div>

      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        style={{
          margin: "7px 0 9px",
          color: T.text,
          textDecoration: "none",
          fontSize: 12,
          lineHeight: 1.5,
          fontWeight: 600,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {issue.title}
      </a>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: T.faint,
        }}
      >
        <span>#{issue.number}</span>
        {issue.aiScore?.difficulty && (
          <span style={{ color: T.muted }}>· {issue.aiScore.difficulty}</span>
        )}
        <span style={{ marginLeft: "auto" }}>
          {new Date(item.savedAt).toLocaleDateString()}
        </span>
      </div>
    </motion.div>
  );
}