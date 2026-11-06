"use client";

import { outlineBroadcastText } from "./OutlinedText";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { createReplay, nationalSummary, nationalPartyCodes as codes, party, partyTextColor, type BroadcastState, type CountUpdate } from "@/lib/broadcast/engine";
import styles from "./assembly.module.css";
import CommunityResultsStrip from "./CommunityResultsStrip";

const signed = (value: number, decimals = 0) => `${value > 0 ? "+" : ""}${value.toFixed(decimals)}`;
const phases = ["FIRST PREFERENCES", "SHARE CHANGE VS 2017", "SEATS WON", "SEAT CHANGE VS 2017"];

export default function NationalResultsBar({ data, paused }: { data: BroadcastState; paused: boolean }) {
  const [phase, setPhase] = useState(0);
  const [baseline, setBaseline] = useState<CountUpdate[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/elections/northern-ireland/assembly/2017/election_data.csv", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.text(); })
      .then(csv => {
        const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
        if (parsed.errors.length) throw new Error();
        setBaseline(createReplay(parsed.data));
      }).catch(() => { /* Missing comparisons display an em dash, never an invented change. */ });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => setPhase(value => (value + 1) % 6), phase === 5 ? 8000 : 4000);
    return () => window.clearTimeout(timer);
  }, [paused, phase]);
  const { reporting, votes, oldVotes, seats, seatChanges, seatChangePending, total, oldTotal, elected } = nationalSummary(data, baseline);
  const showConstituencies = !reporting.length || phase < 2;
  const progress = showConstituencies ? reporting.length : elected;
  const maximum = showConstituencies ? 18 : 90;
  const status = showConstituencies ? "declared" : "filled";
  const statusBar = <div className={styles.nationalStatus}><div className={styles.nationalStatusTrack} role="progressbar" aria-label={showConstituencies ? "First counts declared" : "Seats filled"} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={progress}><span style={{ width: `${progress / maximum * 100}%` }} /></div><strong>{progress}/{maximum} {status}</strong></div>;
  if (!reporting.length) return outlineBroadcastText(<section className={styles.nationalBar} aria-label="Count status"><div className={styles.nationalBarLabel}><strong>AWAITING RESULTS</strong>{statusBar}</div><div className={styles.waitingNationalProgress}><span>Results will appear as counts are declared</span></div></section>);
  if (phase >= 4) return outlineBroadcastText(<section className={styles.nationalBar} aria-label="Overall community results"><div className={styles.nationalBarLabel}><strong>{phase === 5 ? "COMMUNITY CHANGE VS 2017" : "COMMUNITY TOTALS"}</strong>{statusBar}</div><CommunityResultsStrip data={data} baseline={baseline} showChanges={phase === 5} compact /></section>);
  const rankedCodes = [...codes].sort((a, b) => {
    const otherOrder = Number(a === "OTHER") - Number(b === "OTHER");
    if (otherOrder) return otherOrder;
    const ranking = phase < 2 ? votes : seats;
    return (ranking[b] ?? 0) - (ranking[a] ?? 0) || (votes[b] ?? 0) - (votes[a] ?? 0) || codes.indexOf(a) - codes.indexOf(b);
  });
  return outlineBroadcastText(<section className={styles.nationalBar} aria-label="Overall party results">
    <div className={styles.nationalBarLabel}><strong>{phases[phase]}</strong>{statusBar}</div>
    <div className={styles.nationalBarTiles}>{rankedCodes.map(code => {
      const share = total ? (votes[code] ?? 0) / total * 100 : 0;
      let value = "—";
      if (phase === 0 && total) value = `${share.toFixed(1)}%`;
      if (phase === 1 && total && oldTotal) value = `${signed(share - (oldVotes[code] ?? 0) / oldTotal * 100, 1)} pp`;
      if (phase === 2) value = String(seats[code] ?? 0);
      if (phase === 3 && baseline && reporting.length) {
        const change = seatChanges[code] ?? 0;
        if (change !== 0 || !seatChangePending[code]) value = signed(change);
      }
      return outlineBroadcastText(<div key={code} style={{ background: party(code).color, color: partyTextColor(party(code).color) }}><strong>{code === "OTHER" ? "Other" : code === "AP" ? "Alliance" : code}</strong><span className={styles.tileFigureSwap} key={phase}>{value}</span></div>);
    })}</div>
  </section>);
}
