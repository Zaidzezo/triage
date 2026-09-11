"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import {
  ArrowLeft,
  Check,
  GitBranch,
  GitCommit,
  LockKeyhole,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Inter,
  JetBrains_Mono,
  Space_Grotesk,
} from "next/font/google";

import { signIn } from "next-auth/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  bg: "#08090D",
  bg2: "#0D1018",

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
};

const EASE = [0.22, 1, 0.36, 1] as const;

// ─────────────────────────────────────────────────────────────────────────────
// NOISE
// ─────────────────────────────────────────────────────────────────────────────

function Noise() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        opacity: 0.035,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CURSOR SPOTLIGHT
// ─────────────────────────────────────────────────────────────────────────────

function CursorSpotlight() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const pos = useRef({
    x: -600,
    y: -600,
    tx: -600,
    ty: -600,
  });

  useEffect(() => {
    if (reduce) return;

    const move = (e: MouseEvent) => {
      pos.current.tx = e.clientX;
      pos.current.ty = e.clientY;
    };

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

    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(frame);
    };
  }, [reduce]);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAGNETIC
// ─────────────────────────────────────────────────────────────────────────────

function Magnetic({
  children,
  strength = 0.2,
}: {
  children: React.ReactNode;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const x = useSpring(0, {
    stiffness: 220,
    damping: 18,
  });

  const y = useSpring(0, {
    stiffness: 220,
    damping: 18,
  });

  return (
    <motion.div
      ref={ref}
      style={{
        display: "inline-block",
        x,
        y,
      }}
      onMouseMove={(e) => {
        if (reduce || !ref.current) return;

        const r = ref.current.getBoundingClientRect();

        x.set(
          (e.clientX - r.left - r.width / 2) * strength
        );

        y.set(
          (e.clientY - r.top - r.height / 2) * strength
        );
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GLASS CARD
// ─────────────────────────────────────────────────────────────────────────────

function GlassCard({
  children,
  radius = 22,
  className,
  style,
}: {
  children: React.ReactNode;
  radius?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const rx = useSpring(0, {
    stiffness: 260,
    damping: 28,
  });

  const ry = useSpring(0, {
    stiffness: 260,
    damping: 28,
  });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        transformStyle: "preserve-3d",
        transformPerspective: 1200,
        rotateX: rx,
        rotateY: ry,
        ...style,
      }}
      onMouseMove={(e) => {
        if (reduce || !ref.current) return;

        const r = ref.current.getBoundingClientRect();

        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;

        ry.set((px - 0.5) * 5.5);
        rx.set((0.5 - py) * 5.5);
      }}
      onMouseLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      whileHover={reduce ? undefined : { z: 10 }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          borderRadius: "inherit",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.075), transparent 38%, rgba(155,140,255,0.045))",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      />

      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGO
// ─────────────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <a
      href="/"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        color: T.text,
        textDecoration: "none",
      }}
    >
      <motion.div
        whileHover={{
          rotate: 8,
          scale: 1.05,
        }}
        style={{
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          borderRadius: 9,
          background: T.violet,
          boxShadow:
            "0 0 28px rgba(155,140,255,0.34)",
        }}
      >
        <Search
          size={15}
          color={T.bg}
          strokeWidth={2.8}
        />
      </motion.div>

      <span
        style={{
          fontFamily: "var(--font-grotesk)",
          fontSize: 17,
          fontWeight: 750,
          letterSpacing: "-0.02em",
        }}
      >
        Triage
      </span>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE CARD
//
// IMPORTANT:
// This component itself is the animated element.
// Its parent is responsible for absolute positioning.
// Therefore CSS positioning never conflicts with Framer Motion transforms.
// ─────────────────────────────────────────────────────────────────────────────

function IssueCard({
  rotate,
  delay,
  repo,
  title,
  label,
  labelColor,
  style,
}: {
  rotate: number;
  delay: number;
  repo: string;
  title: string;
  label: string;
  labelColor: string;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      style={{
        position: "absolute",
        ...style,
      }}
    >
      <motion.div
        initial={
          reduce
            ? undefined
            : {
                opacity: 0,
                y: 16,
                scale: 0.94,
                rotate,
              }
        }
        animate={
          reduce
            ? undefined
            : {
                opacity: 1,
                y: [0, -5, 0],
                scale: 1,
                rotate,
              }
        }
        transition={
          reduce
            ? undefined
            : {
                opacity: {
                  duration: 0.6,
                  delay,
                },
                scale: {
                  duration: 0.6,
                  delay,
                },
                y: {
                  duration: 5 + delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay,
                },
                rotate: {
                  duration: 0.6,
                  delay,
                },
              }
        }
        style={{
          width: 188,
          padding: 14,
          borderRadius: 14,
          background:
            "linear-gradient(145deg, rgba(28,33,48,0.94), rgba(12,15,23,0.81))",
          border: `1px solid ${T.borderBright}`,
          boxShadow:
            "0 28px 65px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.08)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginBottom: 9,
          }}
        >
          <GitBranch size={12} color={T.violet} />

          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8.5,
              color: "#C7C2FF",
              whiteSpace: "nowrap",
            }}
          >
            {repo}
          </span>
        </div>

        <div
          style={{
            fontSize: 11.5,
            fontWeight: 650,
            lineHeight: 1.45,
            color: T.text,
            marginBottom: 11,
          }}
        >
          {title}
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 8px",
            borderRadius: 999,
            background: `${labelColor}12`,
            border: `1px solid ${labelColor}32`,
            color: labelColor,
            fontSize: 8.5,
            fontWeight: 700,
          }}
        >
          {label}
        </span>
      </motion.div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL CORE
