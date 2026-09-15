"use client";

import { useState } from "react";
import {
  Activity,
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
    | "unassigned"
    | "assigned";

  linkedPr:
    | "any"
    | "has-pr"
    | "no-pr";

  authorType: string[];

  stars:
    | "any"
    | "100"
    | "1000"
    | "10000"
    | "50000";

  language: string;

  date:
    | "any"
    | "day"
    | "week"
    | "month";

  repoHealth:
    | "any"
    | "reviewed"
    | "unreviewed";
}

export const DEFAULT_FILTERS: Filters = {
  difficulty: "any",
  comments: "any",
  assigned: "any",
  linkedPr: "any",
  authorType: [],
  stars: "any",
  language: "any",
  date: "any",
  repoHealth: "any",
};

interface Props {
  filters: Filters;
  onChange: (
    filters: Filters
  ) => void;
  onClear: () => void;
  availableLanguages: string[];
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
    filters.language !==
      "any" ||
    filters.date !==
      "any" ||
    filters.repoHealth !==
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
      <div
        style={{
          padding:
            "15px 16px 8px",
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
          {[
            ["any", "Any"],
            ["100", "100+"],
            ["1000", "1k+"],
            ["10000", "10k+"],
            ["50000", "50k+"],
          ].map(
            ([value, label]) => (
              <Radio
                key={value}
                label={label}
                checked={
                  filters.stars ===
                  value
                }
                onChange={() =>
                  set(
                    "stars",
                    value as Filters["stars"]
                  )
                }
              />
            )
          )}
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

        <Section
          title="Repository health"
          icon={
            <Activity
              size={13}
            />
          }
        >
          <Radio
            label="Any"
            checked={
              filters.repoHealth ===
              "any"
            }
            onChange={() =>
              set(
                "repoHealth",
                "any"
              )
            }
          />

          <Radio
            label="Has reviewed PRs"
            color={T.lime}
            checked={
              filters.repoHealth ===
              "reviewed"
            }
            onChange={() =>
              set(
                "repoHealth",
                "reviewed"
              )
            }
          />

          <Radio
            label="No reviewed PRs"
            color={T.red}
            checked={
              filters.repoHealth ===
              "unreviewed"
            }
            onChange={() =>
              set(
                "repoHealth",
                "unreviewed"
              )
            }
          />
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

        <Section
          title="Assignment"
          icon={
            <UserRound
              size={13}
            />
          }
        >
          {[
            ["any", "Any"],
            [
              "unassigned",
              "Unassigned",
            ],
            [
              "assigned",
              "Assigned",
            ],
          ].map(
            ([value, label]) => (
              <Radio
                key={value}
                label={label}
                checked={
                  filters.assigned ===
                  value
                }
                onChange={() =>
                  set(
                    "assigned",
                    value as Filters["assigned"]
                  )
                }
              />
            )
          )}
        </Section>

        <Section
          title="Linked PR"
          icon={
            <GitPullRequest
              size={13}
            />
          }
        >
          {[
            ["any", "Any"],
            [
              "has-pr",
              "Has linked PR",
            ],
            [
              "no-pr",
              "No linked PR",
            ],
          ].map(
            ([value, label]) => (
              <Radio
                key={value}
                label={label}
                checked={
                  filters.linkedPr ===
                  value
                }
                onChange={() =>
                  set(
                    "linkedPr",
                    value as Filters["linkedPr"]
                  )
                }
              />
            )
          )}
        </Section>

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