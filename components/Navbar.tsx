"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "./LogoutButton";

type NavbarProps = {
  user: {
    name: string;
    email: string;
  } | null;
};

export default function Navbar({ user }: NavbarProps) {

  const pathname = usePathname();

const [theme, setTheme] = useState("dark");
const [isMobile, setIsMobile] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);
const [accountMenuOpen, setAccountMenuOpen] = useState(false);
const accountMenuRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 768);
  check();
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);

useEffect(() => {
  const saved = localStorage.getItem("theme");

  const initialTheme = saved || "dark";

  setTheme(initialTheme);

  document.documentElement.classList.toggle(
    "dark",
    initialTheme === "dark"
  );
}, []);

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (
      accountMenuRef.current &&
      !accountMenuRef.current.contains(event.target as Node)
    ) {
      setAccountMenuOpen(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);

  return () =>
    document.removeEventListener("mousedown", handleClickOutside);
}, []);

const toggleTheme = () => {
  const newTheme =
    theme === "dark" ? "light" : "dark";

  setTheme(newTheme);

  localStorage.setItem("theme", newTheme);

  document.documentElement.classList.toggle(
    "dark",
    newTheme === "dark"
  );
};

if (pathname.startsWith("/broadcast")) {
  return null;
}

const linkStyle = (path: string, exact = false) => {
  const active = exact
    ? pathname === path
    : pathname.startsWith(path);

  return `
    flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all
  `.trim();
};

return (

<div
className={`h-[60px] flex items-center ${isMobile ? "px-3" : "px-5"} sticky top-0 z-[10000] shadow-md`}style={{
  background: "var(--panel)",
  borderBottom: "1px solid var(--border)",
  position: "relative" // 👈 ADD THIS
}}
>

{/* LEFT */}
<div className="flex items-center">

<Link
href="/"
className="flex items-center gap-3 text-white no-underline"
>

<img
src="/landscape.png"
alt="Ireland Votes"
style={{
height: "45px",
width: "auto",
filter: "var(--logo-filter)"
}}
/>

<span
  style={{
    fontSize: "9px",
    marginLeft: "-11px",
    color: "#00dfef",
    fontWeight: 500,
    opacity: 0.6,
    letterSpacing: "0.02em",
    transform: "translateY(-2px)" // 👈 THIS is the key
  }}
>
  Beta
</span>

</Link>

</div>


{/* SPACER */}
<div className="flex-1" />


{/* CENTER */}
{!isMobile && (
  <div className="flex items-center gap-3 text-sm font-medium">

<Link
  href="/"
  className={linkStyle("/", true)}
  style={{
    background: pathname === "/" ? "var(--panel-2)" : "transparent",
    color: pathname === "/" ? "var(--text)" : "var(--text-muted)"
  }}
>
  Home
</Link>

<Link
  href="/polling/ireland/dail"
  className={linkStyle("/polling/ireland/dail", true)}
  style={{
    background: pathname === "/polling/ireland/dail" ? "var(--panel-2)" : "transparent",
    color: pathname === "/polling/ireland/dail" ? "var(--text)" : "var(--text-muted)"
  }}
>
  Polling
</Link>

<Link
  href="/elections"
  className={linkStyle("/elections", true)}
  style={{
    background: pathname === "/elections" ? "var(--panel-2)" : "transparent",
    color: pathname === "/elections" ? "var(--text)" : "var(--text-muted)"
  }}
>
  Elections
</Link>

<Link
  href="/about"
  className={linkStyle("/about", true)}
  style={{
    background:
      pathname === "/about"
        ? "var(--panel-2)"
        : "transparent",
    color:
      pathname === "/about"
        ? "var(--text)"
        : "var(--text-muted)"
  }}
>
  About
</Link>

</div>
)}


{/* SPACER */}
<div className="flex-1" />


{/* RIGHT */}
<div className="flex items-center gap-2">

  {/* MOBILE: hamburger only */}
  {isMobile && (
    <button
    onClick={() => setMenuOpen(!menuOpen)} // 👈 ADD THIS
      style={{
        width: "38px",
        height: "38px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ width: "16px", height: "2px", background: "var(--text)" }} />
        <span style={{ width: "16px", height: "2px", background: "var(--text)" }} />
        <span style={{ width: "16px", height: "2px", background: "var(--text)" }} />
      </div>
    </button>
  )}

  {/* DESKTOP: full controls */}
  {!isMobile && (
    <>

{user ? (
<div
  ref={accountMenuRef}
  style={{
    position: "relative",
  }}
>
    <button
      onClick={() => setAccountMenuOpen(!accountMenuOpen)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        background: "transparent",
        border: "none",
        color: "var(--text)",
        cursor: "pointer",
        padding: "6px 4px",
        fontSize: "14px",
        fontWeight: 500,
      }}
    >
      <UserIcon />

      <span>Hi, {user.name}</span>

      <ChevronIcon open={accountMenuOpen} />
    </button>

    {accountMenuOpen && (
      <div
style={{
  position: "absolute",
  top: "calc(100% + 12px)",
  right: 0,
  width: "260px",

background: "color-mix(in srgb, var(--panel) 88%, transparent)",
backdropFilter: "blur(18px)",
WebkitBackdropFilter: "blur(18px)",

border: "1px solid var(--border)",
borderRadius: "10px",
boxShadow:
  "0 12px 40px rgba(0,0,0,.18)",

  overflow: "hidden",
  zIndex: 100000,
  opacity: accountMenuOpen ? 1 : 0,
transform: accountMenuOpen
  ? "translateY(0)"
  : "translateY(-8px)",
transition: "all .18s ease",
}}
      >
        <div
  style={{
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  }}
>
  <div
    style={{
      fontSize: "12px",
      color: "var(--text-muted)",
      marginBottom: "4px",
    }}
  >
    Signed in as
  </div>

  <div
    style={{
      fontSize: "14px",
      fontWeight: 600,
      color: "var(--text)",
      wordBreak: "break-word",
    }}
  >
    {user.email}
  </div>
</div>

<Link
  href="/account"
style={{
  display: "block",
  padding: "12px 16px",
  color: "var(--text)",
  textDecoration: "none",
  transition: "background .18s ease",
}}
>
  My Account
</Link>

<LogoutButton />
      </div>
    )}
  </div>
) : (
  <>
    <Link href="/login" className={linkStyle("/login", true)}>
      Log In
    </Link>
  </>
)}

      {/* THEME TOGGLE */}
      <button
        onClick={toggleTheme}
        className="w-9 h-9 rounded-full border border-gray-700 bg-gray-800 hover:bg-gray-700 transition flex items-center justify-center"
        title="Toggle theme"
      >
      {theme === "dark" ? (
<svg
  viewBox="0 0 24 24"
  width="18"
  height="18"
  fill="none"
  stroke="#00dfef"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  style={{
    filter: "drop-shadow(0 0 4px rgba(0,223,239,0.6))"
  }}
>
  <circle cx="12" cy="12" r="4" />
  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
</svg>
        ) : (
          <svg
  viewBox="0 0 24 24"
  width="18"
  height="18"
  fill="none"
  stroke="#00dfef"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  style={{
    filter: "drop-shadow(0 0 4px rgba(0,223,239,0.6))"
  }}
>
            <path d="M21.64 13.65A9 9 0 1110.35 2.36 7 7 0 0021.64 13.65z"/>
          </svg>
        )}
      </button>
    </>
  )}

</div>

{isMobile && (
<>
{/* BACKDROP */}
<div
onClick={() => setMenuOpen(false)}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.4)",
backdropFilter: "blur(4px)",
opacity: menuOpen ? 1 : 0,
pointerEvents: menuOpen ? "auto" : "none",
transition: "opacity 0.25s ease",
zIndex: 10001
}}
/>

{/* DRAWER */}
<div
  style={{
    position: "fixed",
    top: 0,
    right: 0,
    height: "100%",
    width: "280px",
    background: "var(--panel)",
    borderLeft: "1px solid var(--border)",
    transform: menuOpen ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
    zIndex: 10002,
    display: "flex",
    flexDirection: "column",
    padding: "16px"
  }}
>

  {/* HEADER */}
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px"
    }}
  >
    <div style={{ fontWeight: 600, fontSize: "14px", opacity: 0.8 }}>
      Browse
    </div>

    <button onClick={() => setMenuOpen(false)}>
      ✕
    </button>
  </div>

