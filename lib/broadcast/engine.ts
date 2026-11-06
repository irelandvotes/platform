export type Candidate = {
  id: string; name: string; party: string; votes: number;
  incumbent?: boolean;
  status: "running" | "elected" | "eliminated";
};
export type CountUpdate = {
  id: string; constituency: string; count: number; quota: number;
  seats: number; candidates: Candidate[];
};
export type Story = {
  id: string; kind: "seat" | "count" | "complete";
  update: CountUpdate; candidate?: Candidate;
  previous?: CountUpdate;
};
export function coverageFrames(update: CountUpdate) {
  return [
    { kind: "intro", page: 0, duration: 2400 },
    ...(update.count === 1 ? [{ kind: "parties", page: 0, duration: 12000 }] : []),
    ...Array.from({ length: Math.ceil(update.candidates.length / 8) }, (_, page) => ({ kind: "candidates", page, duration: 7000 })),
  ];
}
export function coverageDuration(update: CountUpdate) {
  return coverageFrames(update).reduce((sum, frame) => sum + frame.duration, 0);
}
export function candidateVoteChanges(update: CountUpdate, previous?: CountUpdate) {
  return update.candidates.map(candidate => {
    const old = previous?.candidates.find(c => c.id === candidate.id);
    return { ...candidate, change: old ? candidate.votes - old.votes : undefined };
  });
}
export type BroadcastState = {
  latest: Record<string, CountUpdate>; first: Record<string, CountUpdate>;
  seen: string[]; queue: Story[]; history: Story[];
};
export function initialState(): BroadcastState {
  return { latest: {}, first: {}, seen: [], queue: [], history: [] };
}
export function nextConstituencyCount(updates: CountUpdate[], data: BroadcastState, constituency: string) {
  const count = (data.latest[constituency]?.count ?? 0) + 1;
  return updates.find(update => update.constituency === constituency && update.count === count);
}

export const nationalPartyCodes = ["SF", "DUP", "AP", "UUP", "SDLP", "TUV", "PBP", "OTHER"];
export function nationalSummary(data: BroadcastState, baseline: CountUpdate[] | null) {
  const reporting = Object.keys(data.first);
  const votes: Record<string, number> = {}, oldVotes: Record<string, number> = {};
  const seats: Record<string, number> = {}, oldSeats: Record<string, number> = {};
  const add = (target: Record<string, number>, code: string, value: number) => {
    const key = nationalPartyCodes.includes(code) ? code : "OTHER";
    target[key] = (target[key] ?? 0) + value;
  };
  Object.values(data.first).forEach(update => update.candidates.forEach(c => add(votes, c.party, c.votes)));
  Object.values(data.latest).forEach(update => update.candidates.filter(c => c.status === "elected").forEach(c => add(seats, c.party, 1)));
  const previousLatest: Record<string, CountUpdate> = {};
  baseline?.forEach(update => {
    if (!reporting.includes(update.constituency)) return;
    previousLatest[update.constituency] = update;
    if (update.count === 1) update.candidates.forEach(c => add(oldVotes, c.party, c.votes));
  });
  Object.values(previousLatest).forEach(update => update.candidates.filter(c => c.status === "elected").forEach(c => add(oldSeats, c.party, 1)));
  const seatChanges: Record<string, number> = {};
  const seatChangePending: Record<string, boolean> = {};
  for (const name of reporting) {
    const previous = previousLatest[name];
    if (!previous) continue;
    const current = data.latest[name];
    const electedCount = current.candidates.filter(c => c.status === "elected").length;
    const remaining = Math.max(0, current.seats - electedCount);
    const codes = new Set([...previous.candidates, ...current.candidates].map(c => c.party));
    for (const code of codes) {
      const held = previous.candidates.filter(c => c.party === code && c.status === "elected").length;
      const won = current.candidates.filter(c => c.party === code && c.status === "elected").length;
      const running = current.candidates.filter(c => c.party === code && c.status === "running").length;
      const maximum = won + Math.min(running, remaining);
      // Unfilled seats alone never imply a loss. Count only mathematically certain changes.
      const confirmed = won > held ? won - held : maximum < held ? maximum - held : 0;
      add(seatChanges, code, confirmed);
      const key = nationalPartyCodes.includes(code) ? code : "OTHER";
      if (maximum !== won) seatChangePending[key] = true;
    }
  }
  return { reporting, votes, oldVotes, seats, oldSeats, seatChanges, seatChangePending,
    total: Object.values(votes).reduce((sum, n) => sum + n, 0),
    oldTotal: Object.values(oldVotes).reduce((sum, n) => sum + n, 0),
    elected: Object.values(seats).reduce((sum, n) => sum + n, 0) };
}
// The same boundary can accept counts from replay or a future live adapter.
export function receiveUpdate(state: BroadcastState, update: CountUpdate): BroadcastState {
  const previous = state.latest[update.constituency];
  if (state.seen.includes(update.id) || (previous && previous.count >= update.count)) return state;
  const elected = update.candidates.filter(candidate => candidate.status === "elected");
  const newlyElected = elected.filter(candidate => !previous?.candidates.some(old => old.id === candidate.id && old.status === "elected"));
  const stories: Story[] = newlyElected.map(candidate => ({
    id: `${update.id}:seat:${candidate.id}`, kind: "seat", update, candidate, previous,
  }));
  stories.unshift({ id: `${update.id}:count`, kind: "count", update, previous });
  if (elected.length === update.seats && previous?.candidates.filter(c => c.status === "elected").length !== update.seats) {
    stories.push({ id: `${update.id}:complete`, kind: "complete", update });
  }
  // Keep every count in arrival order, followed by its seat announcements.
  const queue = [...state.queue, ...stories];
  return {
    latest: { ...state.latest, [update.constituency]: update },
    first: update.count === 1 ? { ...state.first, [update.constituency]: update } : state.first,
    seen: [...state.seen, update.id],
    queue,
    history: [...stories, ...state.history].slice(0, 60),
  };
}
export function createReplay(rows: Record<string, string>[]): CountUpdate[] {
  const counts = new Map<string, CountUpdate>();
  const number = (value: string) => Number(value.replaceAll(",", ""));
  for (const row of rows) {
    if (!row.constituency) continue;
    const id = `${row.constituency}:${row.count}`;
    if (!counts.has(id)) counts.set(id, {
      id, constituency: row.constituency, count: number(row.count),
      quota: number(row.quota), seats: number(row.seats), candidates: [],
    });
    counts.get(id)!.candidates.push({
      id: row.candidate_id, name: row.candidate, party: row.party,
      votes: number(row.votes), status: row.status as Candidate["status"],
      incumbent: row.incumbent?.trim().toLowerCase() === "true",
    });
  }
  // Synthetic interleaving; historical arrival timestamps are unavailable.
  return [...counts.values()].sort((a, b) => a.count - b.count || a.constituency.localeCompare(b.constituency));
}
export const parties: Record<string, { name: string; color: string }> = {
  SF: { name: "Sinn Féin", color: "#124940" }, DUP: { name: "DUP", color: "#dd5454" },
  AP: { name: "Alliance", color: "#e5bf20" }, UUP: { name: "UUP", color: "#3676c0" },
  SDLP: { name: "SDLP", color: "#fd281b" }, TUV: { name: "TUV", color: "#0a244b" },
  PBP: { name: "People Before Profit", color: "#da1498" }, GP: { name: "Green", color: "#43a047" },
  IND: { name: "Independent", color: "#7a7a7a" },
  INDU: { name: "Independent Unionist", color: "#d65f30" },
  INDN: { name: "Independent Nationalist", color: "#0c4257" },
  AON: { name: "Aontú", color: "#53660e" },
  PUP: { name: "PUP", color: "#090ca8" },
  WP: { name: "Workers’ Party", color: "#580707" },
  CON: { name: "Conservative", color: "#0a3f8f" },
  SP: { name: "Socialist Party", color: "#9c0e0e" },
  OTHER: { name: "Other", color: "#7a7a7a" },
};
export function party(code: string) { return parties[code] ?? { name: code, color: "#7a7a7a" }; }
export function partyTextColor(_color: string) {
  return "#ffffff";
}

