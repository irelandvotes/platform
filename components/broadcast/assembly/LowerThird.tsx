
import { outlineBroadcastText } from "./OutlinedText";
import styles from "./assembly.module.css";
import { party, partyTextColor, type Story, type BroadcastState } from "@/lib/broadcast/engine";
import RollingResults from "./RollingResults";
import NationalResultsBar from "./NationalResultsBar";
import type { PreResultsContent } from "./PreResults";

type LowerThirdProps = {
  data: BroadcastState;
  preResults: PreResultsContent;
  rollingPaused?: boolean;
  alert?: Story;
  paused?: boolean;
};

export default function LowerThird({
  data,
  preResults,
  rollingPaused = false,
  alert,
  paused = false,
}: LowerThirdProps) {
  const winner = alert?.kind === "seat" ? alert.candidate : undefined;
  const affiliation = winner ? party(winner.party) : undefined;
  return outlineBroadcastText(<footer className={styles.lowerThird} aria-label="Broadcast headlines">
    <div className={styles.nationalSlot}>
    <div hidden={!!alert}><NationalResultsBar data={data} paused={rollingPaused || !!alert} /></div>
    {alert && <div key={alert.id} className={`${styles.alertBar} ${paused ? styles.alertPaused : ""}`} style={{ background: "#444", color: partyTextColor(affiliation?.color ?? "#80d3cf") }} aria-live="polite">
      <div className={styles.alertFill} style={{ background: affiliation?.color ?? "#80d3cf" }} aria-hidden="true" />
      <div className={styles.alertIntro} aria-hidden="true"><span>ELECTION ALERT</span></div>
      <div className={styles.alertStatus}><span className={styles.alertTick} style={{ color: affiliation?.color ?? "#008f9b" }} aria-hidden="true"><svg width="40" height="40" viewBox="0 0 16 16" fill="none"><path className={styles.alertCheckPath} d="M4 8.5L7 11.5L12 5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" pathLength="1" /></svg></span></div>
      <div className={styles.alertIdentity}><strong>{winner?.name ?? alert.update.constituency}</strong><div className={styles.alertMetadata}>{affiliation ? <span>{affiliation.name}</span> : <b>ALL SEATS FILLED</b>}{winner?.incumbent && <small className={styles.incumbent}>INCUMBENT</small>}</div></div>
      <div className={styles.alertContext}><strong>{winner ? alert.update.constituency : "Constituency complete"}</strong><span>{winner ? `Elected on count ${alert.update.count}` : `Count ${alert.update.count} · ${alert.update.seats} seats filled`}</span></div>
    </div>}
    </div>
    <RollingResults data={data} preResults={preResults} paused={rollingPaused} />
  </footer>);
}
