"use client";

import { outlineBroadcastText } from "./OutlinedText";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { createReplay, rollingResults, party, partyTextColor, type BroadcastState, type CountUpdate } from "@/lib/broadcast/engine";
import type { PreResultsContent } from "./PreResults";
import styles from "./assembly.module.css";
import BrandClock from "./BrandClock";
import CommunityResultsStrip from "./CommunityResultsStrip";

export default function RollingResults({ data, preResults, paused }: { data: BroadcastState; preResults: PreResultsContent; paused: boolean }) {
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
    return groups.flatMap((group, groupIndex) => {
      const total = Math.ceil(group.entries.length / 6);
      const resultPages = Array.from({ length: total }, (_, page) => {
        const modes = group.entries[0].phase === "PARTY FIRST PREFERENCES" ? ["votes", "changes"] : ["votes"];
        return modes.map(mode => ({
          id: group.id + ':' + page + ':' + mode, entries: group.entries.slice(page * 6, page * 6 + 6), page: page + 1, total, mode,
        }));
      }).flat();
      const constituency = group.entries[0].constituency;
      const lastInConstituency = groups[groupIndex + 1]?.entries[0].constituency !== constituency;
      return lastInConstituency ? [...resultPages, ...["community-votes", "community-changes"].map(mode => ({ id: `${constituency}:${mode}`, entries: [group.entries[0]], page: 1, total: 1, mode }))] : resultPages;
    });
  }, [entries]);
  const found = pages.findIndex(page => page.id === currentId);
  const index = Math.max(0, found);
  const page = pages[index];
  const entry = page?.entries[0];
  useEffect(() => {
    if (paused || !pages.length) return;
    const duration = pages[index].mode === "community-votes" || pages[index].entries[0].phase === "PARTY FIRST PREFERENCES" && pages[index].mode === "votes" ? 4000 : 8000;
    const timer = window.setTimeout(() => setCurrentId(pages[(index + 1) % pages.length].id), duration);
    return () => window.clearTimeout(timer);
  }, [pages, index, paused]);
  if (!entry) {
    const featured = preResults.rows.find(row => row.code === preResults.featured);
    const historical = preResults.mode.startsWith("historic");
    if (historical) {
      const byShare = preResults.mode === "historic-share";
      const historicalRows = [...preResults.rows].sort((a, b) => Number(a.code === "OTHER") - Number(b.code === "OTHER") || (byShare ? b.share - a.share : b.seats - a.seats)).slice(preResults.historyPage * 6, preResults.historyPage * 6 + 6);
      return outlineBroadcastText(<div className={styles.resultsStrip}><div className={styles.waitingLabel}><strong>ASSEMBLY<br />2017</strong><span>PREVIOUS ELECTION · {byShare ? "VOTE SHARE" : "SEATS"}</span></div><div className={styles.resultTiles} key={`${preResults.mode}:${preResults.historyPage}`}>{historicalRows.map(row => <div className={styles.resultTile} key={row.code} style={{ background: party(row.code).color, color: "#fff" }}><strong className={styles.tileName}>{party(row.code).name}</strong><div className={styles.tileNumbers}><strong>{byShare ? <>{row.share.toFixed(1)}<small>%</small></> : row.seats}</strong><small>{byShare ? "FIRST PREFERENCES · 2017" : "SEATS WON · 2017"}</small></div></div>)}</div><BrandClock /></div>);
    }
    if (featured) return outlineBroadcastText(<div className={styles.resultsStrip}>
      <div className={styles.waitingLabel}><strong>ASSEMBLY<br />2022</strong><span>NORTHERN IRELAND</span></div>
      <div key={featured.code} className={styles.candidateShowcase} style={{ backgroundColor: party(featured.code).color }}>
        <div className={styles.showcaseIdentity}><strong>{party(featured.code).name}</strong><span>Standing in {preResults.constituencies} constituencies</span></div>
        <svg className={styles.showcasePeople} viewBox="0 0 210 100" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <g key={i} transform={"translate(" + i * 42 + ", 0)"}><circle cx="20" cy="24" r="13" /><path d="M0 100V62a20 20 0 0 1 40 0v38Z" /></g>)}</svg>
        <div className={styles.showcaseCount}><strong>{featured.candidates}</strong><span>CANDIDATES</span></div>
      </div><BrandClock />
    </div>);
    return outlineBroadcastText(<div className={styles.resultsStrip}><div className={styles.waitingLabel}><strong>ASSEMBLY<br />2022</strong><span>NORTHERN IRELAND</span></div><div className={styles.waitingMessage}><small>THE COUNT</small><strong>Awaiting the first constituency result</strong><span>Results and elected candidates as each count is declared.</span></div><BrandClock /></div>);
  }
  if (page.mode.startsWith("community-")) return outlineBroadcastText(<div className={styles.resultsStrip}><div key={entry.constituency} className={`${styles.constituencyTile} ${paused ? styles.constituencyPaused : ""}`}><strong>{entry.constituency}</strong><span className={styles.constituencySection}>{page.mode === "community-changes" ? "COMMUNITY CHANGE VS 2017" : "COMMUNITY TOTALS"}</span></div><CommunityResultsStrip data={data} constituency={entry.constituency} baseline={Object.values(baseline)} showChanges={page.mode === "community-changes"} /><BrandClock /></div>);
  const seats = data.first[entry.constituency].seats;
  const latest = data.latest[entry.constituency];
  const elected = latest.candidates.filter(candidate => candidate.status === "elected").length;
  const sectionLabel = entry.phase === "PARTY FIRST PREFERENCES"
    ? page.mode === "changes" ? "PARTY CHANGES VS 2017" : "FIRST PREFERENCES"
    : entry.phase === "FIRST COUNT" ? "FIRST COUNT"
    : entry.hideVotes ? `${elected}/${seats} ELECTED` : `COUNT ${latest.count}`;
  return outlineBroadcastText(<div className={styles.resultsStrip}>
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
  </div>);
}