export type RollingResult = {
  id: string; constituency: string; phase: string; name: string; affiliation?: string;
  votes: number; share?: number; change?: number; elected?: boolean; incumbent?: boolean; hideVotes?: boolean; color: string;
};
export function rollingResults(state: BroadcastState, baseline: Record<string, CountUpdate>): RollingResult[] {
  return Object.keys(state.first).sort((a, b) => a.localeCompare(b, "en-GB")).flatMap(constituency => {
    const first = state.first[constituency];
    const latest = state.latest[constituency];
    const total = first.candidates.reduce((sum, c) => sum + c.votes, 0);
    const byParty = (update: CountUpdate | undefined) => {
      const votes: Record<string, number> = {};
      for (const c of update?.candidates ?? []) votes[c.party] = (votes[c.party] ?? 0) + c.votes;
      return votes;
    };
    const current = byParty(first);
    const previous = byParty(baseline[constituency]);
    const previousTotal = Object.values(previous).reduce((sum, n) => sum + n, 0);
    const major = Object.keys(current).filter(code => total > 0 && current[code] / total >= .05);
    const rows = major.map(code => ({ code, votes: current[code], old: previous[code] ?? 0 }));
    const smaller = Object.keys(current).filter(code => !major.includes(code));
    const otherOld = Object.keys(previous).filter(code => !major.includes(code)).reduce((sum, code) => sum + previous[code], 0);
    if (smaller.length || otherOld) rows.push({ code: "OTHER", votes: smaller.reduce((sum, code) => sum + current[code], 0), old: otherOld });
    const result: RollingResult[] = rows.sort((a, b) => Number(a.code === "OTHER") - Number(b.code === "OTHER") || b.votes - a.votes).map(row => ({
      id: `${constituency}:party:${row.code}`, constituency, phase: "PARTY FIRST PREFERENCES", name: row.code === "OTHER" ? "Other" : party(row.code).name,
      votes: row.votes, share: total ? row.votes / total * 100 : 0,
      change: previousTotal && total ? (row.votes / total - row.old / previousTotal) * 100 : undefined,
      color: party(row.code).color,
    }));
    for (const [phase, update, status] of [
      ["FIRST COUNT", first, "all"],
      [`LATEST COUNT · ${latest.count} · ELECTED SO FAR`, latest, "elected"],
      [`LATEST COUNT · ${latest.count} · CONTINUING`, latest, "running"],
    ] as const) {
      const candidates = update.candidates.filter(candidate => status === "all" || candidate.status === status);
      for (const candidate of [...candidates].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))) {
        result.push({ id: `${constituency}:${phase === "FIRST COUNT" ? "first" : "latest"}:${candidate.id}`, constituency, phase, name: candidate.name,
          affiliation: party(candidate.party).name, color: party(candidate.party).color,
          votes: candidate.votes, share: phase === "FIRST COUNT" && total ? candidate.votes / total * 100 : undefined,
          elected: candidate.status === "elected",
          incumbent: candidate.incumbent,
          hideVotes: status === "elected",
        });
      }
    }
    return result;
  });
}