//
// Again: wrapper handles absolute positioning.
// Motion child handles animation.
// ─────────────────────────────────────────────────────────────────────────────

function Core() {
  const reduce = useReducedMotion();

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "55%",
        width: 235,
        height: 270,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
        perspective: 1200,
      }}
    >
      <motion.div
        initial={
          reduce
            ? undefined
            : {
                opacity: 0,
                scale: 0.84,
              }
        }
        animate={
          reduce
            ? undefined
            : {
                opacity: 1,
                scale: 1,
                y: [0, -7, 0],
                rotateY: [0, 3, 0, -3, 0],
              }
        }
        transition={{
          opacity: {
            duration: 0.8,
          },
          scale: {
            duration: 0.8,
            ease: EASE,
          },
          y: {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          },
          rotateY: {
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 25,
            borderRadius: 40,
            background:
              "radial-gradient(circle, rgba(155,140,255,0.24), transparent 70%)",
            filter: "blur(28px)",
            transform: "translateZ(-60px)",
          }}
        />

        <GlassCard
          radius={26}
          style={{
            width: "100%",
            height: "100%",
            marginTop: 70,
            background:
              "linear-gradient(145deg, rgba(29,34,51,0.97), rgba(10,13,20,0.92))",
            border: `1px solid ${T.borderBright}`,
            boxShadow:
              "0 45px 100px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.09)",
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 3,
              height: "100%",
              padding: 19,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            {/* Chrome */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 5,
                }}
              >
                {[0, 1, 2].map((x) => (
                  <span
                    key={x}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background:
                        "rgba(255,255,255,0.14)",
                    }}
                  />
                ))}
              </div>

              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 7.5,
                  color: T.faint,
                }}
              >
                triage.auth
              </span>
            </div>

            {/* GitHub */}
            <div
              style={{
                display: "grid",
                placeItems: "center",
              }}
            >
              <motion.div
                animate={
                  reduce
                    ? undefined
                    : {
                        boxShadow: [
                          "0 0 0 1px rgba(155,140,255,0.14), 0 0 25px rgba(155,140,255,0.16)",
                          "0 0 0 1px rgba(155,140,255,0.28), 0 0 46px rgba(155,140,255,0.30)",
                          "0 0 0 1px rgba(155,140,255,0.14), 0 0 25px rgba(155,140,255,0.16)",
                        ],
                      }
                }
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{
                  width: 82,
                  height: 82,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 24,
                  background:
                    "linear-gradient(145deg, rgba(43,48,68,0.98), rgba(18,21,31,0.96))",
                  border:
                    "1px solid rgba(255,255,255,0.12)",
                  transform:
                    "translateZ(38px) rotateX(6deg) rotateY(-6deg)",
                }}
              >
                <GitCommit
                  size={43}
                  strokeWidth={1.7}
                  color={T.text}
                />
              </motion.div>

              <div
                style={{
                  marginTop: 14,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-grotesk)",
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                  }}
                >
                  Connect GitHub
                </div>

                <p
                  style={{
                    margin: "6px auto 0",
                    maxWidth: 190,
                    color: T.muted,
                    fontSize: 9.5,
                    lineHeight: 1.55,
                  }}
                >
                  Your repositories become the starting point for better
                  issue discovery.
                </p>
              </div>
            </div>

            {/* Status */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 9px",
                borderRadius: 10,
                background:
                  "rgba(255,255,255,0.035)",
                border: `1px solid ${T.border}`,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: T.lime,
                  boxShadow:
                    "0 0 11px rgba(184,243,107,0.75)",
                }}
              />

              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 7.5,
                  color: T.muted,
                }}
              >
                secure oauth connection
              </span>

              <LockKeyhole
                size={10}
                color={T.faint}
                style={{
                  marginLeft: "auto",
                  flexShrink: 0,
                }}
              />
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN VISUAL
// ─────────────────────────────────────────────────────────────────────────────

