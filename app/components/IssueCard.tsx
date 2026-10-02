"use client";

import { useState } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  GitBranch,
  MessageSquare,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const T = {
  bg: "#08090D",
  glass: "rgba(18, 22, 32, 0.58)",
  glassStrong: "rgba(20, 25, 37, 0.78)",

  border: "rgba(255,255,255,0.08)",
  borderBright: "rgba(255,255,255,0.14)",

  text: "#F5F7FB",
  muted: "#9299A8",
  faint: "#565D6C",

  violet: "#9B8CFF",
  violetDim: "rgba(155,140,255,0.11)",

  lime: "#B8F36B",
  amber: "#FFC978",
  red: "#FF8E9E",
};

export interface AiScore {
  difficulty: "easy" | "medium" | "hard";
  explanation: string;
}

export interface RepoInfo {
  fullName: string;
  stars: number;
  language: string | null;
  description: string | null;
}

export interface Issue {
  id: string;
  githubIssueId?: string;
  number: number;
  title: string;
  url: string;
  bodyPreview: string | null;
  state: string;
  authorAssociation: string;
  commentsCount: number;
  isAssigned: boolean;
  hasLinkedPr: boolean;
  createdAt: string;
  aiScore: AiScore | null;
  repo?: RepoInfo;
}

interface Props {
  issue: Issue;
  repo: RepoInfo;
  isSaved: boolean;
  isScoring: boolean;
  onSave: () => void;
  onScore: () => void;
}

function formatStars(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }

  return String(value);
}

function timeAgo(date: string) {
  const timestamp = new Date(date).getTime();

  if (!Number.isFinite(timestamp)) {
    return "recently";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2_592_000) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 31_536_000) {
    return `${Math.floor(seconds / 2_592_000)}mo ago`;
  }

  return `${Math.floor(seconds / 31_536_000)}y ago`;
}

const AUTHOR_MAP: Record<string, string> = {
  OWNER: "Owner",
  COLLABORATOR: "Collaborator",
  CONTRIBUTOR: "Contributor",
  MEMBER: "Member",
  NONE: "Random",
};

const DIFFICULTY = {
  easy: {
    label: "Easy",
    color: T.lime,
    background: "rgba(184,243,107,0.07)",
    border: "rgba(184,243,107,0.17)",
  },
  medium: {
    label: "Medium",
    color: T.amber,
    background: "rgba(255,201,120,0.07)",
    border: "rgba(255,201,120,0.17)",
  },
  hard: {
    label: "Hard",
    color: T.red,
    background: "rgba(255,142,158,0.07)",
    border: "rgba(255,142,158,0.17)",
  },
} as const;

function MetaItem({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: T.muted,
        fontSize: 10.5,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

function Tag({
  children,
  color = T.muted,
  background = "rgba(255,255,255,0.03)",
  border = T.border,
}: {
  children: React.ReactNode;
  color?: string;
  background?: string;
  border?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        minHeight: 24,
        padding: "0 8px",
        borderRadius: 999,
        background,
        border: `1px solid ${border}`,
        color,
        fontSize: 9.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ActionButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        display: "grid",
        placeItems: "center",
        border: `1px solid ${
          active
            ? "rgba(155,140,255,0.28)"
            : T.border
        }`,
        borderRadius: 9,
        background: active
          ? T.violetDim
          : "rgba(255,255,255,0.025)",
        color: active
          ? T.violet
          : T.faint,
        cursor: disabled
          ? "not-allowed"
          : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition:
          "background 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease",
      }}
      onMouseEnter={(event) => {
        if (disabled) return;
        event.currentTarget.style.borderColor =
          "rgba(155,140,255,0.28)";
        event.currentTarget.style.background =
          active
            ? T.violetDim
            : "rgba(255,255,255,0.05)";
        event.currentTarget.style.color =
          active
            ? "#CFC9FF"
            : T.text;
      }}
      onMouseLeave={(event) => {
        if (disabled) return;
        event.currentTarget.style.borderColor =
          active
            ? "rgba(155,140,255,0.28)"
            : T.border;
        event.currentTarget.style.background =
          active
            ? T.violetDim
            : "rgba(255,255,255,0.025)";
        event.currentTarget.style.color =
          active
            ? T.violet
            : T.faint;
      }}
    >
      {children}
    </button>
  );
}

