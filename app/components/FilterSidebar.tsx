"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Code2,
  Filter,
  GitPullRequest,
  MessageSquare,
  RotateCcw,
  Star,
  UserRound,
} from "lucide-react";

const T = {
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

export interface Filters {
  difficulty:
    | "any"
    | "easy"
    | "medium"
    | "hard";

  comments:
    | "any"
    | "none"
    | "1-5"
    | "6-20"
    | "20+";

  assigned:
    | "any"
    | "unassigned";

  linkedPr:
    | "any"
    | "has-pr"
    | "no-pr";

  authorType: string[];

  stars: "any" | number;
  starsMax: "any" | number;

  language: string;

  date:
    | "any"
    | "day"
    | "week"
    | "month";
}

export const DEFAULT_FILTERS: Filters = {
  difficulty: "any",
  comments: "any",
  assigned: "any",
  linkedPr: "any",
  authorType: [],
  stars: "any",
  starsMax: "any",
  language: "any",
  date: "any",
};

const STAR_PRESETS = [
  { value: 5000, label: "5k+" },
  { value: 10000, label: "10k+" },
  { value: 25000, label: "25k+" },
];

const SLIDER_MIN = 1000;
const SLIDER_MAX = 50000;
const SLIDER_STEP = 1000;
const SLIDER_GAP = 4000;
const THUMB = 14;

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClear: () => void;
  availableLanguages: string[];
  isGlobalSearch: boolean;
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        padding: "0 0 12px",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{
          width: "100%",
          minHeight: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 0,
          border: "none",
          background: "transparent",
          color: T.text,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              display: "grid",
              placeItems: "center",
              borderRadius: 7,
              background: "rgba(255,255,255,0.025)",
              color: T.faint,
            }}
          >
            {icon}
          </span>

          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
            }}
          >
            {title}
          </span>
        </span>

        <ChevronDown
          size={13}
          color={T.faint}
          style={{
            transform: open
              ? "rotate(180deg)"
              : "rotate(0deg)",
            transition: "transform 180ms ease",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            paddingTop: 4,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Radio({
  label,
  checked,
  onChange,
  color,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  color?: string;
}) {
  const accent = color ?? T.violet;

  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      style={{
        width: "100%",
        minHeight: 30,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 0",
        border: "none",
        background: "transparent",
        color: checked ? T.text : T.muted,
        cursor: "pointer",
        textAlign: "left",
        fontSize: 10.5,
        transition:
          "color 150ms ease",
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          border: `1px solid ${
            checked
              ? accent
              : "rgba(255,255,255,0.15)"
          }`,
          background: checked
            ? `${accent}16`
            : "transparent",
        }}
      >
        {checked && (
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
            }}
          />
        )}
      </span>

      {label}
    </button>
  );
}

function CheckFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      style={{
        width: "100%",
        minHeight: 30,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 0",
        border: "none",
        background: "transparent",
        color: checked ? T.text : T.muted,
        cursor: "pointer",
        textAlign: "left",
        fontSize: 10.5,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: 4,
          border: `1px solid ${
            checked
              ? T.violet
              : "rgba(255,255,255,0.15)"
          }`,
          background: checked
            ? T.violet
            : "transparent",
          color: "#08090D",
          fontSize: 9,
          fontWeight: 900,
        }}
      >
        {checked && (
          <Check
            size={9}
            strokeWidth={3}
          />
        )}
      </span>

      {label}
    </button>
  );
}