{/* NAV */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  }}
>
  <Link
    href="/"
    onClick={() => setMenuOpen(false)}
    className={linkStyle("/", true)}
  >
    Home
  </Link>

  <Link
    href="/polling/ireland/dail"
    onClick={() => setMenuOpen(false)}
    className={linkStyle("/polling")}
  >
    Polling
  </Link>

  <Link
    href="/elections"
    onClick={() => setMenuOpen(false)}
    className={linkStyle("/elections")}
  >
    Elections
  </Link>

  <Link
    href="/about"
    onClick={() => setMenuOpen(false)}
    className={linkStyle("/about")}
  >
    About
  </Link>
</div>

<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "18px 0",
    marginTop: 12,
    borderTop: "1px solid var(--border)",
  }}
>
  {user ? (
    <>
      <div style={{ padding: "4px 12px 8px", color: "var(--text-muted)", fontSize: 13, overflowWrap: "anywhere" }}>
        Signed in as<br /><strong style={{ color: "var(--text)" }}>{user.email}</strong>
      </div>
      <Link href="/account" onClick={() => setMenuOpen(false)} className={linkStyle("/account")}>
        My Account
      </Link>
      <LogoutButton />
    </>
  ) : (
    <>
      <Link href="/login" onClick={() => setMenuOpen(false)} className={linkStyle("/login")}>
        Log In
      </Link>
    </>
  )}
</div>

  {/* PUSH CONTENT DOWN */}
  <div style={{ flex: 1 }} />

  {/* ACTIONS (same as desktop) */}
  <div style={{ display: "flex", gap: "0px" }}>
    <button
      onClick={toggleTheme}
      className="w-9 h-9 rounded-full border border-gray-700 bg-gray-800 flex items-center justify-center"
    >
      {theme === "dark" ? (
<svg
  viewBox="0 0 24 24"
  width="18"
  height="18"
  fill="none"
  stroke="#00dfef"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  style={{
    filter: "drop-shadow(0 0 4px rgba(0,223,239,0.6))"
  }}
>
  <circle cx="12" cy="12" r="4" />
  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
</svg>
        ) : (
          <svg
  viewBox="0 0 24 24"
  width="18"
  height="18"
  fill="none"
  stroke="#00dfef"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  style={{
    filter: "drop-shadow(0 0 4px rgba(0,223,239,0.6))"
  }}
>
            <path d="M21.64 13.65A9 9 0 1110.35 2.36 7 7 0 0021.64 13.65z"/>
          </svg>
        )}
    </button>
  </div>

</div>

</>
)}


{/* BRAND ACCENT LINE */}
<div
  style={{
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: "1px",
    opacity: 0.9,
    boxShadow: "0 0 8px rgba(0,223,239,0.6)",
    background: "linear-gradient(90deg, transparent, #00dfef, transparent)"
  }}
/>

</div>

);

}

function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
        opacity: 0.7,
      }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
