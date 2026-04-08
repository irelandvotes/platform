export default function BroadcastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#111",
          overflow: "hidden"
        }}
      >
        {children}
      </body>
    </html>
  );
}