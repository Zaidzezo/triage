"use client";

import { useState } from "react";
import {
  ChevronDown,
  Clock3,
  Code2,
  GitPullRequest,
  MessageSquare,
  Star,
  UserRound,
} from "lucide-react";

const T = {
  border: "rgba(255,255,255,0.09)",
  text: "#F5F7FB",
  muted: "#9299A8",
  faint: "#565D6C",
  violet: "#9B8CFF",
  violetDim: "rgba(155,140,255,0.12)",
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

  // Star range. The API already limits repos
  // to 1000-49,999 stars, so:
  //   stars    "any" = no minimum, number = minimum (inclusive)
  //   starsMax "any" = no maximum, number = maximum (inclusive)
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

// Presets are "N+" minimums with no maximum.
const STAR_PRESETS: {
  value: number;
  label: string;
}[] = [
  { value: 5000, label: "5k+" },
  { value: 10000, label: "10k+" },
  { value: 25000, label: "25k+" },
];

// Range slider domain. Left end (1k) = no minimum,
// right end (50k) = no maximum, because the API only
// returns repos between those two values anyway.
const SLIDER_MIN = 1000;
const SLIDER_MAX = 50000;
const SLIDER_STEP = 1000;

// Keeps the two handles from overlapping (4 steps is
// wider than a handle), so both can always be grabbed.
const SLIDER_GAP = 4000;

// Handle size in px. Used to line up the highlighted
// bar with the native thumb positions.
const THUMB = 14;

interface Props {
  filters: Filters;
  onChange: (
    filters: Filters
  ) => void;
  onClear: () => void;
  availableLanguages: string[];

  // In global search mode hasLinkedPr is
  // always false (GitHub search does not
  // fetch timelineItems), so the filter is
  // meaningless there and gets hidden.
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
  const [open, setOpen] =
    useState(defaultOpen);

  return (
    <div
      style={{
        padding:
          "3px 0 11px",
        borderBottom:
          `1px solid ${T.border}`,
      }}
    >
      <button
        onClick={() =>
          setOpen(
            (previous) =>
              !previous
          )
        }
        style={{
          width: "100%",
          display: "flex",
          alignItems:
            "center",
          justifyContent:
            "space-between",
          padding: "10px 0",
          border: "none",
          background:
            "transparent",
          color: T.text,
          cursor:
            "pointer",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems:
              "center",
            gap: 8,
          }}
        >
          <span
            style={{
              color:
                T.faint,
              display:
                "grid",
              placeItems:
                "center",
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
              : "none",
            transition:
              "transform 0.18s ease",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            paddingBottom: 4,
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
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        width: "100%",
        display: "flex",
        alignItems:
          "center",
        gap: 8,
        padding: "5px 0",
        border: "none",
        background:
          "transparent",
        color:
          checked
            ? T.text
            : T.muted,
        cursor:
          "pointer",
        textAlign:
          "left",
        fontSize: 10.5,
      }}
    >
      <span
        style={{
          width: 13,
          height: 13,
          flexShrink: 0,
          display: "grid",
          placeItems:
            "center",
          borderRadius:
            "50%",
          border: `1px solid ${
            checked
              ? color ??
                T.violet
              : "rgba(255,255,255,0.16)"
          }`,
          background:
            checked
              ? T.violetDim
              : "transparent",
        }}
      >
        {checked && (
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius:
                "50%",
              background:
                color ??
                T.violet,
              boxShadow:
                `0 0 8px ${
                  color ??
                  T.violet
                }`,
            }}
          />
        )}
      </span>

      {label}
    </button>
  );
}

