"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { createReplay, nationalSummary, nationalPartyCodes as codes, party, partyTextColor, type BroadcastState, type CountUpdate } from "@/lib/broadcast/engine";
import styles from "./assembly.module.css";

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
    const timer = window.setInterval(() => setPhase(value => (value + 1) % 4), 4000);
    return () => window.clearInterval(timer);
  }, [paused]);
  const { reporting, votes, oldVotes, seats, seatChanges, seatChangePending, total, oldTotal, elected } = nationalSummary(data, baseline);
  const rankedCodes = [...codes].sort((a, b) => {
    const otherOrder = Number(a === "OTHER") - Number(b === "OTHER");
    if (otherOrder) return otherOrder;
    const ranking = phase < 2 ? votes : seats;
    return (ranking[b] ?? 0) - (ranking[a] ?? 0) || (votes[b] ?? 0) - (votes[a] ?? 0) || codes.indexOf(a) - codes.indexOf(b);
  });
  return <section className={styles.nationalBar} aria-label="Overall party results">
    <div className={styles.nationalBarLabel}><strong>{phases[phase]}</strong><small>{phase < 2 ? `${reporting.length}/18 reporting · matched constituencies` : phase === 3 ? `${reporting.length}/18 reporting ? confirmed changes` : `${elected}/90 seats filled`}</small></div>
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
      return <div key={code} style={{ background: party(code).color, color: partyTextColor(party(code).color) }}><strong>{code === "OTHER" ? "Other" : code === "AP" ? "Alliance" : code}</strong><span className={styles.tileFigureSwap} key={phase}>{value}</span></div>;
    })}</div>
  </section>;
}
