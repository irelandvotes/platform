"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { candidateField, createReplay, initialState, nationalPartyCodes, nationalSummary, receiveUpdate, type CountUpdate } from "@/lib/broadcast/engine";

export type PreResultsContent = {
  mode: "waiting" | "historic-seats" | "historic-share" | "candidates";
  featured: string; candidates: number; constituencies: number;
  historyPage: number;
  baseline: CountUpdate[] | null;
  rows: { code: string; seats: number; share: number; candidates: number }[];
};
export function usePreResults(updates: CountUpdate[], hasResults: boolean, paused: boolean): PreResultsContent {
  const [historical, setHistorical] = useState<CountUpdate[]>([]);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/elections/northern-ireland/assembly/2017/election_data.csv", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.text(); })
      .then(csv => { const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }); if (parsed.errors.length) throw new Error(); setHistorical(createReplay(parsed.data)); })
      .catch(() => { /* Omit historical slides if their source is unavailable. */ });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (hasResults || paused) return;
    const timer = window.setInterval(() => setStep(value => value + 1), 8000);
    return () => window.clearInterval(timer);
  }, [hasResults, paused]);
  const candidates = candidateField(updates);
  const group = (code: string) => nationalPartyCodes.includes(code) ? code : "OTHER";
  const historic = nationalSummary(historical.reduce(receiveUpdate, initialState()), null);
  const rows = nationalPartyCodes.map(code => ({ code, seats: historic.seats[code] ?? 0,
    share: historic.total ? (historic.votes[code] ?? 0) / historic.total * 100 : 0,
    candidates: candidates.filter(candidate => group(candidate.party) === code).length,
  }));
  const featuredRows = rows.filter(row => row.candidates).sort((a, b) => Number(a.code === "OTHER") - Number(b.code === "OTHER") || b.candidates - a.candidates);
  const sequence: { mode: PreResultsContent["mode"]; featured: string; historyPage: number }[] = [
    { mode: "waiting", featured: "", historyPage: 0 },
    ...(historical.length ? ["historic-seats", "historic-share"].flatMap(mode => [0, 1].map(historyPage => ({ mode: mode as PreResultsContent["mode"], featured: "", historyPage }))) : []),
    ...featuredRows.map(row => ({ mode: "candidates" as const, featured: row.code, historyPage: 0 })),
  ];
  const slide = sequence[step % sequence.length];
  return { ...slide, baseline: historical.length ? historical : null, candidates: candidates.length, constituencies: new Set(candidates.filter(candidate => group(candidate.party) === slide.featured).map(candidate => candidate.constituency)).size, rows };
}
