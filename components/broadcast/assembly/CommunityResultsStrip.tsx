import { communityResults } from "@/lib/broadcast/assemblyChart";
import type { BroadcastState, CountUpdate } from "@/lib/broadcast/engine";
import { outlineBroadcastText } from "./OutlinedText";
import styles from "./assembly.module.css";

export default function CommunityResultsStrip({ data, constituency, compact = false, baseline, showChanges = false }: { data: BroadcastState; constituency?: string; compact?: boolean; baseline?: CountUpdate[] | null; showChanges?: boolean }) {
  const rows = communityResults(data, constituency, baseline);
  return outlineBroadcastText(<section className={`${styles.communityStrip} ${compact ? styles.communityCompact : ""}`} aria-label={`${constituency ?? "Overall"} community results`}>
    <div className={styles.communitySections}>{rows.map(row => <div className={styles.communitySection} key={row.code} style={{ backgroundColor: row.color }}>
      <strong className={styles.communityName}>{row.name}</strong>
      <div className={styles.communityFigures}><b>{row.share.toFixed(1)}<small>%</small></b><span className={styles.tileFigureSwap} key={showChanges ? "changes" : "votes"}>{showChanges ? row.change === undefined ? "—" : <>{row.change > 0 ? "+" : ""}{row.change.toFixed(1)} <small>pp</small></> : <>{row.votes.toLocaleString("en-GB")} <small>votes</small></>}</span><strong>{row.seats} <small>{row.seats === 1 ? "seat" : "seats"}</small></strong></div>
    </div>)}</div>
  </section>);
}