export default function IssueCard({
  issue,
  repo,
  isSaved,
  isScoring,
  onSave,
  onScore,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const reduce = useReducedMotion();

  const score = issue.aiScore;
  const difficulty = score
    ? DIFFICULTY[score.difficulty]
    : null;

  function handleAiClick() {
    if (!score && !isScoring) {
      onScore();
      setExpanded(true);
      return;
    }

    if (score) {
      setExpanded((previous) => !previous);
    }
  }

  return (
    <motion.article
      layout
      whileHover={
        reduce
          ? undefined
          : { y: -2 }
      }
      transition={{
        duration: 0.22,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{
        position: "relative",
        overflow: "hidden",
        marginBottom: 12,
        borderRadius: 17,
        border: `1px solid ${T.border}`,
        background:
          "linear-gradient(145deg, rgba(22,26,37,0.78), rgba(10,13,20,0.78))",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow:
          "0 24px 70px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.055)",
      }}
    >
      {/* Accent line */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          top: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(155,140,255,0.28), transparent)",
          pointerEvents: "none",
        }}
      />

      {/* Ambient surface */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 90% 0%, rgba(155,140,255,0.055), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.035), transparent 35%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "19px 19px 16px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <div
              aria-hidden
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 9,
                background: T.violetDim,
                border:
                  "1px solid rgba(155,140,255,0.2)",
                color: T.violet,
              }}
            >
              <GitBranch size={14} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  flexWrap: "wrap",
                }}
              >
                <a
                  href={`https://github.com/${repo.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    maxWidth: "100%",
                    color: "#C9C4FF",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 650,
                    textDecoration: "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {repo.fullName}
                </a>

                <span
                  style={{
                    color: T.faint,
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                  }}
                >
                  #{issue.number}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                <MetaItem>
                  <Star
                    size={11}
                    color={T.amber}
                    fill={T.amber}
                  />
                  {formatStars(repo.stars)}
                </MetaItem>

                {repo.language && (
                  <>
                    <span
                      aria-hidden
                      style={{ color: T.faint }}
                    >
                      ·
                    </span>

                    <MetaItem>
                      {repo.language}
                    </MetaItem>
                  </>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <ActionButton
              label={
                isSaved
                  ? "Remove saved issue"
                  : "Save issue"
              }
              active={isSaved}
              onClick={onSave}
            >
              <Bookmark
                size={14}
                fill={
                  isSaved
                    ? "currentColor"
                    : "none"
                }
              />
            </ActionButton>

            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open issue on GitHub"
              title="Open on GitHub"
              style={{
                width: 34,
                height: 34,
                display: "grid",
                placeItems: "center",
                border: `1px solid ${T.border}`,
                borderRadius: 9,
                background:
                  "rgba(255,255,255,0.025)",
                color: T.faint,
                textDecoration: "none",
                transition:
                  "background 150ms ease, border-color 150ms ease, color 150ms ease",
              }}
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Title */}
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            margin: "15px 0 7px",
            color: T.text,
            fontFamily: "var(--font-grotesk)",
            fontSize: 18,
            lineHeight: 1.3,
            letterSpacing: "-0.028em",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {issue.title}
        </a>

        {/* Body */}
        {issue.bodyPreview && (
          <p
            style={{
              margin: "0 0 14px",
              color: T.muted,
              fontSize: 11.5,
              lineHeight: 1.68,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {issue.bodyPreview}
          </p>
        )}

        {/* Contribution signal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginBottom: 13,
          }}
        >
          {!issue.isAssigned ? (
            <Tag
              color={T.lime}
              background="rgba(184,243,107,0.06)"
              border="rgba(184,243,107,0.16)"
            >
              <Check size={9} />
              unassigned
            </Tag>
          ) : (
            <Tag>assigned</Tag>
          )}

          {issue.hasLinkedPr && (
            <Tag
              color="#8FC7FF"
              background="rgba(143,199,255,0.06)"
              border="rgba(143,199,255,0.16)"
            >
              linked PR
            </Tag>
          )}

          {difficulty && (
            <Tag
              color={difficulty.color}
              background={difficulty.background}
              border={difficulty.border}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: difficulty.color,
                  boxShadow: `0 0 8px ${difficulty.color}`,
                }}
              />
              {difficulty.label}
            </Tag>
          )}
        </div>

        {/* Metadata */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            paddingTop: 13,
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <MetaItem>
            <MessageSquare size={11} />
            {issue.commentsCount}
          </MetaItem>

          <span aria-hidden style={{ color: T.faint }}>
            ·
          </span>

          <MetaItem>
            <Clock3 size={11} />
            {timeAgo(issue.createdAt)}
          </MetaItem>

          <span aria-hidden style={{ color: T.faint }}>
            ·
          </span>

          <MetaItem>
            <UserRound size={11} />
            {AUTHOR_MAP[issue.authorAssociation] ??
              issue.authorAssociation}
          </MetaItem>

          <div style={{ flex: 1 }} />

          <motion.button
            type="button"
            onClick={handleAiClick}
            disabled={isScoring}
            aria-expanded={expanded}
            whileHover={
              reduce || isScoring
                ? undefined
                : { y: -1 }
            }
            whileTap={
              reduce || isScoring
                ? undefined
                : { scale: 0.985 }
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              minHeight: 32,
              padding: "0 10px",
              borderRadius: 9,
              border: `1px solid ${
                isScoring
                  ? T.border
                  : "rgba(155,140,255,0.24)"
              }`,
              background: isScoring
                ? "rgba(255,255,255,0.025)"
                : T.violetDim,
              color: isScoring
                ? T.faint
                : "#D2CDFF",
              cursor: isScoring
                ? "not-allowed"
                : "pointer",
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            <Sparkles size={12} />

            {isScoring
              ? "Analyzing"
              : score
                ? "AI assessment"
                : "Analyze issue"}

            {score && (
              <ChevronDown
                size={12}
                style={{
                  transform: expanded
                    ? "rotate(180deg)"
                    : "rotate(0deg)",
                  transition:
                    "transform 160ms ease",
                }}
              />
            )}
          </motion.button>
        </div>
      </div>

      {/* AI assessment */}
      {score && expanded && (
        <div
          style={{
            borderTop:
              "1px solid rgba(155,140,255,0.15)",
            background:
              "linear-gradient(145deg, rgba(155,140,255,0.055), rgba(255,255,255,0.012))",
          }}
        >
          <div
            style={{
              padding: "16px 19px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginBottom: 10,
                color: T.violet,
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <Sparkles size={11} />
              Triage assessment
            </div>

            <p
              style={{
                margin: 0,
                color: T.muted,
                fontSize: 11.5,
                lineHeight: 1.72,
              }}
            >
              {score.explanation}
            </p>

            {difficulty && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 15,
                  paddingTop: 12,
                  borderTop: `1px solid ${T.border}`,
                }}
              >
                <span
                  style={{
                    color: T.faint,
                    fontFamily: "var(--font-mono)",
                    fontSize: 8.5,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Estimated difficulty
                </span>

                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: difficulty.color,
                    boxShadow: `0 0 9px ${difficulty.color}`,
                  }}
                />

                <span
                  style={{
                    color: difficulty.color,
                    fontSize: 10.5,
                    fontWeight: 750,
                  }}
                >
                  {difficulty.label}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.article>
  );
}