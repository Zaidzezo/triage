"use client";

import { useState } from "react";
import {
  Bookmark,
  Check,
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

function formatStars(n: number) {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(
      n >= 10_000 ? 0 : 1
    )}k`;
  }

  return String(n);
}

function timeAgo(date: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) /
      1000
  );

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  if (seconds < 2_592_000) {
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  if (seconds < 31_536_000) {
    return `${Math.floor(
      seconds / 2_592_000
    )}mo ago`;
  }

  return `${Math.floor(
    seconds / 31_536_000
  )}y ago`;
}

const AUTHOR_MAP: Record<string, string> = {
  OWNER: "Owner",
  COLLABORATOR: "Collaborator",
  CONTRIBUTOR: "Contributor",
  MEMBER: "Member",
  NONE: "Random",
};

const DIFF_MAP = {
  easy: {
    color: T.lime,
    label: "Easy",
  },
  medium: {
    color: T.amber,
    label: "Medium",
  },
  hard: {
    color: T.red,
    label: "Hard",
  },
};

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
        padding: "4px 8px",
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

export default function IssueCard({
  issue,
  repo,
  isSaved,
  isScoring,
  onSave,
  onScore,
}: Props) {
  const [expanded, setExpanded] =
    useState(false);

  const reduce = useReducedMotion();

  const hasScore = !!issue.aiScore;

  const difficulty = issue.aiScore
    ? DIFF_MAP[
        issue.aiScore.difficulty
      ]
    : null;

  function handleAiClick() {
    if (!hasScore) {
      onScore();
    }

    setExpanded(
      (previous) => !previous
    );
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
        duration: 0.23,
      }}
      style={{
        position: "relative",
        overflow: "hidden",
        marginBottom: 12,
        borderRadius: 16,
        border:
          `1px solid ${T.border}`,
        background:
          "linear-gradient(145deg, rgba(20,24,35,0.72), rgba(11,14,21,0.70))",
        backdropFilter:
          "blur(20px)",
        WebkitBackdropFilter:
          "blur(20px)",
        boxShadow:
          "0 25px 70px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.055)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents:
            "none",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.035), transparent 32%, rgba(155,140,255,0.025))",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding:
            "18px 19px 16px",
        }}
      >
        {/* TOP ROW */}

        <div
          style={{
            display: "flex",
            alignItems:
              "flex-start",
            justifyContent:
              "space-between",
            gap: 14,
            marginBottom: 13,
          }}
        >
          {/* Repository */}

          <div
            style={{
              minWidth: 0,
              display: "flex",
              alignItems:
                "flex-start",
              gap: 9,
            }}
          >
            <div
              style={{
                width: 31,
                height: 31,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 9,
                background:
                  T.violetDim,
                border:
                  "1px solid rgba(155,140,255,0.20)",
                color: T.violet,
              }}
            >
              <GitBranch size={14} />
            </div>

            <div
              style={{
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 7,
                  flexWrap:
                    "wrap",
                }}
              >
                <span
                  style={{
                    color:
                      "#C7C2FF",
                    fontFamily:
                      "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 650,
                  }}
                >
                  {repo.fullName}
                </span>

                <span
                  style={{
                    color: T.faint,
                    fontFamily:
                      "var(--font-mono)",
                    fontSize: 9,
                  }}
                >
                  #{issue.number}
                </span>

                {!issue.isAssigned && (
                  <Tag
                    color={T.lime}
                    background="rgba(184,243,107,0.07)"
                    border="rgba(184,243,107,0.18)"
                  >
                    <Check size={9} />
                    open contribution
                  </Tag>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 10,
                  marginTop: 5,
                }}
              >
                <MetaItem>
                  <Star
                    size={11}
                    color={T.amber}
                    fill={T.amber}
                  />
                  {formatStars(
                    repo.stars
                  )}
                </MetaItem>

                {repo.language && (
                  <>
                    <span
                      style={{
                        color:
                          T.faint,
                      }}
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

          {/* ACTIONS */}

          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <button
              onClick={onSave}
              aria-label={
                isSaved
                  ? "Remove saved issue"
                  : "Save issue"
              }
              title={
                isSaved
                  ? "Unsave issue"
                  : "Save issue"
              }
              style={{
                width: 31,
                height: 31,
                display: "grid",
                placeItems: "center",
                border:
                  `1px solid ${
                    isSaved
                      ? "rgba(155,140,255,0.28)"
                      : T.border
                  }`,
                borderRadius: 8,
                background:
                  isSaved
                    ? T.violetDim
                    : "rgba(255,255,255,0.02)",
                color:
                  isSaved
                    ? T.violet
                    : T.faint,
                cursor:
                  "pointer",
              }}
            >
              <Bookmark
                size={14}
                fill={
                  isSaved
                    ? "currentColor"
                    : "none"
                }
              />
            </button>

            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open issue on GitHub"
              title="Open on GitHub"
              style={{
                width: 31,
                height: 31,
                display: "grid",
                placeItems: "center",
                border:
                  `1px solid ${T.border}`,
                borderRadius: 8,
                background:
                  "rgba(255,255,255,0.02)",
                color: T.faint,
                textDecoration:
                  "none",
              }}
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* TITLE */}

        <h3
          style={{
            margin: "0 0 7px",
            color: T.text,
            fontFamily:
              "var(--font-grotesk)",
            fontSize: 17,
            lineHeight: 1.32,
            letterSpacing:
              "-0.025em",
            fontWeight: 700,
          }}
        >
          {issue.title}
        </h3>

        {/* BODY */}

        {issue.bodyPreview && (
          <p
            style={{
              margin:
                "0 0 14px",
              color: T.muted,
              fontSize: 11.5,
              lineHeight: 1.65,
              display:
                "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient:
                "vertical",
              overflow:
                "hidden",
            }}
          >
            {issue.bodyPreview}
          </p>
        )}

        {/* META */}

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: 10,
            flexWrap:
              "wrap",
            paddingTop: 2,
          }}
        >
          <MetaItem>
            <MessageSquare
              size={11}
            />
            {issue.commentsCount}
          </MetaItem>

          <span
            style={{
              color: T.faint,
            }}
          >
            ·
          </span>

          <MetaItem>
            <Clock3 size={11} />
            {timeAgo(
              issue.createdAt
            )}
          </MetaItem>

          <span
            style={{
              color: T.faint,
            }}
          >
            ·
          </span>

          <MetaItem>
            <UserRound
              size={11}
            />
            {AUTHOR_MAP[
              issue.authorAssociation
            ] ??
              issue.authorAssociation}
          </MetaItem>

          {hasScore &&
            difficulty && (
              <>
                <span
                  style={{
                    color:
                      T.faint,
                  }}
                >
                  ·
                </span>

                <MetaItem>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius:
                        "50%",
                      background:
                        difficulty.color,
                      boxShadow:
                        `0 0 8px ${difficulty.color}`,
                    }}
                  />

                  {
                    difficulty.label
                  }
                </MetaItem>
              </>
            )}
        </div>

        {/* BOTTOM */}

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: 12,
            flexWrap:
              "wrap",
            marginTop: 15,
            paddingTop: 13,
            borderTop:
              `1px solid ${T.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap:
                "wrap",
            }}
          >
            {!issue.isAssigned && (
              <Tag
                color={T.lime}
                background="rgba(184,243,107,0.06)"
                border="rgba(184,243,107,0.16)"
              >
                good first issue
              </Tag>
            )}

            {issue.isAssigned && (
              <Tag>
                assigned
              </Tag>
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
          </div>

          <motion.button
            onClick={handleAiClick}
            disabled={isScoring}
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
              display:
                "inline-flex",
              alignItems:
                "center",
              gap: 7,
              padding:
                "8px 11px",
              borderRadius: 9,
              border:
                `1px solid ${
                  isScoring
                    ? T.border
                    : "rgba(155,140,255,0.26)"
                }`,
              background:
                isScoring
                  ? "rgba(255,255,255,0.03)"
                  : T.violetDim,
              color:
                isScoring
                  ? T.faint
                  : "#D2CDFF",
              cursor:
                isScoring
                  ? "not-allowed"
                  : "pointer",
              fontSize: 10.5,
              fontWeight: 800,
            }}
          >
            <Sparkles size={12} />

            {isScoring
              ? "Scoring..."
              : hasScore
              ? expanded
                ? "Hide summary"
                : "AI summary"
              : "AI summarize"}
          </motion.button>
        </div>
      </div>

      {/* AI SUMMARY */}

      {hasScore &&
        expanded && (
          <div
            style={{
              borderTop:
                "1px solid rgba(155,140,255,0.14)",
              background:
                "linear-gradient(145deg, rgba(155,140,255,0.055), rgba(255,255,255,0.015))",
            }}
          >
            <div
              style={{
                padding:
                  "15px 19px 17px",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 7,
                  marginBottom:
                    9,
                  color:
                    T.violet,
                  fontFamily:
                    "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing:
                    "0.07em",
                  textTransform:
                    "uppercase",
                }}
              >
                <Sparkles size={11} />
                AI assessment
              </div>

              <p
                style={{
                  margin:
                    "0 0 15px",
                  color:
                    T.muted,
                  fontSize:
                    11.5,
                  lineHeight:
                    1.7,
                }}
              >
                {
                  issue
                    .aiScore!
                    .explanation
                }
              </p>

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    color:
                      T.faint,
                    fontFamily:
                      "var(--font-mono)",
                    fontSize:
                      8.5,
                    textTransform:
                      "uppercase",
                  }}
                >
                  Difficulty
                </span>

                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius:
                      "50%",
                    background:
                      difficulty?.color,
                    boxShadow:
                      difficulty
                        ? `0 0 9px ${difficulty.color}`
                        : undefined,
                  }}
                />

                <span
                  style={{
                    color:
                      difficulty?.color,
                    fontSize:
                      10.5,
                    fontWeight:
                      750,
                  }}
                >
                  {
                    difficulty?.label
                  }
                </span>
              </div>
            </div>
          </div>
        )}
    </motion.article>
  );
}