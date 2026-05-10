export default function AboutSection({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
<div
  style={{
    width: "100%",
    minWidth: 0,
    minHeight: "100%",
        background: `
          radial-gradient(
            circle at top right,
            rgba(0,223,239,0.14),
            transparent 32%
          ),
          linear-gradient(
            180deg,
            rgba(0,223,239,0.05),
            transparent 55%
          )
        `
      }}
    >
      {/* HERO */}
      <div
        style={{
          position: "relative",
          overflow: "visible",
          padding:
            "72px clamp(24px, 6vw, 72px) 64px"
        }}
      >
        {/* LARGE GLOW */}
<div
  style={{
    position: "absolute",
    top: "-220px",
    right: 0,
    transform: "translateX(0%)",
    width: "680px",
    height: "680px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(0,223,239,0.12), transparent 72%)",
    pointerEvents: "none"
  }}
/>

        {/* ACCENT */}
        <div
          style={{
            width: "90px",
            height: "4px",
            borderRadius: "999px",
            marginBottom: "28px",
            background:
              "linear-gradient(90deg, #00dfef, rgba(0,223,239,0.25))",
            boxShadow:
              "0 0 18px rgba(0,223,239,0.4)"
          }}
        />

        {/* TITLE */}
        <div
          style={{
            fontSize:
              "clamp(44px, 8vw, 76px)",
            fontWeight: 800,
            lineHeight: 0.96,
            letterSpacing: "-0.05em",
            maxWidth: "920px",
            marginBottom: "26px"
          }}
        >
          {title}
        </div>

        {/* SUBTITLE */}
        {subtitle && (
          <div
            style={{
              maxWidth: "760px",
              fontSize: "18px",
              lineHeight: 1.9,
              opacity: 0.78
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* ARTICLE */}
      <div
        style={{
          padding:
            "0 clamp(24px, 6vw, 72px) 80px"
        }}
      >
        <div
          style={{
            maxWidth: "860px",
            fontSize: "17px",
            lineHeight: 2,
            opacity: 0.86
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}