function LoginVisual() {
  const reduce = useReducedMotion();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "visible",
        perspective: 1500,
      }}
    >
      {/* Glow */}
      <motion.div
        aria-hidden
        animate={
          reduce
            ? undefined
            : {
                scale: [1, 1.06, 1],
                opacity: [0.3, 0.48, 0.3],
              }
        }
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: "absolute",
          width: 500,
          height: 390,
          left: "50%",
          top: "54%",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(155,140,255,0.17), transparent 68%)",
          filter: "blur(34px)",
          pointerEvents: "none",
        }}
      />

      {/* Technical grid */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 30,
          opacity: 0.34,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 76% 80% at 50% 55%, black 8%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 76% 80% at 50% 55%, black 8%, transparent 78%)",
          pointerEvents: "none",
        }}
      />

      {/* ───── TOP CARD ───── */}
      <IssueCard
        style={{
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
        }}
        rotate={4}
        delay={0.12}
        repo="vercel/next.js"
        title="Improve server action streaming"
        label="enhancement"
        labelColor={T.violet}
      />

      {/* ───── LEFT CARD ───── */}
      <IssueCard
        style={{
          top: "70%",
          left: 0,
          transform: "translateY(-50%)",
        }}
        rotate={-5}
        delay={0.28}
        repo="facebook/react"
        title="Warn for keyed fragments"
        label="good first issue"
        labelColor={T.lime}
      />

      {/* ───── RIGHT CARD ───── */}
      <IssueCard
        style={{
          top: "70%",
          right: 0,
          transform: "translateY(-50%)",
        }}
        rotate={5}
        delay={0.42}
        repo="microsoft/vscode"
        title="Improve screen reader support"
        label="accessibility"
        labelColor={T.amber}
      />

      {/* Core */}
      <Core />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN PANEL
// ─────────────────────────────────────────────────────────────────────────────

function LoginPanel() {
  const benefits = [
    {
      icon: <Target size={16} />,
      title: "Personalized matches",
      text: "Surface issues that fit your interests and goals.",
    },
    {
      icon: <Sparkles size={16} />,
      title: "AI-assisted context",
      text: "Understand scope, difficulty, and next steps faster.",
    },
    {
      icon: <Search size={16} />,
      title: "Focused workflow",
      text: "Spend less time searching and more time building.",
    },
  ];

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: 30,
      }}
      animate={{
        opacity: 1,
        x: 0,
      }}
      transition={{
        duration: 0.8,
        ease: EASE,
        delay: 0.1,
      }}
      style={{
        position: "relative",
        zIndex: 10,
      }}
    >
      <GlassCard radius={26}>
        <div
          style={{
            position: "relative",
            zIndex: 3,
            padding: "38px 38px 32px",
            background:
              "linear-gradient(145deg, rgba(20,24,36,0.88), rgba(10,13,19,0.78))",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            border: `1px solid ${T.border}`,
            boxShadow:
              "0 40px 100px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: "15%",
              right: "15%",
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(155,140,255,0.7), transparent)",
              boxShadow:
                "0 0 20px rgba(155,140,255,0.3)",
            }}
          />

          <Logo />

          {/* Heading */}
          <div
            style={{
              marginTop: 30,
            }}
          >
            <p
              style={{
                margin: "0 0 9px",
                color: T.violet,
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
              }}
            >
              // authentication
            </p>

            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-grotesk)",
                fontSize: "clamp(38px, 4vw, 52px)",
                lineHeight: 0.98,
                letterSpacing: "-0.05em",
                fontWeight: 700,
              }}
            >
              Welcome
              <br />
              <span style={{ color: T.violet }}>
                back.
              </span>
            </h1>

            <p
              style={{
                margin: "15px 0 0",
                maxWidth: 370,
                color: T.muted,
                fontSize: 13.5,
                lineHeight: 1.65,
              }}
            >
              Connect your GitHub account and turn open-source discovery
              into a focused workflow.
            </p>
          </div>

          {/* GitHub button */}
