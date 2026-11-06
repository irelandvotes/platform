
import { outlineBroadcastText } from "./OutlinedText";
import styles from "./assembly.module.css";

export default function ResultProgress({ label, value, total, status }: { label: string; value: number; total: number; status: string }) {
  return outlineBroadcastText(<div className={styles.resultProgress}>
    <div className={styles.resultProgressHeading}><span>{label}</span><strong>{value}/{total} {status}</strong></div>
    <div className={styles.resultProgressTrack} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}><span style={{ width: `${Math.min(100, value / total * 100)}%` }} /></div>
  </div>);
}
