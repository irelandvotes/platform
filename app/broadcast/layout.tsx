export default function BroadcastLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ width: "100%", height: "100%", overflow: "auto", background: "#101820" }}>{children}</div>;
}
