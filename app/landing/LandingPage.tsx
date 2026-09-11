/* eslint-disable react/no-unescaped-entities */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  Bookmark,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  Search,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

const inter    = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk  = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const mono     = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

// ─── Design tokens ────────────────────────────────────────────────────────────
// FIX 3 (palette): dropped cyan + lime as full accents.
// Violet is the single accent. Lime is kept only for semantic use (easy / open).
// Amber stays only for medium difficulty. No more three-product feeling.
const T = {
  bg:          "#08090D",
  bg2:         "#0D1018",
  glass:       "rgba(18, 22, 32, 0.58)",
  glassStrong: "rgba(20, 25, 37, 0.78)",
  border:      "rgba(255,255,255,0.09)",
  borderBright:"rgba(255,255,255,0.15)",
  text:        "#F5F7FB",
  muted:       "#9299A8",
  faint:       "#565D6C",
  violet:      "#9B8CFF",       // single primary accent
  violetDim:   "rgba(155,140,255,0.12)",
  lime:        "#B8F36B",       // semantic only: easy / open
  amber:       "#FFC978",       // semantic only: medium
  red:         "#FF8E9E",       // semantic only: hard
};

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Issue {
  repo: string;
  number: number;
  title: string;
  comments: number;
  tag: string;
  tagColor: string;
  difficulty: "easy" | "medium" | "hard";
}

const DEMO_ISSUES: Issue[] = [
  {
    repo: "vercel/next.js",
    number: 62841,
    title: "Add support for streaming in server actions",
    comments: 14,
    tag: "enhancement",
    tagColor: T.violet,
    difficulty: "medium",
  },
  {
    repo: "facebook/react",
    number: 29120,
    title: "Add dev warning for keyed fragments in lists",
    comments: 8,
    tag: "good first issue",
    tagColor: T.lime,
    difficulty: "easy",
  },
  {
    repo: "microsoft/vscode",
    number: 198732,
    title: "Improve find widget accessibility for screen readers",
    comments: 6,
    tag: "accessibility",
    tagColor: T.lime,
    difficulty: "medium",
  },
];

const DIFFICULTY = {
  easy:   { label: "Easy",   color: T.lime  },
  medium: { label: "Medium", color: T.amber },
  hard:   { label: "Hard",   color: T.red   },
};

// ─── Noise ────────────────────────────────────────────────────────────────────
function Noise() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed", inset: 0, zIndex: 1,
        pointerEvents: "none", opacity: 0.035,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

// ─── Cursor spotlight ─────────────────────────────────────────────────────────
function CursorSpotlight() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -600, y: -600, tx: -600, ty: -600 });

  useEffect(() => {
    if (reduce) return;
    const move = (e: MouseEvent) => { pos.current.tx = e.clientX; pos.current.ty = e.clientY; };
    let frame = 0;
    const loop = () => {
      pos.current.x += (pos.current.tx - pos.current.x) * 0.07;
      pos.current.y += (pos.current.ty - pos.current.y) * 0.07;
      if (ref.current) {
        ref.current.style.background =
          `radial-gradient(520px circle at ${pos.current.x}px ${pos.current.y}px, rgba(155,140,255,0.08), transparent 70%)`;
      }
      frame = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", move);
    frame = requestAnimationFrame(loop);
    return () => { window.removeEventListener("mousemove", move); cancelAnimationFrame(frame); };
  }, [reduce]);

  return <div ref={ref} aria-hidden style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none" }} />;
}

// ─── Magnetic ────────────────────────────────────────────────────────────────
function Magnetic({ children, strength = 0.22 }: { children: React.ReactNode; strength?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 18 });
  const y = useSpring(0, { stiffness: 220, damping: 18 });

  return (
    <motion.div
      ref={ref}
      style={{ display: "inline-block", x, y }}
      onMouseMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width  / 2) * strength);
        y.set((e.clientY - r.top  - r.height / 2) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.div>
  );
}

// ─── GlassCard (FIX 2: overflow hidden + borderRadius on the motion.div) ─────
// Previously borderRadius was only on the inner child div, so the blur region
// was rectangular even though the visible card was rounded. Now overflow:hidden
// and borderRadius live on the same element that has the backdrop filter applied
// via the inner shell — and the motion.div itself clips correctly.
function GlassCard({
  children, style, className, radius = 18,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  radius?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(0, { stiffness: 260, damping: 28 });
  const ry = useSpring(0, { stiffness: 260, damping: 28 });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        borderRadius: radius,      // FIX 2a: radius on the motion.div itself
        overflow: "hidden",        // FIX 2b: clips the blur to the rounded rect
        transformStyle: "preserve-3d",
        transformPerspective: 1100,
        rotateX: rx,
        rotateY: ry,
        ...style,
      }}
      onMouseMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top)  / r.height;
        ry.set((px - 0.5) * 7);
        rx.set((0.5 - py) * 7);
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
      whileHover={reduce ? undefined : { z: 10 }}
    >
      {/* Glass highlight layer */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          zIndex: 1,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.075), transparent 38%, rgba(155,140,255,0.045))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      />
      {children}
    </motion.div>
  );
}

// ─── Reveal ───────────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, y = 24, style }: {
  children: React.ReactNode; delay?: number; y?: number; style?: React.CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

const sectionContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
};
const sectionItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};

// ─── IssueCard (FIX 2 applied: GlassCard now handles clipping) ───────────────
function IssueCard({ issue, index }: { issue: Issue; index: number }) {
  const diff = DIFFICULTY[issue.difficulty];

  return (
    <motion.div
      variants={sectionItem}
      initial="hidden"
      animate="show"
      transition={{ delay: index * 0.08 }}
    >
      <GlassCard radius={16}>
        {/* FIX 2: no borderRadius needed here — GlassCard handles it */}
        <div style={{
          padding: "18px 20px",
          background: T.glass,
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          // border stays — it draws on top of the clipped surface correctly
          border: `1px solid ${T.border}`,
          boxShadow: "0 28px 80px rgba(0,0,0,0.36)",
        }}>
          {/* Top row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <GitBranch size={14} color={T.violet} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600, color: "#C7C2FF" }}>
              {issue.repo}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: T.faint }}>
              #{issue.number}
            </span>
            <span style={{
              marginLeft: "auto",
              padding: "3px 9px", borderRadius: 999,
              background: `${issue.tagColor}12`,
              border: `1px solid ${issue.tagColor}32`,
              color: issue.tagColor,
              fontSize: 10.5, fontWeight: 650,
            }}>
              {issue.tag}
            </span>
          </div>

          {/* Title */}
          <p style={{ margin: "0 0 15px", fontSize: 14, fontWeight: 600, lineHeight: 1.5, color: T.text }}>
            {issue.title}
          </p>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: T.muted }}>
              <MessageSquare size={12} /> {issue.comments}
            </span>
            <span style={{ color: T.faint }}>·</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: 999,
              background: `${diff.color}0D`,
              border: `1px solid ${diff.color}2A`,
              color: diff.color, fontSize: 11, fontWeight: 700,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: diff.color }} />
              {diff.label}
            </span>
            <span style={{
              marginLeft: "auto",
              fontSize: 10.5, color: T.lime,
              fontFamily: "var(--font-mono)",
            }}>
              open
            </span>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─── TypingDemo (FIX 1: single useRef state machine, smooth delete phase) ─────
// OLD: phrase/char as React state caused stale closures and hard-cut transitions.
// NEW: all mutable animation state lives in a single ref object. The loop reads
//      and writes only the ref — React state is touched only to flush the
//      displayed string to the DOM, so there are zero stale-closure issues.
//      A proper backspace phase is now included.
function TypingDemo() {
  const reduce = useReducedMotion();
  const PHRASES = ["facebook/react", "vercel/next.js", "microsoft/vscode", "tailwindlabs/tailwindcss"];

  const [display, setDisplay] = useState(PHRASES[0]);

  // All mutable loop state in one ref — never goes stale
  const loop = useRef({
    phraseIdx: 0,
    charIdx:   PHRASES[0].length,
    deleting:  false,
    timer:     0 as unknown as ReturnType<typeof setTimeout>,
  });

  useEffect(() => {
    if (reduce) { setDisplay(PHRASES[0]); return; }

    const tick = () => {
      const s       = loop.current;
      const phrase  = PHRASES[s.phraseIdx];

      if (!s.deleting) {
        if (s.charIdx < phrase.length) {
          // Type forward one char
          s.charIdx++;
          setDisplay(phrase.slice(0, s.charIdx));
          s.timer = setTimeout(tick, 68);
        } else {
          // Fully typed — pause then start deleting
          s.deleting = true;
          s.timer = setTimeout(tick, 2000);
        }
      } else {
        if (s.charIdx > 0) {
          // Backspace one char
          s.charIdx--;
          setDisplay(phrase.slice(0, s.charIdx));
          s.timer = setTimeout(tick, 32);   // backspace is faster than typing
        } else {
          // Fully deleted — move to next phrase
          s.deleting  = false;
          s.phraseIdx = (s.phraseIdx + 1) % PHRASES.length;
          s.timer     = setTimeout(tick, 120);
        }
      }
    };

    // Small initial delay so the page settles before animation starts
    loop.current.timer = setTimeout(tick, 900);
    return () => clearTimeout(loop.current.timer);
    // PHRASES is constant — intentional single-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 9px 9px 14px",
      background: T.glassStrong,
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      border: `1px solid ${T.borderBright}`,
      borderRadius: 14,
      boxShadow: "0 20px 60px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.07)",
    }}>
      <Search size={15} color={T.muted} />
      <div
        aria-label="Animated repository search preview"
        style={{
          flex: 1, minWidth: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 13, color: T.text,
          whiteSpace: "nowrap", overflow: "hidden",
        }}
      >
        {display}
        <motion.span
          aria-hidden
          animate={reduce ? undefined : { opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 0.9 }}
          style={{ color: T.violet }}
        >|</motion.span>
      </div>
      <span style={{
        padding: "8px 13px", borderRadius: 9,
        background: T.violetDim,
        border: "1px solid rgba(155,140,255,0.25)",
        color: "#D2CDFF",
        fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
      }}>
        Preview
      </span>
    </div>
  );
}

