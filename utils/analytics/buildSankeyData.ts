export function buildSankeyData(
  transferData: any,
  PARTY_COLORS: Record<string, string>
) {

  if (!transferData) return null;

  const nodes: any[] = [];
  const links: any[] = [];

  /* Combined source node */
  const sourceLabel = transferData.sources
    .map((s: any) => {

      if (s.reason) {
        return `${s.name} (${s.party}) admin elimination`;
      }

      if (s.sourceType === "surplus") {
        return `${s.name} (${s.party}) surplus`;
      }

      return `${s.name} (${s.party})`;

    });

  nodes.push({
    name: sourceLabel.join("\n"),
    fill: "#666"
  });

  /* Receiving candidates */
  transferData.transfers.forEach((t: any) => {

    nodes.push({
      name:
        `${t.name} (${t.party}) +${t.gain.toLocaleString()}`,
      gain: t.gain,
      fill: PARTY_COLORS[t.party] || "#888"
    });

  });

  /* Links */
  transferData.transfers.forEach(
    (t: any, i: number) => {

      links.push({
        source: 0,
        target: i + 1,
        value: t.gain
      });

    }
  );

  return { nodes, links };

}