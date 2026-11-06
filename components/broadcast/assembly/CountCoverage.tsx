"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { candidateVoteChanges, coverageFrames, party, rollingResults, type Story, initialState } from "@/lib/broadcast/engine";
import styles from "./assembly.module.css";

const ConstituencyMap = dynamic(() => import("./ConstituencyMap"), { ssr: false, loading: () => <div className={styles.coverageMapFrame}>Loading constituency map…</div> });
const number = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

export default function CountCoverage({ story, playing, frameIndex }: { story: Story; playing: boolean; frameIndex: number }) {
  const update = story.update;
  const frames = useMemo(() => coverageFrames(update), [update]);
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const candidates = candidateVoteChanges(update, story.previous).sort((a, b) =>
    (a.status === "elected" ? 0 : a.status === "running" ? 1 : 2) - (b.status === "elected" ? 0 : b.status === "running" ? 1 : 2) || b.votes - a.votes);
  const partyRows = update.count === 1 ? rollingResults({ ...initialState(), first: { [update.constituency]: update }, latest: { [update.constituency]: update } }, {}).filter(row => row.phase === "PARTY FIRST PREFERENCES") : [];
  const elected = update.candidates.filter(c => c.status === "elected").length;
  return <div className={`${styles.countCoverage} ${frame.kind === "intro" ? styles.coverageIntroducing : ""} ${!playing ? styles.coveragePaused : ""}`}>
    <ConstituencyMap name={update.constituency} focus={frame.kind !== "intro"} />
    <div className={styles.coveragePanel}>
    <div className={styles.coverageHeading}><div><strong>COUNT {update.count}</strong><span>{elected}/{update.seats} elected · Quota {number(update.quota)}</span></div><span className={styles.declaring}>DECLARING</span></div>
      <div className={styles.coverageStandings} key={`${frame.kind}:${frame.page}`}>
        {frame.kind === "parties" ? <><div className={styles.coverageTableHeader}><span>PARTY</span><span>VOTES</span><span>SHARE</span></div>{partyRows.map(row => <div className={styles.coverageParty} key={row.id} style={{ borderLeftColor: row.color }}><strong>{row.name}</strong><b>{number(row.votes)}</b><span>{row.share!.toFixed(1)}%</span></div>)}</> : <>
          <div className={styles.coverageTableHeader}><span>CANDIDATE</span><span>VOTES</span><span>{update.count > 1 ? "THIS COUNT" : "SHARE"}</span></div>
          {candidates.slice(frame.page * 8, frame.page * 8 + 8).map(candidate => {
            const retained = candidate.status === "elected" && candidate.votes === 0;
            const color = party(candidate.party).color;
            const fill = update.quota ? Math.min(100, (retained ? update.quota : candidate.votes) / update.quota * 70) : 0;
            const total = update.candidates.reduce((sum, c) => sum + c.votes, 0);
            const justEliminated = candidate.status === "eliminated" && story.previous?.candidates.find(c => c.id === candidate.id)?.status !== "eliminated";
            return <div className={`${styles.coverageCandidate} ${candidate.status === "eliminated" ? styles.coverageEliminated : ""}`} key={candidate.id}>
              <div className={styles.countVoteFill} style={{ width: `${fill}%`, background: color, opacity: candidate.status === "elected" ? .35 : .22 }} />
              {fill > 70 && <div className={styles.countSurplus} style={{ left: "70%", width: `${fill - 70}%` }} />}
              {justEliminated && <div className={styles.countElimination} />}
              <div className={styles.countQuota} />
              {candidate.status === "elected" && <div className={styles.countElectedStrip}><svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-label="Elected"><path d="M4 8.5L7 11.5L12 5" stroke="currentColor" strokeWidth="2.8" /></svg></div>}
              <div className={styles.countCandidateIdentity}><span className={styles.countPartyLine} style={{ background: color }} /><span className={styles.countAvatar} style={{ background: color }} aria-hidden="true">{candidate.name.split(/\s+/).map(word => word[0]).slice(0, 2).join("")}</span><div><strong>{candidate.name}{candidate.incumbent && <span className={styles.countIncumbent} title="Incumbent">★</span>}</strong><small>{party(candidate.party).name}{candidate.status === "eliminated" ? " · Eliminated" : ""}</small></div></div>
              <b>{retained ? "ELECTED" : number(candidate.votes)}</b><span className={styles.coverageDelta} style={{ color: update.count > 1 && !retained ? candidate.change! > 0 ? "#4caf50" : candidate.change! < 0 ? "#f44336" : "#aaa" : undefined }}>{retained ? "" : update.count === 1 ? `${total ? (candidate.votes / total * 100).toFixed(1) : "0.0"}%` : candidate.change === undefined ? "—" : `${candidate.change > 0 ? "↑ +" : candidate.change < 0 ? "↓ " : "→ "}${number(candidate.change)}`}</span>
            </div>;
          })}
        </>}
        <p className={styles.note}>{frame.kind === "parties" ? "First-preference votes · Parties below 5% grouped as Other" : update.count > 1 ? `Vote changes since count ${story.previous?.count ?? "—"} · Standings at count ${update.count}` : "First-preference votes by candidate"}</p>
      </div>
    </div>
    {frame.kind === "intro" && <div className={styles.constituencyIntro}><span>COUNT {update.count} DECLARED</span><strong>{update.constituency}</strong></div>}
  </div>;
}
