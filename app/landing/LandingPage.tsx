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
import Image from "next/image";

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
<div
  style={{
    width: 290,
    height: 150,
    flexShrink: 0,
    position: "relative",
  }}
>
  <Image
    src="/logo.svg"
    loading="eager"
    alt="Triage"
    fill
    style={{
      objectFit: "contain",
    }}
  />
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
    <footer
      style={{
        maxWidth: 1600,
        margin: "0",
        padding: "2px 40px",
        borderTop: `1px solid ${T.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 200,
            height: 100,
            flexShrink: 0,
            position: "relative",
          }}
        >
          <Image
            src="/logo.svg"
            loading="eager"
            alt="Triage"
            fill
            style={{
              objectFit: "contain",
            }}
          />
        </div>
      </div>

      <span style={{ color: T.faint, fontSize: 11.5, marginBottom: 20 }}>
        © 2026 Triage
      </span>
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
