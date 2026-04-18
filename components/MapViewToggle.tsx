"use client";

import { useState, useEffect } from "react";

export default function MapViewToggle({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
}) {
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      setMobile(window.innerWidth <= 640);
    };

    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, []);

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 10px",
    borderRadius: "7px",
    border: "1px solid var(--border)",
    background: active ? "var(--panel-2)" : "var(--panel)",
    color: "var(--text)",
    fontSize: "11px",
    fontWeight: active ? "600" : "500",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease"
  });

  /* DESKTOP / TABLET */
  if (!mobile) {
    return (
      <div
        style={{
          display: "flex",
          gap: "4px",
          flexWrap: "wrap",
          justifyContent: "flex-end"
        }}
      >
        {options.map((btn) => (
          <button
            key={btn.value}
            onClick={() => onChange(btn.value)}
            style={buttonStyle(value === btn.value)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    );
  }

  /* MOBILE */
  return (
    <div style={{ position: "relative" }}>
      {/* MENU BUTTON */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: "6px 10px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "var(--panel)",
          color: "var(--text)",
          fontSize: "12px",
          fontWeight: "600",
          cursor: "pointer"
        }}
      >
        ☰ Map
      </button>

      {/* DROPDOWN */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "110%",
            right: 0,
            minWidth: "140px",
            padding: "6px",
            borderRadius: "10px",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            zIndex: 2000
          }}
        >
          {options.map((btn) => (
            <button
              key={btn.value}
              onClick={() => {
                onChange(btn.value);
                setOpen(false);
              }}
              style={{
                ...buttonStyle(value === btn.value),
                textAlign: "left",
                width: "100%"
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}