<div
  style={{
    marginTop: 27,
  }}
>
  <Magnetic strength={0.08}>
    <motion.button
      type="button"
      onClick={() => signIn("github", { callbackUrl: "/" })}
      whileHover={{
        scale: 1.012,
      }}
      whileTap={{
        scale: 0.985,
      }}
      style={{
        width: "100%",
        minHeight: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        border: "none",
        borderRadius: 11,
        background: T.violet,
        color: T.bg,
        cursor: "pointer",
        fontFamily: "var(--font-inter)",
        fontSize: 13,
        fontWeight: 800,
        boxShadow:
          "0 14px 38px rgba(155,140,255,0.22)",
      }}
    >
      <GitCommit
        size={18}
        strokeWidth={2.2}
        style={{ marginLeft: 15 }}
      />

      Continue with GitHub

      <ArrowLeft
        size={14}
        style={{
          transform: "rotate(135deg)",
          marginRight: 15,
        }}
      />
    </motion.button>
  </Magnetic>
</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              marginTop: 12,
            }}
          >
            <LockKeyhole size={11} color={T.faint} />

            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 8.5,
                color: T.faint,
              }}
            >
              github oauth · no password stored
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "26px 0 20px",
            }}
          >
            <div
              style={{
                flex: 1,
                height: 1,
                background: T.border,
              }}
            />

            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: T.faint,
                fontSize: 8,
              }}
            >
              AFTER SIGN IN
            </span>

            <div
              style={{
                flex: 1,
                height: 1,
                background: T.border,
              }}
            />
          </div>

          {/* Benefits */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 11,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--font-grotesk)",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                What you get
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gap: 8,
              }}
            >
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{
                    opacity: 0,
                    y: 10,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    duration: 0.5,
                    delay: 0.3 + index * 0.07,
                    ease: EASE,
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "36px minmax(0, 1fr) 18px",
                    alignItems: "center",
                    columnGap: 11,
                    padding: "10px 11px",
                    minHeight: 58,
                    borderRadius: 11,
                    background:
                      "rgba(255,255,255,0.025)",
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 9,
                      color: T.violet,
                      background: T.violetDim,
                      border:
                        "1px solid rgba(155,140,255,0.2)",
                    }}
                  >
                    {benefit.icon}
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: T.text,
                      }}
                    >
                      {benefit.title}
                    </div>

                    <div
                      style={{
                        marginTop: 2,
                        color: T.faint,
                        fontSize: 9.5,
                        lineHeight: 1.4,
                      }}
                    >
                      {benefit.text}
                    </div>
                  </div>

                  <Check
                    size={12}
                    color={T.lime}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div
            style={{
              marginTop: 15,
              padding: "10px 12px",
              borderRadius: 10,
              background:
                "rgba(255,255,255,0.025)",
              border: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <LockKeyhole
              size={13}
              color={T.violet}
              style={{
                marginTop: 1,
                flexShrink: 0,
              }}
            />

            <p
              style={{
                margin: 0,
                color: T.faint,
                fontSize: 9.5,
                lineHeight: 1.55,
              }}
            >
              Triage only requests the GitHub permissions required for the
              product workflow. It does not silently modify your
              repositories.
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <main
      className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}
      style={{
        minHeight: "100vh",
        overflowX: "hidden",
        color: T.text,
        background:
          `radial-gradient(circle at 50% -15%, rgba(155,140,255,0.09), transparent 38%), ${T.bg}`,
        fontFamily:
          "var(--font-inter), system-ui, sans-serif",
      }}
    >
      <CursorSpotlight />
      <Noise />

      <div
        style={{
          position: "relative",
          zIndex: 4,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <header
          style={{
            height: 72,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 40px",
            borderBottom:
              "1px solid rgba(255,255,255,0.045)",
          }}
        >
          <Logo />

          <motion.a
            href="/"
            whileHover={{
              x: -2,
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              color: T.muted,
              textDecoration: "none",
              fontSize: 12,
              fontWeight: 650,
            }}
          >
            <ArrowLeft size={14} />
            Back to home
          </motion.a>
        </header>

        {/* Main */}
        <section
          className="login-layout"
          style={{
            width: "100%",
            maxWidth: 1380,
            margin: "0 auto",
            padding: "38px 40px 55px",
            flex: 1,
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.12fr) minmax(410px, 0.78fr)",
            gap: 58,
            alignItems: "start",
          }}
        >
          {/* LEFT */}
          <div
            className="login-left"
            style={{
              position: "relative",
              minWidth: 0,
              height: 690,
            }}
          >
            {/* Heading */}
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.8,
                ease: EASE,
              }}
              style={{
                position: "relative",
                zIndex: 20,
                maxWidth: 650,
              }}
            >
              <p
                style={{
                  margin: "7px 0 12px",
                  color: T.violet,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                // your open-source workspace
              </p>

              <h2
                style={{
                  margin: 0,
                  fontFamily: "var(--font-grotesk)",
                  fontSize: "clamp(42px, 4.7vw, 64px)",
                  lineHeight: 0.97,
                  letterSpacing: "-0.055em",
                  fontWeight: 700,
                }}
              >
                Find the work.
                <br />
                <span style={{ color: T.violet }}>
                  Know what matters.
                </span>
              </h2>

              <p
                style={{
                  margin: "18px 0 0",
                  maxWidth: 460,
                  color: T.muted,
                  fontSize: 14.5,
                  lineHeight: 1.7,
                }}
              >
                Connect GitHub once. Triage turns your contribution
                search into a cleaner, more intentional starting point.
              </p>
            </motion.div>

            {/* Visual stage */}
            <div
              className="login-visual"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 220,
                height: 455,
              }}
            >
              <LoginVisual />
            </div>
          </div>

          {/* RIGHT */}
          <div
            className="login-panel-wrap"
            style={{
              width: "100%",
              maxWidth: 510,
              margin: "8px auto 0",
            }}
          >
            <LoginPanel />
          </div>
        </section>

        {/* Footer */}
        <footer
          className="login-footer"
          style={{
            width: "100%",
            maxWidth: 1380,
            margin: "0 auto",
            padding: "0 40px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <span
            style={{
              color: T.faint,
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
            }}
          >
            triage / authentication
          </span>

          <span
            style={{
              color: T.faint,
              fontSize: 10.5,
            }}
          >
            © 2026 Triage
          </span>

          <span
            style={{
              color: T.faint,
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
            }}
          >
            secure connection
          </span>
        </footer>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: ${T.bg};
        }

        ::selection {
          background: rgba(155,140,255,0.28);
          color: ${T.text};
        }

        a {
          transition:
            color 180ms ease,
            border-color 180ms ease,
            background 180ms ease,
            opacity 180ms ease;
        }

        a:hover {
          color: ${T.text} !important;
        }

        button {
          font-family: inherit;
        }

        .login-layout {
          min-height: 690px;
        }

        @media (max-width: 1100px) {
          .login-layout {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            min-height: auto;
          }

          .login-panel-wrap {
            order: 1;
            max-width: 540px !important;
            margin: 0 auto !important;
          }

          .login-left {
            order: 2;
            height: 610px !important;
          }
        }

        @media (max-width: 760px) {
          header {
            height: 64px !important;
            padding: 0 18px !important;
          }

          header a {
            font-size: 11px !important;
          }

          .login-layout {
            padding:
              28px 18px 40px !important;
          }

          .login-left {
            height: 560px !important;
          }

          .login-visual {
            top: 205px !important;
            height: 355px !important;
          }

          .login-panel-wrap {
            max-width: 100% !important;
          }

          .login-left h2 {
            font-size: 43px !important;
          }
        }

        @media (max-width: 560px) {
          .login-left {
            height: 520px !important;
          }

          .login-visual {
            top: 195px !important;
            height: 325px !important;
          }

          .login-left h2 {
            font-size: 39px !important;
          }
        }

        @media (max-width: 470px) {
          .login-visual {
            transform: scale(0.84);
            transform-origin: top center;
            width: 119%;
            left: -9.5% !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }
        }
      `}</style>
    </main>
  );
}