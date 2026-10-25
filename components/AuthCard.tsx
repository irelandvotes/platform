export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 480,
        background: "var(--sidebar-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: 22,
        padding: 36,
        backdropFilter: "blur(18px)",
        boxShadow: "0 20px 80px rgba(0,0,0,.35)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: "var(--hero-glow)",
          filter: "blur(70px)",
          opacity: 0.7,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 2 }}>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: "-1px",
            marginBottom: 10,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            opacity: 0.7,
            lineHeight: 1.6,
            marginBottom: 30,
          }}
        >
          {subtitle}
        </p>

        {children}
      </div>
    </div>
  );
}