function Check({
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
      style={{
        width: "100%",
        display: "flex",
        alignItems:
          "center",
        gap: 8,
        padding: "5px 0",
        border: "none",
        background:
          "transparent",
        color:
          checked
            ? T.text
            : T.muted,
        cursor:
          "pointer",
        textAlign:
          "left",
        fontSize: 10.5,
      }}
    >
      <span
        style={{
          width: 13,
          height: 13,
          flexShrink: 0,
          display: "grid",
          placeItems:
            "center",
          borderRadius: 4,
          border: `1px solid ${
            checked
              ? T.violet
              : "rgba(255,255,255,0.16)"
          }`,
          background:
            checked
              ? T.violet
              : "transparent",
          color: "#08090D",
          fontSize: 9,
          fontWeight: 900,
        }}
      >
        {checked ? "✓" : ""}
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
  const set = <
    K extends keyof Filters
  >(
    key: K,
    value: Filters[K]
  ) => {
    onChange({
      ...filters,
      [key]: value,
    });
  };

  // ── Star range state ──

  const minValue =
    typeof filters.stars ===
    "number"
      ? filters.stars
      : SLIDER_MIN;

  const maxValue =
    typeof filters.starsMax ===
    "number"
      ? filters.starsMax
      : SLIDER_MAX;

  const isPreset =
    typeof filters.stars ===
      "number" &&
    filters.starsMax ===
      "any" &&
    STAR_PRESETS.some(
      (preset) =>
        preset.value ===
        filters.stars
    );

  const customActive =
    (filters.stars !== "any" ||
      filters.starsMax !==
        "any") &&
    !isPreset;

  const minLabel = `${minValue / 1000}k`;
  const maxLabel = `${maxValue / 1000}k`;

  // Handle positions as 0-100 percentages.
  const span = SLIDER_MAX - SLIDER_MIN;
  const pMin =
    ((minValue - SLIDER_MIN) / span) *
    100;
  const pMax =
    ((maxValue - SLIDER_MIN) / span) *
    100;

  const handleMinChange = (
    raw: number
  ) => {
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

  const handleMaxChange = (
    raw: number
  ) => {
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
    filters.difficulty !==
      "any" ||
    filters.comments !==
      "any" ||
    filters.assigned !==
      "any" ||
    filters.linkedPr !==
      "any" ||
    filters.authorType.length >
      0 ||
    filters.stars !==
      "any" ||
    filters.starsMax !==
      "any" ||
    filters.language !==
      "any" ||
    filters.date !==
      "any";

  return (
    <aside
      className="filter-sidebar"
      style={{
        width: 250,
        flexShrink: 0,
        position: "sticky",
        top: 88,
        alignSelf: "start",
      }}
    >
      {/* Styles for the two-handle range slider. Native range
          inputs can't be styled inline, so they live here. */}
      <style>{`
        .stars-range {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: ${THUMB}px;
          margin: 0;
          padding: 0;
          background: transparent;
          pointer-events: none;
          -webkit-appearance: none;
          appearance: none;
        }
        .stars-range:focus { outline: none; }
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
          -webkit-appearance: none;
          appearance: none;
          box-sizing: border-box;
          width: ${THUMB}px;
          height: ${THUMB}px;
          border-radius: 50%;
          background: ${T.violet};
          border: 2px solid #08090D;
          box-shadow: 0 0 8px rgba(155,140,255,0.55);
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
          box-shadow: 0 0 8px rgba(155,140,255,0.55);
          cursor: pointer;
          pointer-events: auto;
        }
        .stars-range:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 3px rgba(155,140,255,0.35);
        }
        .stars-range:focus-visible::-moz-range-thumb {
          box-shadow: 0 0 0 3px rgba(155,140,255,0.35);
        }

                .filter-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(155,140,255,0.32) transparent;
        }
        .filter-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .filter-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 14px 0;
        }
        .filter-scroll::-webkit-scrollbar-thumb {
          background: rgba(155,140,255,0.28);
          border-radius: 999px;
        }
        .filter-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(155,140,255,0.5);
        }
      `}</style>

      <div
        className="filter-scroll"
        style={{
          padding:
            "15px 16px 8px",
          maxHeight: "calc(100vh - 104px)",
          overflowY: "auto",
          border:
            `1px solid ${T.border}`,
          borderRadius: 17,
          background:
            "rgba(14,17,25,0.62)",
          backdropFilter:
            "blur(22px)",
          WebkitBackdropFilter:
            "blur(22px)",
          boxShadow:
            "0 24px 70px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.045)",
        }}
      >
        {/* FILTER HEADER */}

        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              gap: 7,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius:
                  "50%",
                background:
                  T.violet,
                boxShadow:
                  `0 0 10px ${T.violet}`,
              }}
            />

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
          </div>

          {hasActive && (
            <button
              type="button"
              onClick={onClear}
              style={{
                padding: 0,
                border: "none",
                background:
                  "transparent",
                color:
                  T.violet,
                cursor:
                  "pointer",
                fontSize: 9.5,
                fontWeight:
                  700,
              }}
            >
              clear
            </button>
          )}
        </div>

        {/* REPOSITORY FILTERS */}

        <Section
          title="Stars"
          icon={
            <Star size={13} />
          }
        >
          <Radio
            label="Any (1k–50k)"
            checked={
              filters.stars ===
                "any" &&
              filters.starsMax ===
                "any"
            }
            onChange={() =>
              onChange({
                ...filters,
                stars: "any",
                starsMax: "any",
              })
            }
          />

          {STAR_PRESETS.map(
            (preset) => (
              <Radio
                key={
                  preset.value
                }
                label={
                  preset.label
                }
                checked={
                  filters.stars ===
                    preset.value &&
                  filters.starsMax ===
                    "any"
                }
                onChange={() =>
                  onChange({
                    ...filters,
                    stars:
                      preset.value,
                    starsMax:
                      "any",
                  })
                }
              />
            )
          )}

          {/* Custom range slider */}

          <div
            style={{
              marginTop: 9,
              padding:
                "9px 10px 10px",
              borderRadius: 9,
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
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                marginBottom:
                  9,
              }}
            >
              <span
                style={{
                  color:
                    T.muted,
                  fontSize:
                    9.5,
                  fontWeight:
                    650,
                }}
              >
                Custom range
              </span>

              <span
                style={{
                  color:
                    customActive
                      ? "#C7C2FF"
                      : T.faint,
                  fontFamily:
                    "var(--font-mono)",
                  fontSize:
                    9,
                }}
              >
                {customActive
                  ? `${minLabel} – ${maxLabel}`
                  : "—"}
              </span>
            </div>

            <div
              style={{
                position:
                  "relative",
                height: THUMB,
              }}
            >
              {/* Track */}
              <div
                style={{
                  position:
                    "absolute",
                  left: 0,
                  right: 0,
                  top:
                    (THUMB - 4) /
                    2,
                  height: 4,
                  borderRadius: 2,
                  background:
                    "rgba(255,255,255,0.1)",
                }}
              />

              {/* Highlighted part between the handles */}
              <div
                style={{
                  position:
                    "absolute",
                  top:
                    (THUMB - 4) /
                    2,
                  height: 4,
                  borderRadius: 2,
                  background:
                    T.violet,
                  opacity:
                    customActive
                      ? 1
                      : 0.35,
                  left: `calc(${pMin}% + ${
                    (0.5 -
                      pMin / 100) *
                    THUMB
                  }px)`,
                  right: `calc(${
                    100 - pMax
                  }% + ${
                    (pMax / 100 -
                      0.5) *
                    THUMB
                  }px)`,
                }}
              />

              <input
                type="range"
                className="stars-range"
                aria-label="Minimum stars"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={minValue}
                onChange={(
                  event
                ) =>
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
                aria-label="Maximum stars"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={maxValue}
                onChange={(
                  event
                ) =>
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
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                marginTop:
                  6,
                color:
                  T.faint,
                fontFamily:
                  "var(--font-mono)",
                fontSize:
                  8,
              }}
            >
              <span>1k</span>
              <span>50k</span>
            </div>
          </div>
        </Section>

        <Section
          title="Main language"
          icon={
            <Code2 size={13} />
          }
        >
          <Radio
            label="Any"
            checked={
              filters.language ===
              "any"
            }
            onChange={() =>
              set(
                "language",
                "any"
              )
            }
          />

          {availableLanguages.map(
            (language) => (
              <Radio
                key={
                  language
                }
                label={
                  language
                }
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

        {/* ISSUE FILTERS */}

        <Section
          title="Difficulty"
          icon={
            <Star size={13} />
          }
        >
          <Radio
            label="Any"
            checked={
              filters.difficulty ===
              "any"
            }
            onChange={() =>
              set(
                "difficulty",
                "any"
              )
            }
          />

          <Radio
            label="Easy"
            color={T.lime}
            checked={
              filters.difficulty ===
              "easy"
            }
            onChange={() =>
              set(
                "difficulty",
                "easy"
              )
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
              set(
                "difficulty",
                "hard"
              )
            }
          />
        </Section>

        <Section
          title="Issue date"
          icon={
            <Clock3 size={13} />
          }
        >
          {[
            ["any", "Any time"],
            [
              "day",
              "Last 24 hours",
            ],
            [
              "week",
              "Last 7 days",
            ],
            [
              "month",
              "Last 30 days",
            ],
          ].map(
            ([value, label]) => (
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
            )
          )}
        </Section>

        <Section
          title="Comments"
          icon={
            <MessageSquare
              size={13}
            />
          }
        >
          {[
            ["any", "Any"],
            ["none", "None"],
            ["1-5", "1–5"],
            ["6-20", "6–20"],
            ["20+", "20+"],
          ].map(
            ([value, label]) => (
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
            )
          )}
        </Section>

        {!isGlobalSearch && (
          <Section
            title="Linked PR"
            icon={
              <GitPullRequest
                size={13}
              />
            }
          >
            <Radio
              label="Any"
              checked={
                filters.linkedPr ===
                "any"
              }
              onChange={() =>
                set(
                  "linkedPr",
                  "any"
                )
              }
            />

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

        <Section
          title="Author type"
          icon={
            <UserRound
              size={13}
            />
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
            ["NONE", "Random"],
          ].map(
            ([value, label]) => (
              <Check
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
                    current.includes(
                      value
                    )
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
            )
          )}
        </Section>
      </div>
    </aside>
  );
}