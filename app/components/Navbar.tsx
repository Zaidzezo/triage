"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Bookmark,
  ChevronDown,
  Clock3,
  Compass,
  Search,
  UserRound,
  LogOut,
} from "lucide-react";
import {
  signIn,
  signOut,
  useSession,
} from "next-auth/react";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

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

const T = {
  bg: "#08090D",
  glass: "rgba(13, 16, 24, 0.72)",
  glassStrong: "rgba(20, 25, 37, 0.82)",
  border: "rgba(255,255,255,0.09)",
  borderBright: "rgba(255,255,255,0.15)",
  text: "#F5F7FB",
  muted: "#9299A8",
  faint: "#565D6C",
  violet: "#9B8CFF",
  violetDim: "rgba(155,140,255,0.12)",
};

export default function Navbar() {
  const { data: session } = useSession();

  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close avatar dropdown on outside click
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close avatar dropdown on Escape key
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Wire up the "/" shortcut to focus the search input
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = query.trim();
    if (!cleaned) return;
    router.push(`/?repo=${encodeURIComponent(cleaned)}`);
  }

  // Show at most 2 initials; fall back gracefully if name is missing
  const rawName =
    session?.user?.githubUsername ?? session?.user?.name ?? "";
  const initials = rawName.length > 0 ? rawName.slice(0, 2).toUpperCase() : "?";

  const links = [
    { href: "/", label: "Discover", icon: <Compass size={14} /> },
    { href: "/saved", label: "Saved", icon: <Bookmark size={14} /> },
    { href: "/activity", label: "Activity", icon: <Clock3 size={14} /> },
  ];

  return (
    <nav
      className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 72,
        display: "flex",
        alignItems: "center",
        padding: "0 28px",
        gap: 22,
        background: "rgba(8,9,13,0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: `1px solid ${T.border}`,
        color: T.text,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      {/* Ambient underline */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -1,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(155,140,255,0.38), transparent)",
          pointerEvents: "none",
        }}
      />

      {/* Logo*/}
      <Link
        href="/"
        style={{
          position: "relative",
          width: 290,
          height: 70,
          marginBottom: 115,
          flexShrink: 0,
          textDecoration: "none",
        }}
      >
        <Image
          src="/logo.svg"
          alt="Triage"
          sizes="290px"
          width={290}
          height={70}
          priority
          style={{ objectFit: "contain" }}
        />
      </Link>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 575 }}>
        <div
          style={{
            height: 39,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "0 12px",
            borderRadius: 10,
            border: `1px solid ${T.border}`,
            background: "rgba(255,255,255,0.025)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
          }}
        >
          <Search size={14} color={T.faint} />

          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find issues by repository..."
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: T.text,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
            }}
          />

          <span
            style={{
              padding: "3px 6px",
              borderRadius: 5,
              border: `1px solid ${T.border}`,
              color: T.faint,
              fontFamily: "var(--font-mono)",
              fontSize: 8,
            }}
          >
            /
          </span>
        </div>
      </form>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        {links.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 8,
                border: active
                  ? "1px solid rgba(155,140,255,0.20)"
                  : "1px solid transparent",
                background: active ? T.violetDim : "transparent",
                color: active ? "#D2CDFF" : T.muted,
                textDecoration: "none",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                whiteSpace: "nowrap",
              }}
            >
              {icon}
              {label}
            </Link>
          );
        })}
      </div>

      {/* Account */}
      {session ? (
        <div ref={dropdownRef} style={{ position: "relative", marginLeft: 4 }}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              height: 39,
              padding: "0 8px",
              border: `1px solid ${T.borderBright}`,
              borderRadius: 9,
              background: "rgba(255,255,255,0.025)",
              color: T.text,
              cursor: "pointer",
            }}
          >
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                style={{
                  width: 25,
                  height: 25,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: 25,
                  height: 25,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  background: T.violetDim,
                  color: "#D2CDFF",
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  fontWeight: 800,
                }}
              >
                {initials}
              </div>
            )}
            <ChevronDown size={12} color={T.faint} />
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 220,
                padding: 5,
                border: `1px solid ${T.borderBright}`,
                borderRadius: 12,
                background: "rgba(13,16,24,0.97)",
                backdropFilter: "blur(25px)",
                WebkitBackdropFilter: "blur(25px)",
                boxShadow: "0 25px 70px rgba(0,0,0,0.45)",
              }}
            >
              <div
                style={{
                  padding: "10px 10px 12px",
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UserRound size={13} color={T.violet} />
                  <div>
                    <p
                      style={{
                        margin: 0,
                        color: T.text,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {session.user?.name ?? session.user?.githubUsername}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        color: T.faint,
                        fontFamily: "var(--font-mono)",
                        fontSize: 8.5,
                      }}
                    >
                      @{session.user?.githubUsername}
                    </p>
                  </div>
                </div>
              </div>

              <button
                role="menuitem"
                onClick={() => signOut()}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                  padding: "9px 10px",
                  border: "none",
                  borderRadius: 8,
                  background: "transparent",
                  color: "#FF9CA9",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 10.5,
                }}
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => signIn("github")}
          style={{
            height: 37,
            padding: "0 14px",
            border: "none",
            borderRadius: 9,
            background: T.violet,
            color: T.bg,
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 10px 28px rgba(155,140,255,0.18)",
          }}
        >
          Sign in
        </button>
      )}

      <style>{`
        @media (max-width: 1100px) {
          nav { padding: 0 18px !important; gap: 12px !important; }
          nav > form { max-width: 360px !important; }
        }
        @media (max-width: 850px) {
          nav > div:nth-of-type(2) { display: none !important; }
        }
        @media (max-width: 650px) {
          nav { height: 64px !important; }
          nav > a { width: 125px !important; }
          nav > form { display: none !important; }
        }
      `}</style>
    </nav>
  );
}