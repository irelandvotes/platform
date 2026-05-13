"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] =
    useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(
        window.innerWidth < 900
      );
    };

    check();

    window.addEventListener(
      "resize",
      check
    );

    return () =>
      window.removeEventListener(
        "resize",
        check
      );
  }, []);

  return isMobile;
}

const aboutLinks = [
  {
    label: "Overview",
    href: "/about"
  },
    {
    label: "FAQs",
    href: "/about/faqs"
  },
  {
    label: "Meet the Team",
    href: "/about/team"
  },
  {
    label: "Disclaimer",
    href: "/about/disclaimer"
  },
  {
  label: "Privacy Policy",
  href: "/about/privacy"
},
  {
  label: "Terms of Service",
  href: "/about/terms"
},
  {
    label: "Contact",
    href: "/about/contact"
  }
];

export default function AboutLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isMobile = useIsMobile();

  const [menuOpen, setMenuOpen] =
    useState(false);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        position: "relative"
      }}
    >
      {/* MOBILE OVERLAY */}
      {isMobile && menuOpen && (
        <div
          onClick={() =>
            setMenuOpen(false)
          }
          style={{
            position: "fixed",
top: "60px",
left: 0,
right: 0,
bottom: 0,
            background:
              "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 100
          }}
        />
      )}

      {/* SIDEBAR / DRAWER */}
      <div
        style={{
          width: "260px",
          flexShrink: 0,
          borderRight:
            "1px solid var(--border)",
          background: "var(--panel)",
          padding: "12px",
          overflowY: "auto",

          ...(isMobile
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                height: "100%",
                zIndex: 101,
                transform:
                  isMobile &&
                  !menuOpen
                    ? "translateX(-100%)"
                    : "translateX(0)",
                transition:
                  "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
                boxShadow:
                  "0 0 40px rgba(0,0,0,0.35)"
              }
            : {})
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            marginBottom: "12px"
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              opacity: 0.9,
              marginLeft: "5px"
            }}
          >
            About
          </div>

          {isMobile && (
            <button
              onClick={() =>
                setMenuOpen(false)
              }
            >
              ✕
            </button>
          )}
        </div>

        {aboutLinks.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            pathname={pathname}
          />
        ))}
      </div>

      {/* MAIN CONTENT */}
<div
  style={{
    flex: 1,
    overflow: "auto",
    width: "100%",
    minWidth: 0
  }}
>
        {/* MOBILE BUTTON */}
        {isMobile && (
          <div
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              zIndex: 20
            }}
          >
            <button
              onClick={() =>
                setMenuOpen(true)
              }
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                border:
                  "1px solid var(--border)",
                background:
                  "rgba(20,20,20,0.7)",
                backdropFilter:
                  "blur(10px)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Browse
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  pathname
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active = pathname === href;

  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "12px",
        borderRadius: "10px",
        marginBottom: "8px",
        background: active
          ? "var(--panel-2)"
          : "var(--panel)",
        border:
          "1px solid var(--border)",
        fontSize: "13px",
        fontWeight: active ? 600 : 500,
        transition: "0.15s"
      }}
    >
      {label}
    </Link>
  );
}
