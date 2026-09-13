"use client"

import { useState } from "react"

export interface Filters {
  difficulty: "any" | "easy" | "medium" | "hard"
  comments: "any" | "none" | "1-5" | "6-20" | "20+"
  assigned: "any" | "unassigned" | "assigned"
  linkedPr: "any" | "has-pr" | "no-pr"
  authorType: string[]
}

export const DEFAULT_FILTERS: Filters = {
  difficulty: "any",
  comments: "any",
  assigned: "any",
  linkedPr: "any",
  authorType: [],
}

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  onClear: () => void
}

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: "1px solid #F3F4F6" }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", border: "none", background: "none", cursor: "pointer" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#6B7280" }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{title}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  )
}

function Radio({ label, checked, onChange, dot }: { label: string; checked: boolean; onChange: () => void; dot?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 13, color: "#374151" }}>
      <input type="radio" checked={checked} onChange={onChange} style={{ accentColor: "#E05530" }} />
      {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
      {label}
    </label>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 13, color: "#374151" }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: "#E05530" }} />
      {label}
    </label>
  )
}

const iconCls = (d: string) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d={d}/>
  </svg>
)

export default function FilterSidebar({ filters, onChange, onClear }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v })
  const hasActive = filters.difficulty !== "any" || filters.comments !== "any" || filters.assigned !== "any" || filters.linkedPr !== "any" || filters.authorType.length > 0

  return (
    <div style={{ width: 240, flexShrink: 0, paddingRight: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: "0.07em", textTransform: "uppercase" }}>Filters</span>
        {hasActive && (
          <button onClick={onClear} style={{ fontSize: 13, color: "#E05530", border: "none", background: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}>
            Clear all
          </button>
        )}
      </div>

      <Section title="Repository health" defaultOpen={false}
        icon={iconCls("M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z")}>
        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, padding: "4px 0" }}>Coming soon</p>
      </Section>

      <Section title="Difficulty"
        icon={iconCls("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z")}>
        {([["any","Any",undefined],["easy","Easy","#16A34A"],["medium","Medium","#D97706"],["hard","Hard","#DC2626"]] as const).map(([v,l,d]) => (
          <Radio key={v} label={l} dot={d} checked={filters.difficulty === v} onChange={() => set("difficulty", v)} />
        ))}
      </Section>

      <Section title="Stars" defaultOpen={false}
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}>
        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, padding: "4px 0" }}>Any</p>
      </Section>

      <Section title="Language" defaultOpen={false}
        icon={iconCls("M8 18L12 22 16 18M8 6L12 2 16 6")}>
        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, padding: "4px 0" }}>Any</p>
      </Section>

      <Section title="Labels" defaultOpen={false}
        icon={iconCls("M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01")}>
        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, padding: "4px 0" }}>Any</p>
      </Section>

      <Section title="Comments"
        icon={iconCls("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z")}>
        {([["any","Any"],["none","None"],["1-5","1–5"],["6-20","6–20"],["20+","20+"]] as const).map(([v,l]) => (
          <Radio key={v} label={l} checked={filters.comments === v} onChange={() => set("comments", v)} />
        ))}
      </Section>

      <Section title="Assigned or not"
        icon={iconCls("M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z")}>
        {([["any","Any"],["unassigned","Unassigned"],["assigned","Assigned"]] as const).map(([v,l]) => (
          <Radio key={v} label={l} checked={filters.assigned === v} onChange={() => set("assigned", v)} />
        ))}
      </Section>

      <Section title="Author type"
        icon={iconCls("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75")}>
        {[["OWNER","Owner"],["COLLABORATOR","Collaborator"],["CONTRIBUTOR","Contributor"],["NONE","Random"]].map(([v,l]) => (
          <Check key={v} label={l} checked={filters.authorType.includes(v)}
            onChange={() => {
              const cur = filters.authorType
              set("authorType", cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v])
            }}
          />
        ))}
      </Section>
    </div>
  )
}