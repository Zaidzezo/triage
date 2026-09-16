"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";

import IssueCard, { Issue, RepoInfo } from "../components/IssueCard";

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

interface SavedItem {
  savedAt: string;
  issue: Issue & { repo: RepoInfo };
}

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  async function loadSaved(search = "") {
    setLoading(true);
    try {
      const url = search
        ? `/api/saved?q=${encodeURIComponent(search)}`
        : "/api/saved";
      const response = await fetch(url);
      const data = await response.json();
      const items: SavedItem[] = Array.isArray(data.saved) ? data.saved : [];
      setSaved(items);
      // Only update total count when not filtering, so the heading stays accurate
      if (!search) {
        setTotalCount(items.length);
      }
    } finally {
      setLoading(false);
    }
  }

  // Load saved issues on mount
  useEffect(() => {
    loadSaved();
  }, []);

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setQuery(value);
    // Debounce — avoid firing a request on every keystroke
    clearTimeout(debounceRef.current ?? undefined);
    debounceRef.current = setTimeout(() => loadSaved(value), 300);
  }

  async function handleRemove(issueId: string) {
    // Optimistic update
    setSaved((prev) => prev.filter((item) => item.issue.id !== issueId));
    if (!query) {
      setTotalCount((prev) => Math.max(0, prev - 1));
    }

    try {
      const response = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });
      if (!response.ok) {
        // Server rejected — restore accurate state
        loadSaved(query);
      }
    } catch {
      // Network error — restore accurate state
      loadSaved(query);
    }
  }

  const countText = `${totalCount} saved issue${totalCount !== 1 ? "s" : ""}`;

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
      {/* No <Navbar /> here — layout.tsx renders it globally */}

      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "58px 28px 90px",
        }}
      >
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
            <Bookmark size={11} />
            YOUR SAVED WORK
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
            Issues worth
            <br />
            <span style={{ color: T.violet }}>coming back to.</span>
          </h1>

          <p style={{ margin: 0, color: T.muted, fontSize: 13.5, lineHeight: 1.7 }}>
            {countText}
          </p>
        </motion.div>

        {/* Search */}
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
            onChange={handleSearchChange}
            placeholder="Search your saved issues..."
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
        {loading ? (
          <div
            style={{
              color: T.faint,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
            }}
          >
            // loading saved issues...
          </div>
        ) : saved.length === 0 && !query ? (
          /* True empty state — nothing saved yet */
          <div
            style={{
              padding: "70px 30px",
              textAlign: "center",
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              background: "rgba(18,22,32,0.52)",
            }}
          >
            <Bookmark
              size={24}
              color={T.violet}
              style={{ marginBottom: 12 }}
            />
            <h2
              style={{
                margin: "0 0 7px",
                fontFamily: "var(--font-grotesk)",
                fontSize: 24,
              }}
            >
              Nothing saved yet.
            </h2>
            <p style={{ margin: "0 0 20px", color: T.muted, fontSize: 12.5 }}>
              Save promising issues from Discover and they'll appear here.
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
        ) : saved.length === 0 && query ? (
          /* No search results */
          <div
            style={{
              padding: "52px 30px",
              textAlign: "center",
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              background: "rgba(18,22,32,0.52)",
            }}
          >
            <p
              style={{
                margin: "0 0 6px",
                fontFamily: "var(--font-mono)",
                color: T.violet,
                fontSize: 10,
              }}
            >
              // NO MATCHES
            </p>
            <h2
              style={{
                margin: "0 0 7px",
                fontFamily: "var(--font-grotesk)",
                fontSize: 22,
              }}
            >
              No saved issues match "{query}".
            </h2>
            <p style={{ margin: 0, color: T.muted, fontSize: 12.5 }}>
              Try a different search term.
            </p>
          </div>
        ) : (
          <div>
            {saved.map((item) => (
              <IssueCard
                key={item.issue.id}
                issue={item.issue}
                repo={item.issue.repo}
                isSaved
                isScoring={false}
                onSave={() => handleRemove(item.issue.id)}
                onScore={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}