export default function FilterSidebar({
  filters,
  onChange,
  onClear,
  availableLanguages,
  isGlobalSearch,
}: Props) {
  const set = <K extends keyof Filters>(
    key: K,
    value: Filters[K]
  ) => {
    onChange({
      ...filters,
      [key]: value,
    });
  };

  const minValue =
    typeof filters.stars === "number"
      ? filters.stars
      : SLIDER_MIN;

  const maxValue =
    typeof filters.starsMax === "number"
      ? filters.starsMax
      : SLIDER_MAX;

  const isPreset =
    typeof filters.stars === "number" &&
    filters.starsMax === "any" &&
    STAR_PRESETS.some(
      (preset) =>
        preset.value === filters.stars
    );

  const customActive =
    (filters.stars !== "any" ||
      filters.starsMax !== "any") &&
    !isPreset;

  const span =
    SLIDER_MAX - SLIDER_MIN;

  const pMin =
    ((minValue - SLIDER_MIN) / span) * 100;

  const pMax =
    ((maxValue - SLIDER_MIN) / span) * 100;

  const handleMinChange = (raw: number) => {
    const next = Math.min(
      raw,
      maxValue - SLIDER_GAP
    );

    set(
      "stars",
      next <= SLIDER_MIN
        ? "any"
        : next
    );
  };

  const handleMaxChange = (raw: number) => {
    const next = Math.max(
      raw,
      minValue + SLIDER_GAP
    );

    set(
      "starsMax",
      next >= SLIDER_MAX
        ? "any"
        : next
    );
  };

  const hasActive =
    filters.difficulty !== "any" ||
    filters.comments !== "any" ||
    filters.assigned !== "any" ||
    filters.linkedPr !== "any" ||
    filters.authorType.length > 0 ||
    filters.stars !== "any" ||
    filters.starsMax !== "any" ||
    filters.language !== "any" ||
    filters.date !== "any";

  const activeCount =
    Number(
      filters.difficulty !== "any"
    ) +
    Number(
      filters.comments !== "any"
    ) +
    Number(
      filters.assigned !== "any"
    ) +
    Number(
      filters.linkedPr !== "any"
    ) +
    Number(
      filters.authorType.length > 0
    ) +
    Number(
      filters.stars !== "any" ||
        filters.starsMax !== "any"
    ) +
    Number(
      filters.language !== "any"
    ) +
    Number(
      filters.date !== "any"
    );

  return (
    <aside
      className="filter-sidebar"
      style={{
        width: 258,
        flexShrink: 0,
        position: "sticky",
        top: 84,
        alignSelf: "flex-start",
      }}
    >
      <style>{`
        .filter-sidebar button:hover {
          color: ${T.text} !important;
        }

        .stars-range {
          position: absolute;
          inset: 0;
          width: 100%;
          height: ${THUMB}px;
          margin: 0;
          padding: 0;
          background: transparent;
          pointer-events: none;
          appearance: none;
          -webkit-appearance: none;
        }

        .stars-range:focus {
          outline: none;
        }

        .stars-range::-webkit-slider-runnable-track {
          height: ${THUMB}px;
          background: transparent;
          border: none;
        }

        .stars-range::-moz-range-track {
          height: ${THUMB}px;
          background: transparent;
          border: none;
        }

        .stars-range::-webkit-slider-thumb {
          appearance: none;
          -webkit-appearance: none;
          box-sizing: border-box;
          width: ${THUMB}px;
          height: ${THUMB}px;
          border-radius: 50%;
          background: ${T.violet};
          border: 2px solid #08090D;
          box-shadow: 0 0 9px rgba(155,140,255,0.5);
          cursor: pointer;
          pointer-events: auto;
        }

        .stars-range::-moz-range-thumb {
          box-sizing: border-box;
          width: ${THUMB}px;
          height: ${THUMB}px;
          border-radius: 50%;
          background: ${T.violet};
          border: 2px solid #08090D;
          box-shadow: 0 0 9px rgba(155,140,255,0.5);
          cursor: pointer;
          pointer-events: auto;
        }

        .stars-range:focus-visible::-webkit-slider-thumb {
          box-shadow:
            0 0 0 3px rgba(155,140,255,0.25),
            0 0 10px rgba(155,140,255,0.5);
        }

        .stars-range:focus-visible::-moz-range-thumb {
          box-shadow:
            0 0 0 3px rgba(155,140,255,0.25),
            0 0 10px rgba(155,140,255,0.5);
        }

        .filter-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(155,140,255,0.28) transparent;
        }

        .filter-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .filter-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .filter-scroll::-webkit-scrollbar-thumb {
          background: rgba(155,140,255,0.24);
          border-radius: 999px;
        }

        .filter-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(155,140,255,0.44);
        }

        @media (max-width: 980px) {
          .filter-sidebar {
            width: 100% !important;
            position: relative !important;
            top: auto !important;
          }

          .filter-scroll {
            max-height: 440px !important;
          }
        }

        @media (max-width: 640px) {
          .filter-scroll {
            max-height: none !important;
          }
        }
      `}</style>

      <div
        className="filter-scroll"
        style={{
          maxHeight:
            "calc(100vh - 100px)",
          overflowY: "auto",
          padding: "13px 15px 7px",
          border:
            `1px solid ${T.border}`,
          borderRadius: 16,
          background:
            "linear-gradient(145deg, rgba(17,21,30,0.78), rgba(11,14,21,0.72))",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter:
            "blur(22px)",
          boxShadow:
            "0 24px 70px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.045)",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            minHeight: 36,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 29,
                height: 29,
                display: "grid",
                placeItems: "center",
                borderRadius: 8,
                background: T.violetDim,
                border:
                  "1px solid rgba(155,140,255,0.18)",
                color: T.violet,
              }}
            >
              <Filter size={13} />
            </span>

            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span
                  style={{
                    color: T.text,
                    fontFamily:
                      "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing:
                      "0.08em",
                    textTransform:
                      "uppercase",
                  }}
                >
                  Filters
                </span>

                {activeCount > 0 && (
                  <span
                    style={{
                      minWidth: 17,
                      height: 17,
                      padding: "0 5px",
                      display: "inline-grid",
                      placeItems: "center",
                      borderRadius: 999,
                      background:
                        T.violetDim,
                      border:
                        "1px solid rgba(155,140,255,0.18)",
                      color: "#D2CDFF",
                      fontFamily:
                        "var(--font-mono)",
                      fontSize: 8,
                      fontWeight: 800,
                    }}
                  >
                    {activeCount}
                  </span>
                )}
              </div>

              <div
                style={{
                  marginTop: 2,
                  color: T.faint,
                  fontSize: 8.5,
                }}
              >
                Narrow the issue set
              </div>
            </div>
          </div>

          {hasActive && (
            <button
              type="button"
              onClick={onClear}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 7px",
                border: "none",
                borderRadius: 7,
                background:
                  "transparent",
                color: T.violet,
                cursor: "pointer",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              <RotateCcw size={10} />
              Reset
            </button>
          )}
        </div>

        {/* STARS */}

        <Section
          title="Repository stars"
          icon={<Star size={12} />}
        >
          {STAR_PRESETS.map((preset) => (
            <Radio
              key={preset.value}
              label={preset.label}
              checked={
                filters.stars ===
                  preset.value &&
                filters.starsMax ===
                  "any"
              }
              onChange={() =>
                onChange({
                  ...filters,
                  stars: preset.value,
                  starsMax: "any",
                })
              }
            />
          ))}

          <div
            style={{
              marginTop: 9,
              padding: "10px 10px 9px",
              borderRadius: 10,
              border:
                `1px solid ${
                  customActive
                    ? "rgba(155,140,255,0.22)"
                    : T.border
                }`,
              background:
                "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  color: T.muted,
                  fontSize: 9.5,
                  fontWeight: 650,
                }}
              >
                Custom range
              </span>

              <span
                style={{
                  color: customActive
                    ? "#C7C2FF"
                    : T.faint,
                  fontFamily:
                    "var(--font-mono)",
                  fontSize: 8.5,
                }}
              >
                {customActive
                  ? `${minValue / 1000}k – ${maxValue / 1000}k`
                  : "not set"}
              </span>
            </div>

            <div
              style={{
                position: "relative",
                height: THUMB,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top:
                    (THUMB - 4) / 2,
                  height: 4,
                  borderRadius: 99,
                  background:
                    "rgba(255,255,255,0.09)",
                }}
              />

              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top:
                    (THUMB - 4) / 2,
                  height: 4,
                  borderRadius: 99,
                  left:
                    `calc(${pMin}% + ${
                      (0.5 -
                        pMin / 100) *
                      THUMB
                    }px)`,
                  right:
                    `calc(${
                      100 - pMax
                    }% + ${
                      (pMax / 100 -
                        0.5) *
                      THUMB
                    }px)`,
                  background: T.violet,
                  opacity:
                    customActive
                      ? 1
                      : 0.3,
                }}
              />

              <input
                type="range"
                className="stars-range"
                aria-label="Minimum repository stars"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={minValue}
                onChange={(event) =>
                  handleMinChange(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />

              <input
                type="range"
                className="stars-range"
                aria-label="Maximum repository stars"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={maxValue}
                onChange={(event) =>
                  handleMaxChange(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                marginTop: 6,
                color: T.faint,
                fontFamily:
                  "var(--font-mono)",
                fontSize: 8,
              }}
            >
              <span>1k</span>
              <span>50k</span>
            </div>
          </div>
        </Section>

        {/* LANGUAGE */}

        <Section
          title="Language"
          icon={<Code2 size={12} />}
        >
          {availableLanguages.map(
            (language) => (
              <Radio
                key={language}
                label={language}
                checked={
                  filters.language ===
                  language
                }
                onChange={() =>
                  set(
                    "language",
                    language
                  )
                }
              />
            )
          )}
        </Section>

        {/* DIFFICULTY */}

        <Section
          title="Difficulty"
          icon={<Star size={12} />}
        >
          <Radio
            label="Easy"
            color={T.lime}
            checked={
              filters.difficulty ===
              "easy"
            }
            onChange={() =>
              set("difficulty", "easy")
            }
          />

          <Radio
            label="Medium"
            color={T.amber}
            checked={
              filters.difficulty ===
              "medium"
            }
            onChange={() =>
              set(
                "difficulty",
                "medium"
              )
            }
          />

          <Radio
            label="Hard"
            color={T.red}
            checked={
              filters.difficulty ===
              "hard"
            }
            onChange={() =>
              set("difficulty", "hard")
            }
          />
        </Section>

        {/* ISSUE AGE */}

        <Section
          title="Issue age"
          icon={<Clock3 size={12} />}
        >
          {[
            ["day", "Last 24 hours"],
            ["week", "Last 7 days"],
            ["month", "Last 30 days"],
          ].map(([value, label]) => (
            <Radio
              key={value}
              label={label}
              checked={
                filters.date ===
                value
              }
              onChange={() =>
                set(
                  "date",
                  value as Filters["date"]
                )
              }
            />
          ))}
        </Section>

        {/* COMMENTS */}

        <Section
          title="Comments"
          icon={
            <MessageSquare size={12} />
          }
        >
          {[
            ["none", "None"],
            ["1-5", "1–5"],
            ["6-20", "6–20"],
            ["20+", "20+"],
          ].map(([value, label]) => (
            <Radio
              key={value}
              label={label}
              checked={
                filters.comments ===
                value
              }
              onChange={() =>
                set(
                  "comments",
                  value as Filters["comments"]
                )
              }
            />
          ))}
        </Section>

        {/* LINKED PR */}

        {!isGlobalSearch && (
          <Section
            title="Linked pull request"
            icon={
              <GitPullRequest size={12} />
            }
          >
            <Radio
              label="Has linked PR"
              checked={
                filters.linkedPr ===
                "has-pr"
              }
              onChange={() =>
                set(
                  "linkedPr",
                  "has-pr"
                )
              }
            />

            <Radio
              label="No linked PR"
              checked={
                filters.linkedPr ===
                "no-pr"
              }
              onChange={() =>
                set(
                  "linkedPr",
                  "no-pr"
                )
              }
            />
          </Section>
        )}

        {/* AUTHOR */}

        <Section
          title="Author relationship"
          icon={
            <UserRound size={12} />
          }
        >
          {[
            ["OWNER", "Owner"],
            [
              "COLLABORATOR",
              "Collaborator",
            ],
            [
              "CONTRIBUTOR",
              "Contributor",
            ],
            ["NONE", "Other"],
          ].map(([value, label]) => (
            <CheckFilter
              key={value}
              label={label}
              checked={filters.authorType.includes(
                value
              )}
              onChange={() => {
                const current =
                  filters.authorType;

                set(
                  "authorType",
                  current.includes(value)
                    ? current.filter(
                        (item) =>
                          item !==
                          value
                      )
                    : [
                        ...current,
                        value,
                      ]
                );
              }}
            />
          ))}
        </Section>
      </div>
    </aside>
  );
}