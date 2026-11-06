"use client";

import { outlineBroadcastText } from "./OutlinedText";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Papa from "papaparse";
import { candidateVoteChanges, coverageFrames, createReplay, party, rollingResults, type Story, type CountUpdate, initialState } from "@/lib/broadcast/engine";
import styles from "./assembly.module.css";

const ConstituencyMap = dynamic(() => import("./ConstituencyMap"), { ssr: false, loading: () => <div className={styles.coverageMapFrame}>Loading constituency map…</div> });
const number = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

export default function CountCoverage({ story, playing, frameIndex }: { story: Story; playing: boolean; frameIndex: number }) {
  const update = story.update;
  const [baseline, setBaseline] = useState<Record<string, CountUpdate>>({});
  useEffect(() => {
    if (update.count !== 1) return;
    const controller = new AbortController();
    fetch("/data/elections/northern-ireland/assembly/2017/election_data.csv", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.text(); })
      .then(csv => {
        const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
        if (parsed.errors.length) throw new Error();
        setBaseline(Object.fromEntries(createReplay(parsed.data).filter(count => count.count === 1).map(count => [count.constituency, count])));
      }).catch(() => { /* Unavailable comparisons remain explicitly blank. */ });
    return () => controller.abort();
  }, [update.count]);
  const frames = useMemo(() => coverageFrames(update), [update]);
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const candidates = candidateVoteChanges(update, story.previous).sort((a, b) =>
    (a.status === "elected" ? 0 : a.status === "running" ? 1 : 2) - (b.status === "elected" ? 0 : b.status === "running" ? 1 : 2) || b.votes - a.votes);
  const partyRows = update.count === 1 ? rollingResults({ ...initialState(), first: { [update.constituency]: update }, latest: { [update.constituency]: update } }, baseline).filter(row => row.phase === "PARTY FIRST PREFERENCES") : [];
  const elected = update.candidates.filter(c => c.status === "elected").length;
  const showingParties = update.count === 1 && (frame.kind === "intro" || frame.kind === "parties");
  const showingChanges = frame.kind === "parties" && frame.page === 1;
  return outlineBroadcastText(<div className={`${styles.countCoverage} ${frame.kind === "intro" ? styles.coverageIntroducing : ""} ${!playing ? styles.coveragePaused : ""}`}>
    <ConstituencyMap name={update.constituency} focus={frame.kind !== "intro"} />
    <div className={styles.coveragePanel}>
    <div className={styles.coverageHeading}><div><strong>COUNT {update.count}</strong><span>{elected}/{update.seats} elected</span></div>{!showingParties && <div className={styles.quotaCallout}><span>QUOTA</span><strong>{number(update.quota)}</strong></div>}<span className={styles.declaring}>DECLARING</span></div>
      <div className={styles.coverageStandings} key={frame.kind === "intro" ? "intro-hidden" : showingParties ? "parties" : `${frame.kind}:${frame.page}`}>
        {showingParties ? <div className={styles.partyPanelRows + (partyRows.length > 6 ? ' ' + styles.partyPanelDense : '')}>
          <div className={styles.partyPanelHeader}><span>PARTY</span><span>SHARE</span><span key={showingChanges ? "changes" : "votes"} className={styles.tileFigureSwap}>{showingChanges ? "CHANGE VS 2017" : "VOTES"}</span></div>
          {partyRows.map((row, rowIndex) => <div className={styles.partyPanelRow} key={row.id} style={{ borderLeftColor: row.color, animationDelay: rowIndex * 70 + 'ms' }}>
            <div className={styles.partyRowTint} style={{ background: row.color }} />
            <div className={styles.partyRowFill} style={{ width: row.share + '%', background: row.color, animationDelay: rowIndex * 70 + 150 + 'ms' }} />
            <strong className={styles.partyPanelName}>{row.name}</strong>
            <strong className={styles.partyPanelShare}>{row.share!.toFixed(1)}<small>%</small></strong>
            <strong className={styles.partyPanelValue} key={showingChanges ? "changes" : "votes"}>{!showingChanges ? number(row.votes) : row.change === undefined ? "—" : <>{row.change > 0 ? "+" : ""}{row.change.toFixed(1)}<small> pp</small></>}</strong>
          </div>)}
        </div> : <>
          <div className={styles.coverageTableHeader}><span>CANDIDATE</span><span>VOTES</span><span>{update.count > 1 ? "THIS COUNT" : "SHARE"}</span></div>
          {candidates.slice(frame.page * 6, frame.page * 6 + 6).map((candidate, rowIndex) => {
            const retained = candidate.status === "elected" && candidate.votes === 0;
            const color = party(candidate.party).color;
            const total = update.candidates.reduce((sum, c) => sum + c.votes, 0);
            return outlineBroadcastText(<div className={`${styles.coverageCandidate} ${candidate.status === "eliminated" ? styles.coverageEliminated : ""} ${candidate.status === "elected" ? styles.electedCandidate : ""}`} key={candidate.id} style={{ borderLeftColor: color, animationDelay: `${rowIndex * 70}ms`, "--elected-delay": `${900 + rowIndex * 120}ms` } as CSSProperties}>
              {candidate.status === "elected" && <><div className={styles.electedRowFill} style={{ background: color }} /><div className={styles.electedRowTick} style={{ color }} aria-label="Elected"><svg width="27" height="27" viewBox="0 0 16 16" fill="none"><path d="M4 8.5L7 11.5L12 5" pathLength="1" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg></div></>}
              {candidate.status === "eliminated" && <div className={styles.countElimination} />}
              <div className={styles.countCandidateIdentity}><div><strong>{candidate.name}</strong><small>{party(candidate.party).name}{candidate.incumbent && <span className={styles.broadcastIncumbent}>INCUMBENT</span>}{candidate.status === "eliminated" && <span className={styles.broadcastEliminated}>ELIMINATED</span>}</small></div></div>
              <b>{retained ? "ELECTED" : number(candidate.votes)}</b><span className={styles.coverageDelta} style={{ color: candidate.status === "elected" ? "#fff" : update.count > 1 && !retained ? candidate.change! > 0 ? "#4caf50" : candidate.change! < 0 ? "#f44336" : "#aaa" : undefined }}>{retained ? "" : update.count === 1 ? `${total ? (candidate.votes / total * 100).toFixed(1) : "0.0"}%` : candidate.change === undefined ? "—" : `${candidate.change > 0 ? "↑ +" : candidate.change < 0 ? "↓ " : "→ "}${number(candidate.change)}`}</span>
            </div>);
          })}
        </>}
        <p className={styles.note}>{frame.kind === "parties" ? "First-preference votes · Parties below 5% grouped as Other" : update.count > 1 ? `Vote changes since count ${story.previous?.count ?? "—"} · Standings at count ${update.count}` : "First-preference votes by candidate"}</p>
      </div>
    </div>
    {frame.kind === "intro" && <div className={styles.constituencyIntro}><div className={styles.titleAccent} aria-hidden="true" /><span>COUNT {update.count} DECLARED</span><strong>{update.constituency}</strong><div className={styles.titleUnderline} aria-hidden="true" /></div>}
  </div>);
}