// ─── HeroVisual (FIX 4: static transform moved to motion animate props) ───────
// OLD: `transform: "rotateX(7deg) rotateY(-7deg) rotateZ(1deg)"` on a motion.div
//      that framer also controlled — framer overwrites inline CSS transform.
// NEW: initial/animate handle the resting tilt so framer composites them
//      correctly with the GlassCard spring tilt on hover.
function HeroVisual() {
  const reduce = useReducedMotion();
  const ref    = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [40, -35]), { stiffness: 90, damping: 24 });

  return (
    <motion.div
      ref={ref}
      style={{ position: "relative", y, perspective: 1300, transformStyle: "preserve-3d" }}
    >
      {/* Ambient glow blob */}
      <motion.div
        aria-hidden
        animate={reduce ? undefined : { rotateZ: [0, 1.5, 0, -1.5, 0], y: [0, -8, 0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
        style={{
          position: "absolute", inset: "8% 12%",
          borderRadius: 40,
          background: "radial-gradient(circle at 50% 40%, rgba(155,140,255,0.24), transparent 62%)",
          filter: "blur(45px)",
          transform: "translateZ(-80px)",
        }}
      />

      {/* FIX 4: resting 3-axis tilt now in framer animate, not CSS transform string */}
      <motion.div
        initial={reduce ? undefined : { rotateX: 7, rotateY: -7, rotateZ: 1 }}
        animate={reduce ? undefined : { rotateX: 7, rotateY: -7, rotateZ: 1 }}
        style={{ position: "relative", transformStyle: "preserve-3d" }}
      >
        <GlassCard radius={24}>
          <div style={{
            borderRadius: 24,
            padding: 14,
            background: "linear-gradient(145deg, rgba(30,35,52,0.88), rgba(11,14,21,0.76))",
            border: `1px solid ${T.borderBright}`,
            boxShadow: "0 45px 100px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.09)",
            transform: "translateZ(28px)",
          }}>
            {/* Window chrome */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 9px 13px" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[0,1,2].map(d => (
                  <span key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.16)" }} />
                ))}
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: T.faint }}>
                issue explorer
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DEMO_ISSUES.map((issue, i) => (
                <IssueCard key={issue.number} issue={issue} index={i} />
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    return scrollY.on("change", (v: number) => setScrolled(v > 40));
  }, [scrollY]);

  return (
    <motion.nav
      animate={{ height: scrolled ? 56 : 68 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px",
        background: scrolled ? "rgba(8,9,13,0.7)" : "transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(24px)" : "none",
        borderBottom: `1px solid ${scrolled ? T.border : "transparent"}`,
      }}
    >
      {/* Scroll progress bar — violet only */}
      <motion.div style={{
        position: "absolute", bottom: -1, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, ${T.violet}, rgba(155,140,255,0.4))`,
        scaleX: progress, transformOrigin: "0 50%",
      }} />

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 29, height: 29, borderRadius: 9,
          display: "grid", placeItems: "center",
          background: T.violet,
          boxShadow: `0 0 26px rgba(155,140,255,0.35)`,
        }}>
          <Search size={14} color="#08090D" strokeWidth={2.7} />
        </div>
        <span style={{ fontFamily: "var(--font-grotesk)", fontSize: 16, fontWeight: 750 }}>
          Triage
        </span>
      </div>

      {/* Links */}
      <div style={{ display: "flex", gap: 28 }}>
        {["Features", "How it works"].map(l => (
          <a key={l} href={`#${l.toLowerCase().replace(" ", "-")}`}
            style={{ fontSize: 13, color: T.muted, textDecoration: "none" }}>
            {l}
          </a>
        ))}
      </div>

      {/* CTA */}
      <Magnetic>
        <a href="/login" style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "8px 15px", borderRadius: 9,
          background: "rgba(255,255,255,0.07)",
          border: `1px solid ${T.borderBright}`,
          color: T.text, textDecoration: "none",
          fontSize: 12.5, fontWeight: 700,
        }}>
          Get started <ArrowRight size={13} />
        </a>
      </Magnetic>
    </motion.nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  const reduce    = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const opacity   = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={sectionRef} style={{
      position: "relative", maxWidth: 1360,
      margin: "0 auto", padding: "154px 40px 120px",
    }}>
      {/* Background decoration */}
      <motion.div aria-hidden style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 20, left: "4%",
          width: 560, height: 500,
          background: "radial-gradient(circle, rgba(155,140,255,0.13), transparent 67%)",
          filter: "blur(30px)",
        }} />
        <div style={{
          position: "absolute", right: "-5%", top: 120,
          width: 580, height: 540,
          background: "radial-gradient(circle, rgba(155,140,255,0.07), transparent 68%)",
          filter: "blur(35px)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 35%, black, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 35%, black, transparent 78%)",
        }} />
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.88fr) minmax(0, 1.12fr)", gap: 72, alignItems: "center" }}>
        {/* Left copy */}
        <motion.div variants={sectionContainer} initial="hidden" animate="show" style={{ position: "relative", zIndex: 3 }}>
          {/* Badge */}
          <motion.div variants={sectionItem} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 11px", marginBottom: 24,
            borderRadius: 999,
            background: T.violetDim,
            border: "1px solid rgba(155,140,255,0.2)",
            color: "#C9C4FF", fontSize: 11.5, fontWeight: 650,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.violet, boxShadow: `0 0 12px ${T.violet}` }} />
            A better way to find open-source work
          </motion.div>

          {/* Headline — FIX 5 (palette): gradient is violet only, tighter copy */}
          <motion.h1 variants={sectionItem} style={{
            margin: 0,
            fontFamily: "var(--font-grotesk)",
            fontSize: "clamp(44px, 5.3vw, 70px)",
            lineHeight: 0.99, letterSpacing: "-0.045em", fontWeight: 750,
            maxWidth: 650,
          }}>
            Find issues.<br />
            <span style={{
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}>
              Know what to pick.
            </span>
          </motion.h1>

          <motion.p variants={sectionItem} style={{
            margin: "24px 0 30px", maxWidth: 500,
            color: T.muted, fontSize: 16, lineHeight: 1.75,
          }}>
            Triage turns a noisy GitHub issue list into a focused starting point,
            so you spend less time searching and more time building.
          </motion.p>

          <motion.div variants={sectionItem}>
            <TypingDemo />
          </motion.div>

          <motion.div variants={sectionItem} style={{
            display: "flex", alignItems: "center", gap: 12,
            marginTop: 16, color: T.faint, fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}>
            <Terminal size={13} />
            <span>interactive preview · static example data</span>
          </motion.div>

          
        </motion.div>

        <HeroVisual />
      </div>

      {/* Bottom glow */}
      <motion.div
        aria-hidden
        animate={reduce ? undefined : { opacity: [0.25, 0.55, 0.25], scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
        style={{
          position: "absolute", left: "50%", bottom: 25,
          width: 280, height: 80, transform: "translateX(-50%)",
          borderRadius: "50%",
          background: "rgba(155,140,255,0.11)",
          filter: "blur(45px)", pointerEvents: "none",
        }}
      />
    </section>
  );
}

// ─── Features (FIX 5 palette + FIX 6: position:relative on card container) ───
// FIX 6: the absolute glow orb inside each card was escaping because the card
// container div (display:flex,flexDirection:column) didn't have position:relative.
// Added explicitly below.
function Features() {
  const cells = [
    {
      icon: <Search size={19} />,
      title: "Discover",
      body: "Start from a repository and surface the issues that are actually relevant to your contribution goals.",
    },
    {
      icon: <Sparkles size={19} />,
      title: "Understand",
      body: "Use AI-assisted context to turn an unfamiliar issue into a clearer picture of scope, difficulty, and next steps.",
    },
    {
      icon: <Bookmark size={19} />,
      title: "Commit",
      body: "Keep promising issues in one place, then jump back to GitHub when you're ready to work.",
    },
  ];

  return (
    <section id="features" style={{ maxWidth: 1360, margin: "0 auto", padding: "90px 40px 120px" }}>
      <Reveal>
        <div style={{ maxWidth: 650, marginBottom: 44 }}>
          <p style={{
            margin: "0 0 12px", color: T.violet,
            fontFamily: "var(--font-mono)", fontSize: 11,
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            // core workflow
          </p>
          <h2 style={{
            margin: 0,
            fontFamily: "var(--font-grotesk)",
            fontSize: "clamp(32px, 4vw, 48px)",
            lineHeight: 1.05, letterSpacing: "-0.035em",
          }}>
            Less noise.<br />Better decisions.
          </h2>
        </div>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, alignItems: "stretch" }}>
        {cells.map((cell, i) => (
          <Reveal key={cell.title} delay={i * 0.08} style={{ height: "100%" }}>
            <GlassCard radius={20} style={{ height: "100%" }}>
              {/* FIX 6: position:relative added so the absolute glow stays inside */}
              <div style={{
                position: "relative",           // ← FIX 6
                height: "100%", minHeight: 260,
                display: "flex", flexDirection: "column",
                padding: "28px 26px",
                background: T.glass,
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
                border: `1px solid ${T.border}`,
              }}>
                <div style={{
                  width: 42, height: 42,
                  display: "grid", placeItems: "center",
                  marginBottom: 30, borderRadius: 12,
                  color: T.violet,                         // single accent
                  background: T.violetDim,
                  border: `1px solid rgba(155,140,255,0.24)`,
                }}>
                  {cell.icon}
                </div>

                <div style={{ marginTop: "auto" }}>
                  <h3 style={{
                    margin: "0 0 10px",
                    fontFamily: "var(--font-grotesk)",
                    fontSize: 19, fontWeight: 700,
                  }}>
                    {cell.title}
                  </h3>
                  <p style={{ margin: 0, color: T.muted, fontSize: 13.5, lineHeight: 1.7 }}>
                    {cell.body}
                  </p>
                </div>

                {/* Glow orb — now correctly clipped to the card */}
                <div aria-hidden style={{
                  position: "absolute", right: 20, top: 20,
                  width: 70, height: 70, borderRadius: "50%",
                  background: `radial-gradient(circle, rgba(155,140,255,0.12), transparent 70%)`,
                  filter: "blur(6px)",
                  pointerEvents: "none",
                }} />
              </div>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Choose a repository",
      desc: "Point Triage at the project you want to contribute to.",
      icon: <GitBranch size={17} />,
    },
    {
      number: "02",
      title: "Explore the issue list",
      desc: "Scan a cleaner presentation of open work instead of digging through tabs.",
      icon: <Search size={17} />,
    },
    {
      number: "03",
      title: "Pick your next contribution",
      desc: "Use available context to decide what is worth opening, understanding, and building.",
      icon: <GitPullRequest size={17} />,
    },
  ];

  return (
    <section id="how-it-works" style={{ maxWidth: 1360, margin: "0 auto", padding: "0 40px 120px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 90, alignItems: "center" }}>
        <Reveal>
          <p style={{
            margin: "0 0 12px", color: T.violet,
            fontFamily: "var(--font-mono)", fontSize: 11,
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            // how it works
          </p>
          <h2 style={{
            margin: "0 0 18px",
            fontFamily: "var(--font-grotesk)",
            fontSize: "clamp(32px, 4vw, 48px)",
            lineHeight: 1.04, letterSpacing: "-0.035em",
          }}>
            Three steps.<br />No theatre.
          </h2>
          <p style={{ maxWidth: 410, margin: 0, color: T.muted, fontSize: 15, lineHeight: 1.75 }}>
            No fake counters, no invented success stories, no pretending a demo is production data.
            The interface shows the workflow clearly and lets the real product earn the proof later.
          </p>
        </Reveal>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Connector line — violet only */}
          <div aria-hidden style={{
            position: "absolute", left: 26, top: 35, bottom: 35, width: 1,
            background: `linear-gradient(180deg, ${T.violet}, rgba(155,140,255,0.2))`,
          }} />

          {steps.map((step, i) => (
            <Reveal key={step.number} delay={i * 0.08}>
              <GlassCard radius={17}>
                <div style={{
                  position: "relative",
                  display: "grid", gridTemplateColumns: "52px 1fr auto",
                  alignItems: "center", gap: 18,
                  padding: "20px 22px",
                  background: T.glass,
                  backdropFilter: "blur(22px)",
                  WebkitBackdropFilter: "blur(22px)",
                  border: `1px solid ${T.border}`,
                }}>
                  <div style={{
                    position: "relative", zIndex: 2,
                    width: 52, height: 52,
                    display: "grid", placeItems: "center",
                    borderRadius: 15,
                    background: T.violetDim,
                    border: `1px solid rgba(155,140,255,0.28)`,
                    color: T.violet,
                  }}>
                    {step.icon}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: T.violet }}>
                        {step.number}
                      </span>
                      <h3 style={{ margin: 0, fontFamily: "var(--font-grotesk)", fontSize: 16.5 }}>
                        {step.title}
                      </h3>
                    </div>
                    <p style={{ margin: 0, color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
                      {step.desc}
                    </p>
                  </div>

                  <motion.div whileHover={{ x: 3 }} style={{
                    width: 30, height: 30,
                    display: "grid", placeItems: "center",
                    borderRadius: "50%",
                    color: T.faint, border: `1px solid ${T.border}`,
                  }}>
                    <ArrowRight size={13} />
                  </motion.div>
                </div>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTA() {
  return (
    <section style={{ maxWidth: 1360, margin: "0 auto", padding: "0 40px 120px" }}>
      <Reveal>
        <div style={{
          position: "relative", overflow: "hidden",
          textAlign: "center", padding: "90px 40px",
          borderRadius: 28,
          background: "linear-gradient(145deg, rgba(26,29,45,0.78), rgba(12,15,22,0.64))",
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
          border: `1px solid ${T.borderBright}`,
          boxShadow: "0 40px 100px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}>
          <div aria-hidden style={{
            position: "absolute", left: "50%", top: "50%",
            width: 560, height: 260,
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(155,140,255,0.18), transparent 72%)",
            filter: "blur(30px)",
          }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{
              margin: "0 0 15px",
              fontFamily: "var(--font-grotesk)",
              fontSize: "clamp(32px, 4.5vw, 54px)",
              lineHeight: 1, letterSpacing: "-0.04em",
            }}>
              Your next contribution<br />starts with one issue.
            </h2>
            <p style={{
              maxWidth: 430, margin: "0 auto 30px",
              color: T.muted, fontSize: 15, lineHeight: 1.7,
            }}>
              Start with the workflow. Add real data, scoring, and social proof as the product earns them.
            </p>

            <Magnetic strength={0.28}>
              <a href="/login" style={{
                display: "inline-flex", alignItems: "center", gap: 9,
                padding: "13px 22px", borderRadius: 11,
                background: T.violet,
                color: "#08090D", textDecoration: "none",
                fontSize: 14, fontWeight: 800,
                boxShadow: `0 12px 38px rgba(155,140,255,0.25)`,
              }}>
                Start exploring <ArrowRight size={15} />
              </a>
            </Magnetic>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      maxWidth: 1360, margin: "0 auto", padding: "26px 40px",
      borderTop: `1px solid ${T.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 22, height: 22, display: "grid", placeItems: "center",
          borderRadius: 6, background: T.violet,
        }}>
          <Search size={11} color="#08090D" strokeWidth={2.8} />
        </div>
        <span style={{ color: T.muted, fontFamily: "var(--font-grotesk)", fontSize: 13, fontWeight: 700 }}>
          Triage
        </span>
      </div>

      <span style={{ color: T.faint, fontSize: 11.5 }}>© 2026 Triage</span>

      <div style={{ display: "flex", gap: 20 }}>
        {["Features", "How it works"].map(l => (
          <a key={l} href={`#${l.toLowerCase().replace(" ", "-")}`}
            style={{ color: T.muted, textDecoration: "none", fontSize: 11.5 }}>
            {l}
          </a>
        ))}
      </div>
    </footer>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div
      className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}
      style={{
        minHeight: "100vh", overflowX: "hidden",
        color: T.text,
        background: `radial-gradient(circle at 50% -10%, rgba(155,140,255,0.08), transparent 38%), ${T.bg}`,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <CursorSpotlight />
      <Noise />

      <div style={{ position: "relative", zIndex: 4 }}>
        <Nav />
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
        <Footer />
      </div>

      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: ${T.bg}; }
        ::selection { background: rgba(155,140,255,0.28); color: #F5F7FB; }
        a { transition: color 180ms ease, border-color 180ms ease, background 180ms ease; }
        a:hover { color: #F5F7FB !important; }

        @media (max-width: 1050px) {
          nav > div:nth-child(2) { display: none !important; }
          section > div { grid-template-columns: 1fr !important; }
          #features > div:last-child { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 700px) {
          nav    { padding: 0 18px !important; }
          section { padding-left: 20px !important; padding-right: 20px !important; }
          footer  { padding-left: 20px !important; padding-right: 20px !important; flex-wrap: wrap; }
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
        }
      `}</style>
    </div>
  );
}

// "use client";

// import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
// import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, useScroll } from "motion/react";
// import { Canvas, useFrame } from "@react-three/fiber";
// import { Html, Line, OrbitControls, RoundedBox } from "@react-three/drei";
// import * as THREE from "three";
// import {
//   Activity,
//   ArrowRight,
//   ArrowUpRight,
//   CircleDot,
//   Command,
//   Filter,
//   GitBranch,
//   GitMerge,
//   GitPullRequest,
//   GitCommit,
//   Search,
//   Sparkles,
//   Star,
// } from "lucide-react";
// import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

// const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
// const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

// const T = {
//   bg: "#060708",
//   panel: "rgba(15,17,20,.72)",
//   border: "rgba(255,255,255,.09)",
//   borderBright: "rgba(255,255,255,.15)",
//   text: "#F7F8FA",
//   muted: "#969BA4",
//   faint: "#565C66",
//   purple: "#A78BFA",
//   blue: "#60A5FA",
//   green: "#86EFAC",
//   orange: "#FDBA74",
//   red: "#FB7185",
// };

// const EASE = [0.22, 1, 0.36, 1] as const;

// const ISSUES = [
//   { repo: "vercel/next.js", number: 62841, title: "Streaming server actions should preserve request context", label: "enhancement", level: "medium", color: T.blue, comments: 14 },
//   { repo: "facebook/react", number: 29120, title: "Warn when keyed fragments are missing stable keys", label: "good first issue", level: "easy", color: T.green, comments: 8 },
//   { repo: "microsoft/vscode", number: 198732, title: "Improve find widget semantics for screen readers", label: "accessibility", level: "medium", color: T.orange, comments: 6 },
// ];

// function Noise() {
//   return (
//     <div
//       aria-hidden
//       style={{
//         position: "fixed",
//         inset: 0,
//         zIndex: 1,
//         pointerEvents: "none",
//         opacity: 0.027,
//         backgroundImage:
//           "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
//       }}
//     />
//   );
// }

// function CursorGlow() {
//   const reduce = useReducedMotion();
//   const x = useMotionValue(-500);
//   const y = useMotionValue(-500);
//   const sx = useSpring(x, { stiffness: 95, damping: 24 });
//   const sy = useSpring(y, { stiffness: 95, damping: 24 });

//   useEffect(() => {
//     if (reduce) return;
//     const move = (e: MouseEvent) => {
//       x.set(e.clientX);
//       y.set(e.clientY);
//     };
//     window.addEventListener("mousemove", move);
//     return () => window.removeEventListener("mousemove", move);
//   }, [reduce, x, y]);

//   return (
//     <motion.div
//       aria-hidden
//       style={{
//         position: "fixed",
//         inset: 0,
//         zIndex: 2,
//         pointerEvents: "none",
//         background: useTransform(
//           [sx, sy],
//           ([cx, cy]) =>
//             `radial-gradient(360px circle at ${cx}px ${cy}px, rgba(167,139,250,.075), transparent 72%)`,
//         ),
//       }}
//     />
//   );
// }

// function Magnetic({ children, strength = 0.18 }: { children: ReactNode; strength?: number }) {
//   const reduce = useReducedMotion();
//   const ref = useRef<HTMLDivElement>(null);
//   const x = useSpring(0, { stiffness: 240, damping: 18 });
//   const y = useSpring(0, { stiffness: 240, damping: 18 });

//   return (
//     <motion.div
//       ref={ref}
//       style={{ display: "inline-block", x, y }}
//       onMouseMove={(e) => {
//         if (reduce || !ref.current) return;
//         const r = ref.current.getBoundingClientRect();
//         x.set((e.clientX - r.left - r.width / 2) * strength);
//         y.set((e.clientY - r.top - r.height / 2) * strength);
//       }}
//       onMouseLeave={() => {
//         x.set(0);
//         y.set(0);
//       }}
//     >
//       {children}
//     </motion.div>
//   );
// }

// function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 28 }}
//       whileInView={{ opacity: 1, y: 0 }}
//       viewport={{ once: true, margin: "-80px" }}
//       transition={{ duration: 0.82, delay, ease: EASE }}
//       style={style}
//     >
//       {children}
//     </motion.div>
//   );
// }

// function Glass({ children, style }: { children: ReactNode; style?: CSSProperties }) {
//   return (
//     <div
//       style={{
//         position: "relative",
//         overflow: "hidden",
//         borderRadius: 28,
//         background: T.panel,
//         border: `1px solid ${T.border}`,
//         boxShadow: "0 30px 100px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.055)",
//         backdropFilter: "blur(26px)",
//         WebkitBackdropFilter: "blur(26px)",
//         ...style,
//       }}
//     >
//       <div
//         aria-hidden
//         style={{
//           position: "absolute",
//           inset: 0,
//           pointerEvents: "none",
//           background: "linear-gradient(135deg, rgba(255,255,255,.06), transparent 26%, rgba(167,139,250,.025))",
//         }}
//       />
//       {children}
//     </div>
//   );
// }

// function Tilt({ children, style }: { children: ReactNode; style?: CSSProperties }) {
//   const reduce = useReducedMotion();
//   const ref = useRef<HTMLDivElement>(null);
//   const rx = useSpring(0, { stiffness: 230, damping: 24 });
//   const ry = useSpring(0, { stiffness: 230, damping: 24 });

//   return (
//     <motion.div
//       ref={ref}
//       style={{ transformPerspective: 1300, rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", ...style }}
//       onMouseMove={(e) => {
//         if (reduce || !ref.current) return;
//         const r = ref.current.getBoundingClientRect();
//         const px = (e.clientX - r.left) / r.width;
//         const py = (e.clientY - r.top) / r.height;
//         ry.set((px - 0.5) * 5.5);
//         rx.set((0.5 - py) * 5.5);
//       }}
//       onMouseLeave={() => {
//         rx.set(0);
//         ry.set(0);
//       }}
//     >
//       {children}
//     </motion.div>
//   );
// }

// function StatPill({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
//   return (
//     <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: T.muted }}>
//       <span style={{ width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 8, border: `1px solid ${T.border}`, background: "rgba(255,255,255,.025)" }}>
//         {icon}
//       </span>
//       <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.faint }}>{label}</span>
//       <strong style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: T.text }}>{value}</strong>
//     </div>
//   );
// }

// function IssueRow({ issue, index, compact = false }: { issue: typeof ISSUES[number]; index: number; compact?: boolean }) {
//   return (
//     <motion.div
//       initial={{ opacity: 0, x: 20 }}
//       animate={{ opacity: 1, x: 0 }}
//       transition={{ duration: 0.6, delay: index * 0.12, ease: EASE }}
//       style={{
//         padding: compact ? "13px 14px" : "16px 17px",
//         borderRadius: 17,
//         border: `1px solid ${T.border}`,
//         background: "linear-gradient(135deg, rgba(255,255,255,.035), rgba(255,255,255,.012))",
//         boxShadow: "inset 0 1px 0 rgba(255,255,255,.025)",
//       }}
//     >
//       <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
//         <CircleDot size={13} color={issue.color} />
//         <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: T.text, whiteSpace: "nowrap" }}>{issue.repo}</span>
//         <span style={{ color: T.faint, fontFamily: "var(--font-mono)", fontSize: 10 }}>#{issue.number}</span>
//         <span style={{ marginLeft: "auto", border: `1px solid ${issue.color}33`, background: `${issue.color}0E`, color: issue.color, borderRadius: 999, padding: "3px 7px", fontSize: 9.5, whiteSpace: "nowrap" }}>{issue.label}</span>
//       </div>
//       <p style={{ margin: compact ? "10px 0 8px" : "11px 0 10px", fontSize: compact ? 12.1 : 12.8, lineHeight: 1.5, fontWeight: 620, color: T.text }}>{issue.title}</p>
//       <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.faint, fontSize: 9.8, fontFamily: "var(--font-mono)" }}>
//         <span>{issue.comments} comments</span>
//         <span>·</span>
//         <span style={{ color: issue.level === "easy" ? T.green : T.orange }}>{issue.level}</span>
//         <span style={{ marginLeft: "auto" }}>open</span>
//       </div>
//     </motion.div>
//   );
// }

// function IssueCard3D({
//   position,
//   color,
//   number,
//   title,
//   repo,
//   side = "left",
// }: {
//   position: [number, number, number];
//   color: string;
//   number: string;
//   title: string;
//   repo: string;
//   side?: "left" | "right";
// }) {
//   return (
//     <group position={position}>
//       <RoundedBox args={[2.18, 1.2, 0.1]} radius={0.08} smoothness={4}>
//         <meshPhysicalMaterial
//           color="#111419"
//           roughness={0.31}
//           metalness={0.26}
//           clearcoat={0.45}
//         />
//       </RoundedBox>
//       <mesh position={[side === "left" ? -0.88 : -0.88, 0.39, 0.058]}>
//         <sphereGeometry args={[0.052, 16, 16]} />
//         <meshBasicMaterial color={color} />
//       </mesh>

//       {/* Keep the UI facing the viewer. The old transform-based Html was allowed to turn
//           onto its back when the whole graph rotated, which made the copy appear flipped. */}
//       <Html
//         sprite
//         position={[-0.82, 0.06, 0.064]}
//         center
//         distanceFactor={7.4}
//         style={{ width: 205, pointerEvents: "none" }}
//       >
//         <div
//           style={{
//             color: "#EDF0F4",
//             fontFamily: "var(--font-inter)",
//             textAlign: "left",
//             userSelect: "none",
//           }}
//         >
//           <div
//             style={{
//               display: "flex",
//               alignItems: "center",
//               gap: 6,
//               color: "#7D858F",
//               fontFamily: "var(--font-mono)",
//               fontSize: 7.7,
//               letterSpacing: ".035em",
//               whiteSpace: "nowrap",
//             }}
//           >
//             <span>{repo}</span>
//             <span>#{number}</span>
//           </div>
//           <div
//             style={{
//               marginTop: 7,
//               fontSize: 10.5,
//               lineHeight: 1.3,
//               fontWeight: 760,
//               maxWidth: 188,
//             }}
//           >
//             {title}
//           </div>
//           <div
//             style={{
//               display: "flex",
//               gap: 7,
//               marginTop: 9,
//               color: "#68717B",
//               fontFamily: "var(--font-mono)",
//               fontSize: 7.4,
//               whiteSpace: "nowrap",
//             }}
//           >
//             <span style={{ color }}>● open</span>
//             <span>·</span>
//             <span>context ready</span>
//           </div>
//         </div>
//       </Html>
//     </group>
//   );
// }

// function HeroGraph() {
//   const root = useRef<THREE.Group>(null);

//   useFrame((state) => {
//     if (!root.current) return;
//     // Deliberately keep the cards stable in depth. The previous scene rotated the entire
//     // hierarchy, which is what caused the UI copy to flip and cards to collide visually.
//     root.current.position.y = Math.sin(state.clock.elapsedTime * 0.45) * 0.045;
//     root.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.24) * 0.035;
//     root.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.31) * 0.018;
//   });

//   const cards = [
//     { p: [-2.65, 1.08, 0.1] as [number, number, number], color: T.blue, number: "62841", repo: "vercel/next.js", title: "Streaming server actions", side: "left" as const },
//     { p: [2.62, 0.96, -0.05] as [number, number, number], color: T.green, number: "29120", repo: "facebook/react", title: "Stable keyed fragments", side: "right" as const },
//     { p: [-2.55, -1.18, -0.02] as [number, number, number], color: T.orange, number: "198732", repo: "microsoft/vscode", title: "Find widget accessibility", side: "left" as const },
//     { p: [2.48, -1.23, 0.04] as [number, number, number], color: T.purple, number: "18421", repo: "openai/cookbook", title: "Example discoverability", side: "right" as const },
//   ];

//   return (
//     <group ref={root}>
//       <ambientLight intensity={1.05} />
//       <pointLight position={[4, 3, 4]} intensity={18} color="#A78BFA" />
//       <pointLight position={[-4, -1, 3]} intensity={13} color="#60A5FA" />

//       {/* The actual product idea: one issue-intelligence engine connected to four candidate issues. */}
//       <RoundedBox args={[1.68, 1.08, 0.28]} radius={0.18} smoothness={5} position={[0, 0.02, 0.65]}>
//         <meshPhysicalMaterial color="#171A20" roughness={0.19} metalness={0.52} clearcoat={0.9} />
//       </RoundedBox>
//       <mesh position={[0, 0.17, 0.81]}>
//         <sphereGeometry args={[0.16, 24, 24]} />
//         <meshStandardMaterial color="#FAF8FF" emissive="#A78BFA" emissiveIntensity={5.5} roughness={0.18} metalness={0.15} />
//       </mesh>
//       <Html sprite position={[0, -0.08, 0.82]} center distanceFactor={7.5} style={{ pointerEvents: "none" }}>
//         <div
//           style={{
//             display: "flex",
//             flexDirection: "column",
//             alignItems: "center",
//             gap: 4,
//             color: "#F2F1F6",
//             fontFamily: "var(--font-mono)",
//             whiteSpace: "nowrap",
//           }}
//         >
//           <span style={{ fontSize: 8.5, color: "#B9AFFF", letterSpacing: ".09em" }}>TRIAGE ENGINE</span>
//           <span style={{ fontSize: 7, color: "#6E7580" }}>context assembled</span>
//         </div>
//       </Html>

//       {cards.map((card) => (
//         <IssueCard3D key={card.number} position={card.p} color={card.color} number={card.number} repo={card.repo} title={card.title} side={card.side} />
//       ))}

//       {cards.map((card, i) => (
//         <Line
//           key={`connection-${card.number}`}
//           points={[card.p, [0, 0.02, 0.65]]}
//           color={card.color}
//           transparent
//           opacity={0.34}
//           lineWidth={1}
//         />
//       ))}

//       <mesh position={[0, 0.02, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
//         <ringGeometry args={[3.25, 3.265, 128]} />
//         <meshBasicMaterial color="#A78BFA" transparent opacity={0.12} />
//       </mesh>
//     </group>
//   );
// }

// function HeroScene() {
//   return (
//     <div style={{ position: "absolute", inset: 0 }}>
//       <Canvas camera={{ position: [0, 0, 9.5], fov: 31 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true }}>
//         <color attach="background" args={[T.bg]} />
//         <HeroGraph />
//         <OrbitControls
//           enableZoom={false}
//           enablePan={false}
//           autoRotate={false}
//           minPolarAngle={Math.PI / 2.15}
//           maxPolarAngle={Math.PI / 1.9}
//           rotateSpeed={0.22}
//           dampingFactor={0.08}
//           enableDamping
//         />
//       </Canvas>
//       <div
//         aria-hidden
//         style={{
//           position: "absolute",
//           inset: 0,
//           pointerEvents: "none",
//           background: "radial-gradient(circle at 52% 46%, transparent 34%, rgba(6,7,8,.06) 57%, rgba(6,7,8,.76) 100%)",
//         }}
//       />
//     </div>
//   );
// }

// function SearchShell() {
//   const phrases = useMemo(() => ["facebook/react", "vercel/next.js", "microsoft/vscode"], []);
//   const [index, setIndex] = useState(0);
//   const [text, setText] = useState(phrases[0]);
//   const [running, setRunning] = useState(true);
//   const reduce = useReducedMotion();

//   useEffect(() => {
//     if (reduce) return;
//     const target = phrases[index];
//     const delay = running ? 64 : 1300;
//     const t = window.setTimeout(() => {
//       if (running) {
//         if (text.length < target.length) setText(target.slice(0, text.length + 1));
//         else setRunning(false);
//       } else {
//         if (text.length > 0) setText(text.slice(0, -1));
//         else {
//           setIndex((index + 1) % phrases.length);
//           setRunning(true);
//         }
//       }
//     }, delay);
//     return () => window.clearTimeout(t);
//   }, [index, phrases, reduce, running, text]);

//   return (
//     <Glass style={{ maxWidth: 590, borderRadius: 16 }}>
//       <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, padding: 9 }}>
//         <Search size={15} color={T.faint} />
//         <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 12.5, color: T.text, whiteSpace: "nowrap", overflow: "hidden" }}>
//           {text}<motion.span aria-hidden animate={reduce ? undefined : { opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.85 }} style={{ color: T.purple }}>▌</motion.span>
//         </div>
//         <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${T.borderBright}`, background: "rgba(255,255,255,.045)", color: T.text, padding: "8px 11px", borderRadius: 9, cursor: "pointer", fontSize: 10.5, fontWeight: 800 }}>
//           <Command size={12} /> Find issues
//         </button>
//       </div>
//     </Glass>
//   );
// }

// function Hero() {
//   return (
//     <section style={{ maxWidth: 1440, margin: "0 auto", padding: "132px 40px 110px", position: "relative" }}>
//       <div aria-hidden style={{ position: "absolute", left: "6%", top: 80, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,.1), transparent 68%)", filter: "blur(42px)" }} />
//       <div aria-hidden style={{ position: "absolute", right: "2%", top: 160, width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,165,250,.06), transparent 68%)", filter: "blur(38px)" }} />

//       <div style={{ display: "grid", gridTemplateColumns: "0.78fr 1.22fr", gap: 30, alignItems: "center" }}>
//         <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }} style={{ position: "relative", zIndex: 5 }}>
//           <motion.div variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, color: "#C9BFFF", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase" }}>
//             <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, boxShadow: `0 0 15px ${T.green}` }} /> GitHub issue intelligence
//           </motion.div>

//           <motion.h1 variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }} style={{ margin: 0, maxWidth: 640, fontFamily: "var(--font-grotesk)", fontSize: "clamp(50px, 6vw, 86px)", lineHeight: 0.94, letterSpacing: "-.065em", fontWeight: 760 }}>
//             Stop scrolling.<br />
//             <span style={{ color: "#858B94" }}>Start contributing.</span>
//           </motion.h1>

//           <motion.p variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0 } }} style={{ margin: "27px 0 29px", maxWidth: 560, color: T.muted, fontSize: 16, lineHeight: 1.72 }}>
//             Triage turns the open-source backlog into a map: which repositories matter, which issues are worth understanding, and where you can actually start.
//           </motion.p>

//           <motion.div variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}>
//             <SearchShell />
//             <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 14, color: T.faint, fontFamily: "var(--font-mono)", fontSize: 9.5 }}>
//               <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Sparkles size={11} /> live product concept</span>
//               <span>·</span>
//               <span>repo-first discovery</span>
//             </div>
//           </motion.div>

//           <motion.div variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 31 }}>
//             <Magnetic>
//               <a href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 11, background: T.text, color: "#090A0B", textDecoration: "none", fontSize: 13, fontWeight: 850, boxShadow: "0 16px 38px rgba(255,255,255,.07)" }}>
//                 Explore issues <ArrowRight size={15} />
//               </a>
//             </Magnetic>
//             <a href="#how-it-works" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.muted, textDecoration: "none", fontSize: 13 }}>See how it works <ArrowUpRight size={14} /></a>
//           </motion.div>

//           <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 40 }}>
//             <StatPill icon={<GitBranch size={13} color={T.purple} />} value="repo → issue" label="mental model" />
//             <StatPill icon={<Filter size={13} color={T.blue} />} value="context first" label="triage" />
//             <StatPill icon={<GitPullRequest size={13} color={T.green} />} value="actionable" label="handoff" />
//           </motion.div>
//         </motion.div>

//         <div style={{ position: "relative", minHeight: 650 }}>
//           <HeroScene />
//           <div style={{ position: "absolute", right: 18, top: 22, zIndex: 4, display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 9px", borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(7,9,11,.6)", color: T.faint, fontFamily: "var(--font-mono)", fontSize: 8.5, backdropFilter: "blur(14px)" }}>
//             <Activity size={11} color={T.green} /> live issue triage
//           </div>
//           <Glass style={{ position: "absolute", left: 18, bottom: 26, width: 295, borderRadius: 18, zIndex: 4 }}>
//             <div style={{ position: "relative", zIndex: 1, padding: 13 }}>
//               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
//                 <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: T.faint, textTransform: "uppercase", letterSpacing: ".08em" }}>selected issue</span>
//                 <span style={{ color: T.green, fontFamily: "var(--font-mono)", fontSize: 8 }}>context ready</span>
//               </div>
//               <div style={{ fontSize: 12.5, fontWeight: 760, lineHeight: 1.4, color: T.text }}>Streaming server actions should preserve request context</div>
//               <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
//                 {["vercel/next.js", "14 comments", "medium"].map((x, i) => <span key={x} style={{ padding: "4px 7px", borderRadius: 7, background: i === 2 ? `${T.orange}0D` : "rgba(255,255,255,.035)", border: `1px solid ${i === 2 ? T.orange + "24" : T.border}`, color: i === 2 ? T.orange : T.muted, fontFamily: "var(--font-mono)", fontSize: 7.8 }}>{x}</span>)}
//               </div>
//             </div>
//           </Glass>
//           <div aria-hidden style={{ position: "absolute", left: "8%", bottom: 34, width: 360, height: 170, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,.09), transparent 70%)", filter: "blur(20px)" }} />
//         </div>
//       </div>
//     </section>
//   );
// }

// function FeatureRail() {
//   const features = [
//     { icon: <Search size={18} />, kicker: "01 / discover", title: "See the backlog as a landscape.", body: "Start with the repository you care about, then surface open work without treating every issue as equally important.", color: T.purple },
//     { icon: <CircleDot size={18} />, kicker: "02 / understand", title: "Read the issue before the code.", body: "Labels, activity, comments, age, and repository context become one decision surface instead of five browser tabs.", color: T.blue },
//     { icon: <GitPullRequest size={18} />, kicker: "03 / contribute", title: "Hand yourself a starting point.", body: "Once an issue makes sense, jump back to GitHub with the context already assembled.", color: T.green },
//   ];

//   return (
//     <section id="features" style={{ maxWidth: 1440, margin: "0 auto", padding: "50px 40px 135px" }}>
//       <Reveal>
//         <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 30, alignItems: "end", marginBottom: 34 }}>
//           <div>
//             <p style={{ margin: "0 0 11px", color: T.purple, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".15em", textTransform: "uppercase" }}>// the product thesis</p>
//             <h2 style={{ margin: 0, fontFamily: "var(--font-grotesk)", fontSize: "clamp(37px, 4.4vw, 62px)", lineHeight: 0.99, letterSpacing: "-.05em" }}>GitHub gives you<br /><span style={{ color: T.faint }}>the work.</span></h2>
//           </div>
//           <p style={{ margin: "0 0 3px", maxWidth: 590, justifySelf: "end", color: T.muted, fontSize: 15, lineHeight: 1.74 }}>Triage exists one layer above GitHub: not another issue tracker, not another dashboard, but a faster way to decide what deserves your attention.</p>
//         </div>
//       </Reveal>

//       <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
//         {features.map((f, i) => (
//           <Reveal key={f.kicker} delay={i * 0.07}>
//             <Tilt style={{ height: "100%" }}>
//               <div style={{ height: "100%", minHeight: 300, padding: 22, borderRadius: 22, border: `1px solid ${T.border}`, background: "linear-gradient(145deg, rgba(255,255,255,.04), rgba(255,255,255,.012))", transformStyle: "preserve-3d" }}>
//                 <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 13, border: `1px solid ${f.color}2E`, background: `${f.color}0C`, color: f.color }}>{f.icon}</div>
//                 <p style={{ margin: "46px 0 9px", fontFamily: "var(--font-mono)", color: f.color, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase" }}>{f.kicker}</p>
//                 <h3 style={{ margin: "0 0 12px", maxWidth: 320, fontFamily: "var(--font-grotesk)", fontSize: 25, lineHeight: 1.05, letterSpacing: "-.035em" }}>{f.title}</h3>
//                 <p style={{ margin: 0, color: T.muted, fontSize: 12.7, lineHeight: 1.68, maxWidth: 370 }}>{f.body}</p>
//               </div>
//             </Tilt>
//           </Reveal>
//         ))}
//       </div>

//       <Reveal style={{ marginTop: 12 }}>
//         <Glass style={{ borderRadius: 24 }}>
//           <div style={{ display: "grid", gridTemplateColumns: "1fr .76fr", gap: 18, padding: 15 }}>
//             <div style={{ padding: "19px 18px 16px" }}>
//               <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 15 }}>
//                 <div>
//                   <div style={{ fontFamily: "var(--font-mono)", color: T.faint, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".12em" }}>live triage surface</div>
//                   <div style={{ fontFamily: "var(--font-grotesk)", fontSize: 21, marginTop: 5 }}>Issues worth opening next.</div>
//                 </div>
//                 <div style={{ display: "inline-flex", gap: 5, padding: "7px 9px", borderRadius: 9, border: `1px solid ${T.border}`, color: T.muted, fontFamily: "var(--font-mono)", fontSize: 9.5 }}><Filter size={11} /> 3 filters</div>
//               </div>
//               <div style={{ display: "grid", gap: 8 }}>{ISSUES.map((issue, i) => <IssueRow issue={issue} index={i} key={issue.number} />)}</div>
//             </div>
//             <div style={{ minHeight: 410, borderRadius: 20, border: `1px solid ${T.border}`, background: "radial-gradient(circle at 50% 40%, rgba(167,139,250,.08), transparent 55%), #0B0D10", position: "relative", overflow: "hidden" }}>
//               <div style={{ position: "absolute", top: 16, left: 18, right: 18, display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 9, color: T.faint }}><span>issue inspector</span><span>01 / 03</span></div>
//               <MiniIssueInspector />
//               <div style={{ position: "absolute", left: 18, bottom: 16, color: T.faint, fontFamily: "var(--font-mono)", fontSize: 8.8 }}>context is the UI</div>
//             </div>
//           </div>
//         </Glass>
//       </Reveal>
//     </section>
//   );
// }

// function MiniIssueInspector() {
//   const activity = [
//     { label: "issue opened", time: "3d", color: T.blue },
//     { label: "maintainer replied", time: "19h", color: T.purple },
//     { label: "discussion active", time: "4h", color: T.green },
//     { label: "candidate ready", time: "now", color: T.orange },
//   ];

//   return (
//     <div style={{ position: "absolute", inset: 0, padding: "54px 18px 18px" }}>
//       <div style={{ display: "grid", gridTemplateColumns: "1.28fr .82fr", gap: 10, height: "100%" }}>
//         <div style={{ padding: 14, borderRadius: 16, border: `1px solid ${T.border}`, background: "linear-gradient(145deg, rgba(255,255,255,.035), rgba(255,255,255,.012))" }}>
//           <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.faint, fontFamily: "var(--font-mono)", fontSize: 8.5 }}>
//             <CircleDot size={10} color={T.blue} /> vercel/next.js · #62841
//           </div>
//           <div style={{ marginTop: 14, fontSize: 15, lineHeight: 1.35, fontWeight: 760 }}>Streaming server actions should preserve request context</div>
//           <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
//             {["enhancement", "14 comments", "medium"].map((x, i) => (
//               <span key={x} style={{ padding: "4px 6px", borderRadius: 6, border: `1px solid ${i === 2 ? T.orange + "2B" : T.border}`, color: i === 2 ? T.orange : T.muted, background: i === 2 ? `${T.orange}0D` : "rgba(255,255,255,.03)", fontFamily: "var(--font-mono)", fontSize: 7.6 }}>{x}</span>
//             ))}
//           </div>
//           <div style={{ marginTop: 18, paddingTop: 13, borderTop: `1px solid ${T.border}` }}>
//             <div style={{ color: T.faint, fontFamily: "var(--font-mono)", fontSize: 8, textTransform: "uppercase", letterSpacing: ".1em" }}>why it surfaced</div>
//             <p style={{ margin: "9px 0 0", color: T.muted, fontSize: 10.5, lineHeight: 1.55 }}>Active discussion, manageable scope, and a clear path to inspect the code make this a stronger starting point.</p>
//           </div>
//         </div>

//         <div style={{ padding: 13, borderRadius: 16, border: `1px solid ${T.border}`, background: "rgba(255,255,255,.018)" }}>
//           <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.faint, fontFamily: "var(--font-mono)", fontSize: 8 }}><Activity size={10} /> activity signal</div>
//           <div style={{ marginTop: 12, display: "grid", gap: 11 }}>
//             {activity.map((item) => (
//               <div key={item.label} style={{ display: "grid", gridTemplateColumns: "10px 1fr auto", gap: 7, alignItems: "center" }}>
//                 <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.color, boxShadow: `0 0 10px ${item.color}55` }} />
//                 <span style={{ color: T.muted, fontSize: 8.8, lineHeight: 1.25 }}>{item.label}</span>
//                 <span style={{ color: T.faint, fontFamily: "var(--font-mono)", fontSize: 7.2 }}>{item.time}</span>
//               </div>
//             ))}
//           </div>
//           <div style={{ marginTop: 18, paddingTop: 13, borderTop: `1px solid ${T.border}` }}>
//             <div style={{ color: T.faint, fontFamily: "var(--font-mono)", fontSize: 7.8 }}>decision</div>
//             <div style={{ marginTop: 7, color: T.green, fontFamily: "var(--font-mono)", fontSize: 9 }}>worth investigating</div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function WorkflowMock() {
//   const rows = [
//     { step: "01", title: "Choose a repository", desc: "Start from a codebase you genuinely care about.", icon: <GitCommit size={14} />, color: T.purple },
//     { step: "02", title: "Filter the backlog", desc: "Reduce hundreds of open issues to the ones worth reading.", icon: <Filter size={14} />, color: T.blue },
//     { step: "03", title: "Inspect context", desc: "See labels, discussion, activity and repository relationships together.", icon: <Search size={14} />, color: T.orange },
//     { step: "04", title: "Open the contribution path", desc: "Return to GitHub knowing exactly why you picked it.", icon: <GitMerge size={14} />, color: T.green },
//   ];

//   return (
//     <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 34, alignItems: "center" }}>
//       <Reveal>
//         <div>
//           <p style={{ margin: "0 0 11px", color: T.blue, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase" }}>// how it works</p>
//           <h2 style={{ margin: "0 0 16px", fontFamily: "var(--font-grotesk)", fontSize: "clamp(39px, 4.7vw, 63px)", lineHeight: .96, letterSpacing: "-.05em" }}>A straight line<br /><span style={{ color: T.faint }}>to the first commit.</span></h2>
//           <p style={{ margin: "0 0 30px", maxWidth: 490, color: T.muted, fontSize: 15, lineHeight: 1.75 }}>The product should feel like a bridge between curiosity and contribution—not a replacement for GitHub.</p>
//           <div style={{ display: "grid", gap: 8 }}>
//             {rows.map((row, i) => (
//               <Reveal key={row.step} delay={i * .055}>
//                 <div style={{ display: "grid", gridTemplateColumns: "42px 1fr 22px", gap: 12, alignItems: "center", padding: "14px 0", borderTop: i === 0 ? `1px solid ${T.border}` : "0", borderBottom: `1px solid ${T.border}` }}>
//                   <span style={{ color: row.color, fontFamily: "var(--font-mono)", fontSize: 9.5 }}>{row.step}</span>
//                   <div>
//                     <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 720 }}><span style={{ color: row.color }}>{row.icon}</span>{row.title}</div>
//                     <div style={{ marginTop: 4, color: T.muted, fontSize: 11.5, lineHeight: 1.55 }}>{row.desc}</div>
//                   </div>
//                   <ArrowRight size={14} color={T.faint} />
//                 </div>
//               </Reveal>
//             ))}
//           </div>
//         </div>
//       </Reveal>

//       <Reveal delay={.09}>
//         <Tilt>
//           <Glass style={{ borderRadius: 30 }}>
//             <div style={{ position: "relative", zIndex: 1, padding: 15 }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 11px", border: `1px solid ${T.border}`, borderRadius: 13, background: "rgba(255,255,255,.02)" }}>
//                 <GitCommit size={14} color={T.text} />
//                 <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: T.text }}>vercel/next.js</span>
//                 <span style={{ marginLeft: "auto", color: T.faint, fontFamily: "var(--font-mono)", fontSize: 8.5 }}>repository</span>
//               </div>

//               <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
//                 <div style={{ minHeight: 108, padding: 13, borderRadius: 15, border: `1px solid ${T.border}`, background: "rgba(255,255,255,.02)" }}>
//                   <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.faint, fontFamily: "var(--font-mono)", fontSize: 8.5 }}><Star size={11} /> metadata</div>
//                   <div style={{ marginTop: 12, display: "grid", gap: 6, color: T.muted, fontSize: 10.5 }}><span>28k stars</span><span>8.3k forks</span><span>active today</span></div>
//                 </div>
//                 <div style={{ minHeight: 108, padding: 13, borderRadius: 15, border: `1px solid ${T.border}`, background: "rgba(255,255,255,.02)" }}>
//                   <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.faint, fontFamily: "var(--font-mono)", fontSize: 8.5 }}><GitPullRequest size={11} /> activity</div>
//                   <div style={{ marginTop: 12, height: 43, display: "flex", alignItems: "end", gap: 4 }}>{[18,26,14,36,27,42,31,47,38,51,43,56].map((h, i) => <div key={i} style={{ flex: 1, height: h, borderRadius: 4, background: `linear-gradient(180deg, ${i > 7 ? T.green : T.blue}AA, transparent)` }} />)}</div>
//                 </div>
//               </div>

//               <div style={{ marginTop: 9, padding: 14, borderRadius: 15, border: `1px solid ${T.borderBright}`, background: "linear-gradient(135deg, rgba(167,139,250,.07), rgba(255,255,255,.015))" }}>
//                 <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.purple, fontFamily: "var(--font-mono)", fontSize: 9 }}><Sparkles size={11} /> candidate issue</div>
//                 <div style={{ marginTop: 10, color: T.text, fontSize: 14, lineHeight: 1.45, fontWeight: 720 }}>Add support for streaming in server actions</div>
//                 <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
//                   {["enhancement", "14 comments", "medium", "recent activity"].map((x, i) => <span key={x} style={{ padding: "4px 7px", borderRadius: 7, background: i === 2 ? `${T.orange}0E` : "rgba(255,255,255,.04)", border: `1px solid ${i === 2 ? T.orange + "2A" : T.border}`, color: i === 2 ? T.orange : T.muted, fontFamily: "var(--font-mono)", fontSize: 8.3 }}>{x}</span>)}
//                 </div>
//                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 15, paddingTop: 11, borderTop: `1px solid ${T.border}` }}>
//                   <span style={{ color: T.faint, fontFamily: "var(--font-mono)", fontSize: 8.5 }}>context assembled</span>
//                   <span style={{ color: T.green, fontFamily: "var(--font-mono)", fontSize: 8.5 }}>ready for GitHub ↗</span>
//                 </div>
//               </div>
//             </div>
//           </Glass>
//         </Tilt>
//       </Reveal>
//     </div>
//   );
// }

// function HowItWorks() {
//   return (
//     <section id="how-it-works" style={{ maxWidth: 1440, margin: "0 auto", padding: "0 40px 135px" }}>
//       <WorkflowMock />
//     </section>
//   );
// }

// function ProofStrip() {
//   return (
//     <section style={{ maxWidth: 1440, margin: "0 auto", padding: "0 40px 110px" }}>
//       <Reveal>
//         <div style={{ display: "grid", gridTemplateColumns: "1.2fr repeat(3,.6fr)", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
//           <div style={{ padding: "25px 0", paddingRight: 40 }}>
//             <div style={{ color: T.faint, fontFamily: "var(--font-mono)", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".13em" }}>what makes the product different</div>
//             <div style={{ marginTop: 8, maxWidth: 520, color: T.text, fontFamily: "var(--font-grotesk)", fontSize: 23, lineHeight: 1.14, letterSpacing: "-.03em" }}>Less dashboard. More decision surface.</div>
//           </div>
//           {[
//             ["01", "Repository-first", "Start from a codebase, not an anonymous feed."],
//             ["02", "Context-rich", "Make the issue understandable before it becomes a task."],
//             ["03", "GitHub-native", "The end state is contribution, not another app."],
//           ].map(([n, title, body]) => (
//             <div key={n} style={{ padding: "25px 20px", borderLeft: `1px solid ${T.border}` }}>
//               <div style={{ color: T.purple, fontFamily: "var(--font-mono)", fontSize: 9.5 }}>{n}</div>
//               <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 750 }}>{title}</div>
//               <div style={{ marginTop: 7, color: T.muted, fontSize: 10.5, lineHeight: 1.5 }}>{body}</div>
//             </div>
//           ))}
//         </div>
//       </Reveal>
//     </section>
//   );
// }

// function FinalCTA() {
//   const reduce = useReducedMotion();
//   return (
//     <section style={{ maxWidth: 1440, margin: "0 auto", padding: "0 40px 120px" }}>
//       <Reveal>
//         <Glass style={{ borderRadius: 34 }}>
//           <div style={{ position: "relative", minHeight: 410, overflow: "hidden", display: "grid", placeItems: "center" }}>
//             <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 42%, rgba(167,139,250,.13), transparent 36%), radial-gradient(circle at 70% 60%, rgba(96,165,250,.07), transparent 42%)" }} />
//             <motion.div aria-hidden animate={reduce ? undefined : { rotate: 360 }} transition={{ repeat: Infinity, duration: 24, ease: "linear" }} style={{ position: "absolute", width: 360, height: 120, border: `1px solid ${T.purple}29`, borderRadius: "50%", transform: "rotateX(62deg)" }} />
//             <motion.div aria-hidden animate={reduce ? undefined : { rotate: -360 }} transition={{ repeat: Infinity, duration: 30, ease: "linear" }} style={{ position: "absolute", width: 520, height: 180, border: `1px solid ${T.blue}12`, borderRadius: "50%", transform: "rotateX(62deg) rotateZ(25deg)" }} />
//             <div style={{ position: "relative", zIndex: 2, maxWidth: 650, textAlign: "center", padding: "65px 25px" }}>
//               <p style={{ margin: "0 0 11px", color: T.green, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase" }}>// ready to find your next issue?</p>
//               <h2 style={{ margin: "0 0 17px", fontFamily: "var(--font-grotesk)", fontSize: "clamp(42px, 5.8vw, 72px)", lineHeight: .93, letterSpacing: "-.06em" }}>The backlog is huge.<br /><span style={{ color: T.faint }}>Your starting point isn't.</span></h2>
//               <p style={{ maxWidth: 520, margin: "0 auto 28px", color: T.muted, fontSize: 14.5, lineHeight: 1.7 }}>Open-source contribution should begin with a better question: “Which problem can I understand and move forward?”</p>
//               <Magnetic>
//                 <a href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 21px", borderRadius: 11, background: T.text, color: "#090A0B", textDecoration: "none", fontSize: 13.5, fontWeight: 850 }}>Explore GitHub issues <ArrowRight size={15} /></a>
//               </Magnetic>
//             </div>
//           </div>
//         </Glass>
//       </Reveal>
//     </section>
//   );
// }

// function Nav() {
//   const { scrollY, scrollYProgress } = useScroll();
//   const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });
//   const [small, setSmall] = useState(false);

//   useEffect(() => scrollY.on("change", (v) => setSmall(v > 30)), [scrollY]);

//   return (
//     <motion.nav
//       animate={{ height: small ? 58 : 70 }}
//       transition={{ type: "spring", stiffness: 300, damping: 30 }}
//       style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 60, padding: "0 38px", display: "flex", alignItems: "center", justifyContent: "space-between", background: small ? "rgba(6,7,8,.73)" : "transparent", borderBottom: `1px solid ${small ? T.border : "transparent"}`, backdropFilter: small ? "blur(22px)" : "none", WebkitBackdropFilter: small ? "blur(22px)" : "none" }}
//     >
//       <motion.div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 1, background: `linear-gradient(90deg, ${T.purple}, ${T.blue}, ${T.green})`, scaleX: progress, transformOrigin: "left" }} />
//       <a href="#top" style={{ display: "inline-flex", alignItems: "center", gap: 9, color: T.text, textDecoration: "none" }}>
//         <div style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 9, background: "#F7F8FA", color: "#090A0B" }}><GitCommit size={15} /></div>
//         <span style={{ fontFamily: "var(--font-grotesk)", fontWeight: 760, fontSize: 16 }}>Triage</span>
//       </a>
//       <div className="desktop-nav" style={{ display: "flex", gap: 28 }}>
//         <a href="#features" style={{ color: T.muted, textDecoration: "none", fontSize: 12.5 }}>Product</a>
//         <a href="#how-it-works" style={{ color: T.muted, textDecoration: "none", fontSize: 12.5 }}>How it works</a>
//       </div>
//       <Magnetic>
//         <a href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px", borderRadius: 9, border: `1px solid ${T.borderBright}`, background: "rgba(255,255,255,.045)", color: T.text, textDecoration: "none", fontSize: 11.5, fontWeight: 780 }}>Get started <ArrowRight size={13} /></a>
//       </Magnetic>
//     </motion.nav>
//   );
// }

// export default function LandingPage() {
//   return (
//     <div id="top" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`} style={{ minHeight: "100vh", overflowX: "hidden", color: T.text, fontFamily: "var(--font-inter), system-ui, sans-serif", background: "radial-gradient(circle at 50% -5%, rgba(167,139,250,.065), transparent 30%), #060708" }}>
//       <CursorGlow />
//       <Noise />
//       <div style={{ position: "relative", zIndex: 4 }}>
//         <Nav />
//         <Hero />
//         <FeatureRail />
//         <ProofStrip />
//         <HowItWorks />
//         <FinalCTA />
//         <footer style={{ maxWidth: 1440, margin: "0 auto", padding: "28px 40px 34px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, color: T.faint, fontSize: 10.5 }}>
//           <span style={{ fontFamily: "var(--font-grotesk)", fontWeight: 720, color: T.muted }}>Triage</span>
//           <span>GitHub issue discovery</span>
//           <a href="#top" style={{ color: T.muted, textDecoration: "none" }}>Back to top ↑</a>
//         </footer>
//       </div>

//       <style>{`
//         * { box-sizing: border-box; }
//         html { scroll-behavior: smooth; }
//         body { margin: 0; background: ${T.bg}; }
//         ::selection { background: rgba(167,139,250,.25); color: ${T.text}; }
//         button, a { font: inherit; }
//         a { transition: color .2s ease, opacity .2s ease, border-color .2s ease, background .2s ease; }
//         a:hover { opacity: .9; }
//         @media (max-width: 1050px) {
//           .desktop-nav { display: none !important; }
//         }
//         @media (max-width: 960px) {
//           section > div[style*="grid-template-columns: 0.78fr"] { grid-template-columns: 1fr !important; }
//           section > div[style*="grid-template-columns: 1fr 1.4fr"] { grid-template-columns: 1fr !important; }
//           section > div[style*="grid-template-columns: 1.2fr repeat(3,.6fr)"] { grid-template-columns: 1fr 1fr !important; }
//           section > div[style*="grid-template-columns: 1.2fr repeat(3,.6fr)"] > div:first-child { grid-column: 1 / -1; }
//           section > div[style*="grid-template-columns: 0.85fr 1.15fr"] { grid-template-columns: 1fr !important; }
//           .hero-scene-placeholder { min-height: 500px !important; }
//         }
//         @media (max-width: 720px) {
//           nav { padding: 0 18px !important; }
//           section { padding-left: 20px !important; padding-right: 20px !important; }
//           footer { padding-left: 20px !important; padding-right: 20px !important; flex-wrap: wrap; }
//           section > div[style*="repeat(3,1fr)"] { grid-template-columns: 1fr !important; }
//           section > div[style*="grid-template-columns: 1fr .76fr"] { grid-template-columns: 1fr !important; }
//           section > div[style*="grid-template-columns: 1fr 1.4fr"] { grid-template-columns: 1fr !important; }
//           h1 { font-size: 56px !important; }
//           .desktop-nav { display: none !important; }
//         }
//         @media (prefers-reduced-motion: reduce) {
//           html { scroll-behavior: auto; }
//         }
//       `}</style>
//     </div>
//   );
// }