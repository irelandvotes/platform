"use client";

import { useId, useMemo, type CSSProperties } from "react";
import { nationalPartyCodes, nationalSummary, party, type BroadcastState, type CountUpdate } from "@/lib/broadcast/engine";
import { ASSEMBLY_BLOCS, assemblyBlocForParty, assemblyPartyCallouts, assemblySeatFaces, assemblySeatLayout, noOverallCommunityControl } from "@/lib/broadcast/assemblyChart";
import { outlineBroadcastText, SvgOutlinedText } from "./OutlinedText";
import styles from "./assembly.module.css";

function tint(hex: string, amount: number) {
  return "#" + [1, 3, 5].map(offset => { const value = parseInt(hex.slice(offset, offset + 2), 16); return Math.round(amount > 0 ? value + (255 - value) * amount : value * (1 + amount)).toString(16).padStart(2, "0"); }).join("");
}

export default function OverallCoverage({ data, baseline, slide }: { data: BroadcastState; baseline: CountUpdate[] | null; slide: number }) {
  const shadowId = `assembly-shadow-${useId().replace(/:/g, "")}`;
  const summary = useMemo(() => nationalSummary(data, baseline), [data, baseline]);
  const blocView = slide === 3;
  const noOverallControl = useMemo(() => noOverallCommunityControl(assemblySeatLayout(data)), [data]);
  const blocks = useMemo(() => assemblySeatLayout(data).map(seat => blocView && seat.party ? { ...seat, party: assemblyBlocForParty(seat.party) } : seat), [data, blocView]);
  const callouts = useMemo(() => {
    const labels = assemblyPartyCallouts(blocks);
    if (blocView) {
      const order = ["NAT", "NON", "UNI", "PENDING"];
      labels.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
      labels.forEach((label, index) => { label.reveal = .8 + index * 2.1; });
    }
    return labels;
  }, [blocks, blocView]);
  const definition = (code: string) => blocView && code in ASSEMBLY_BLOCS ? ASSEMBLY_BLOCS[code as keyof typeof ASSEMBLY_BLOCS] : party(code);
  const { votes, seats, oldVotes, oldTotal, total, seatChanges, seatChangePending, elected, reporting } = summary;
  const rows = nationalPartyCodes.filter(code => votes[code] || seats[code] || ["SF", "DUP", "AP", "UUP", "SDLP"].includes(code)).sort((a, b) => Number(a === "OTHER") - Number(b === "OTHER") || ((slide === 0 ? votes[b] : seats[b]) ?? 0) - ((slide === 0 ? votes[a] : seats[a]) ?? 0) || (votes[b] ?? 0) - (votes[a] ?? 0));
  const highest = Math.max(0, ...rows.map(code => slide === 0 ? total ? (votes[code] ?? 0) / total * 100 : 0 : seats[code] ?? 0));
  const scaleStep = slide === 0 ? 10 : 5;
  const scaleMaximum = Math.max(scaleStep, Math.ceil(highest / scaleStep) * scaleStep);
  return outlineBroadcastText(<div className={styles.overallCoverage} key={slide}>
    <div className={styles.overallHeading}>{blocView && noOverallControl && <div className={styles.controlConfirmation} role="status"><span className={styles.controlTick} aria-hidden="true"><svg width="32" height="32" viewBox="0 0 16 16" fill="none"><path d="M4 8.5L7 11.5L12 5" pathLength="1" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span><strong>NO OVERALL CONTROL</strong></div>}<div className={styles.overallSummary}><strong>{slide === 0 ? `${reporting.length}/18` : `${elected}/90`}</strong><span>{slide === 0 ? "constituencies reporting" : "seats filled"}</span></div></div>
    {slide < 2 ? <>
      <div className={styles.overallColumns}>
      <div className={styles.overallPlotGrid} aria-hidden="true" />
      <div className={styles.overallAxis} aria-hidden="true"><span>{scaleMaximum}{slide === 0 ? "%" : ""}</span><span>{scaleMaximum / 2}{slide === 0 ? "%" : ""}</span><span>0</span></div>
      {rows.map((code, index) => {
        const share = total ? (votes[code] ?? 0) / total * 100 : 0;
        const value = slide === 0 ? share : seats[code] ?? 0;
        const change = slide === 0 ? oldTotal ? share - (oldVotes[code] ?? 0) / oldTotal * 100 : undefined : baseline && ((seatChanges[code] ?? 0) !== 0 || !seatChangePending[code]) ? seatChanges[code] ?? 0 : undefined;
        return <div className={styles.overallColumn} key={code}>
          <div className={styles.overallBarWell}><div className={styles.overallColumnBar} style={{ backgroundColor: party(code).color, height: `${value / scaleMaximum * 100}%`, animationDelay: `${index * 65}ms` }} /></div>
          <div className={styles.overallColumnLabel}>
          <strong>{party(code).name}</strong><b>{slide === 0 ? value.toFixed(1) : value}{slide === 0 && <small>%</small>}</b><span>{change === undefined ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(slide === 0 ? 1 : 0)}${slide === 0 ? " pp" : ""}`}</span>
          </div>
        </div>;
      })}</div>
    </> : <div className={styles.assemblyOverview}>
      <div className={styles.assemblyStage}><svg viewBox="-290 85 1460 585" style={{ "--group-duration": blocView ? "2.1s" : "1.05s", "--all-party-reveal": `${.95 + callouts.length * (blocView ? 2.1 : 1.05)}s` } as CSSProperties} role="img" aria-label={`Assembly ${blocView ? "designation" : "party"} composition: ${elected} seats won, ${90 - elected} unfilled`}>
        <defs><filter id={shadowId} x="-40%" y="-60%" width="180%" height="220%"><feGaussianBlur stdDeviation="2.2" /></filter></defs>
        {[...blocks].sort((a, b) => a.y - b.y || a.x - b.x).map(block => {
          const color = block.party ? definition(block.party).color : "#617b84";
          const faces = assemblySeatFaces(block);
          const reveal = callouts.find(label => label.code === (block.party ?? "PENDING"))?.reveal ?? 0;
          return <g key={block.id} className={styles.assemblyBlock} style={{ animationDelay: `${block.id * 8}ms`, opacity: block.party ? 1 : .38, "--seat-opacity": block.party ? 1 : .38 } as CSSProperties}><title>{block.party ? definition(block.party).name : "Seat not yet filled"}</title><path d={faces.shadow} fill="#163a3233" filter={`url(#${shadowId})`} /><path d={faces.side} fill={tint(color, -.3)} stroke="#00000014" strokeWidth=".5" /><path d={faces.front} fill={tint(color, -.12)} /><path d={faces.top} fill={tint(color, .22)} stroke="#ffffff55" strokeWidth=".7" /><path className={styles.assemblySeatHighlight} d={faces.top} pathLength="1" style={{ animationDelay: `${reveal}s` }} /></g>;
        })}
        {callouts.map(label => {
          const color = label.code === "PENDING" ? "#617b84" : definition(label.code).color;
          return <g key={label.code} style={{ "--party-reveal": `${label.reveal}s` } as CSSProperties}>
            <g transform={`translate(${label.x} ${label.y})`}><g className={styles.assemblyCallout}>
              <rect x="3" y="5" width="160" height="60" rx="4" fill="#163a3220" filter={`url(#${shadowId})`} />
              <rect width="160" height="60" rx="4" fill="#ffffffed" />
              <rect width="5" height="60" fill={color} />
              <g color="#253b40"><SvgOutlinedText text={label.code === "PENDING" ? "TO FILL" : blocView ? definition(label.code).name.toUpperCase() : label.code} x={17} y={blocView ? 21 : 37} size={blocView ? 13 : label.code.length > 4 ? 19 : 23} /><SvgOutlinedText text={String(label.count)} x={146} y={blocView ? 50 : 42} size={blocView ? 33 : 36} anchor="end" /></g>
            </g></g>
          </g>;
        })}
      </svg></div>
    </div>}
  </div>);
}
