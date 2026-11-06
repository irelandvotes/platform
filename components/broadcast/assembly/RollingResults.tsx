"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { createReplay, rollingResults, partyTextColor, type BroadcastState, type CountUpdate } from "@/lib/broadcast/engine";
import styles from "./assembly.module.css";
import BrandClock from "./BrandClock";

export default function RollingResults({ data, paused }: { data: BroadcastState; paused: boolean }) {
  const [baseline, setBaseline] = useState<Record<string, CountUpdate>>({});
  const [baselineStatus, setBaselineStatus] = useState("Loading 2017 comparison");
  const [currentId, setCurrentId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/elections/northern-ireland/assembly/2017/election_data.csv", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.text(); })
      .then(csv => {
        const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
        if (parsed.errors.length) throw new Error();
        setBaseline(Object.fromEntries(createReplay(parsed.data).filter(update => update.count === 1).map(update => [update.constituency, update])));
        setBaselineStatus("2017 comparison unavailable");
      }).catch(error => { if (error.name !== "AbortError") setBaselineStatus("2017 comparison unavailable"); });
    return () => controller.abort();
  }, []);
  const entries = useMemo(() => rollingResults(data, baseline), [data, baseline]);
  const pages = useMemo(() => {
    const groups: { id: string; entries: typeof entries }[] = [];
    for (const entry of entries) {
      const groupId = entry.constituency + ':' + entry.phase;
      const last = groups[groups.length - 1];
      if (last?.id === groupId) last.entries.push(entry);
      else groups.push({ id: groupId, entries: [entry] });
    }
    return groups.flatMap(group => {
      const total = Math.ceil(group.entries.length / 6);
      return Array.from({ length: total }, (_, page) => {
        const modes = group.entries[0].phase === "PARTY FIRST PREFERENCES" ? ["votes", "changes"] : ["votes"];
        return modes.map(mode => ({
          id: group.id + ':' + page + ':' + mode, entries: group.entries.slice(page * 6, page * 6 + 6), page: page + 1, total, mode,
        }));
      }).flat();
    });
  }, [entries]);
  const found = pages.findIndex(page => page.id === currentId);
  const index = Math.max(0, found);
  const page = pages[index];
  const entry = page?.entries[0];
  useEffect(() => {
    if (paused || !pages.length) return;
    const duration = pages[index].entries[0].phase === "PARTY FIRST PREFERENCES" && pages[index].mode === "votes" ? 4000 : 8000;
    const timer = window.setTimeout(() => setCurrentId(pages[(index + 1) % pages.length].id), duration);
    return () => window.clearTimeout(timer);
  }, [pages, index, paused]);
  if (!entry) return <div className={styles.headlineBar}><div className={styles.headlineLabel}>ASSEMBLY 2022</div><div className={styles.headlineCopy}><strong>Awaiting constituency results</strong><span>Party totals, first count and latest count</span></div></div>;
  const seats = data.first[entry.constituency].seats;
  const latest = data.latest[entry.constituency];
  const elected = latest.candidates.filter(candidate => candidate.status === "elected").length;
  const sectionLabel = entry.phase === "PARTY FIRST PREFERENCES"
    ? page.mode === "changes" ? "PARTY CHANGES VS 2017" : "FIRST PREFERENCES"
    : entry.phase === "FIRST COUNT" ? "FIRST COUNT"
    : entry.hideVotes ? `${elected}/${seats} ELECTED` : `COUNT ${latest.count}`;
  return <div className={styles.resultsStrip}>
    <div key={entry.constituency} className={`${styles.constituencyTile} ${paused ? styles.constituencyPaused : ""}`}><strong>{entry.constituency}</strong><span className={styles.constituencySection} key={sectionLabel}>{sectionLabel}</span></div>
    <div className={styles.resultTiles} key={page.entries.map(result => result.id).join("|")}>
      {page.entries.map(result => <div key={result.id} className={`${styles.resultTile} ${result.affiliation ? styles.candidateTile : ""}`} style={{ background: result.color, color: partyTextColor(result.color) }}>
        {result.elected && <span className={styles.tileElected} style={{ color: result.color }} aria-label="Elected" title="Elected"><svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 8.5L7 11.5L12 5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
        <strong className={styles.tileName}>{result.name}</strong>
        {result.affiliation && <span className={styles.tileParty}>{result.affiliation}</span>}
        {result.incumbent && <span className={styles.incumbent}>INCUMBENT</span>}
        <div className={styles.tileNumbers}>
          {result.phase === "PARTY FIRST PREFERENCES" ? <>
            <strong>{result.share!.toFixed(1)}<small>%</small></strong>
            <span className={styles.tileFigureSwap} key={page.mode}>{page.mode === "changes" ? result.change === undefined ? <small>{baselineStatus}</small> : `${result.change > 0 ? "+" : ""}${result.change.toFixed(1)} pp` : result.votes.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</span>
          </> : <>
            {!result.hideVotes && <strong>{result.votes.toLocaleString("en-GB", { maximumFractionDigits: 2 })}</strong>}
            {result.hideVotes ? <small>ELECTED</small> : <small>VOTES</small>}
          </>}
        </div>
      </div>)}
    </div>
    <BrandClock />
  </div>;
}
