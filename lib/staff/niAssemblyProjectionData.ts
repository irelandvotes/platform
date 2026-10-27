import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { PARTY_BY_CODE } from "./pollingGraphicCatalog";
import { projectBoundaryFeatures, type SeatProjectionMapFeature } from "./seatProjectionData";
import { getProjectionBloc } from "./projectionBlocs";

const YEARS = ["2017", "2022"] as const;
type AssemblyYear = typeof YEARS[number];

type CountCandidate = {
  id: string;
  name: string;
  party: string;
  votes: number | null;
  quota: number;
  status: "running" | "elected" | "eliminated" | string;
  incumbent: boolean;
};

type RawConstituency = {
  seats: number;
  validVotes: number;
  electorate: number;
  candidates: CountCandidate[];
  counts: Array<{ number: number; candidates: CountCandidate[] }>;
};

type RawElection = {
  constituencies: Map<string, RawConstituency>;
  nationalVotes: Map<string, number>;
};

export type NiAssemblyParty = {
  code: string;
  name: string;
  color: string;
  baselineShare: number;
  baselineSeats: number;
};

export type NiAssemblyCandidate = {
  id: string;
  name: string;
  party: string;
  incumbent: boolean;
  firstPreferences: number;
  withinPartyShare: number;
};

export type NiAssemblyCountCandidate = CountCandidate;

export type NiAssemblyConstituency = {
  name: string;
  seats: number;
  validVotes: number;
  electorate: number;
  quota: number;
  candidates: NiAssemblyCandidate[];
  firstPreferencesByParty: Record<string, number>;
  localShareByYear: Record<AssemblyYear, Record<string, number>>;
  westminster2024LocalShare: Record<string, number>;
  countHistory: Array<{ number: number; candidates: CountCandidate[] }>;
};

export type NiAssemblyTransfer = {
  sourceParty: string;
  destinations: Record<string, number>;
  retention: number;
  eventCount: number;
  transferredVotes: number;
  sourceVotes: number;
};

export type NiAssemblyTransferProfiles = {
  elimination: Record<string, NiAssemblyTransfer>;
  surplus: Record<string, NiAssemblyTransfer>;
  eliminationByBloc: Record<string, NiAssemblyTransfer>;
  surplusByBloc: Record<string, NiAssemblyTransfer>;
};

export type NiAssemblyProjectionData = {
  baselineYear: "2022";
  electionLabel: string;
  seats: number;
  validVotes: number;
  nationalShareByYear: Record<AssemblyYear, Record<string, number>>;
  westminster2024NationalShare: Record<string, number>;
  parties: NiAssemblyParty[];
  constituencies: NiAssemblyConstituency[];
  mapFeatures: SeatProjectionMapFeature[];
  transfers: NiAssemblyTransferProfiles;
  transferDiagnostics: {
    events: number;
    transitions: number;
    unusableTransitions: number;
    years: string[];
  };
};

function toNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return 0;
  const parsed = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function readElection(year: AssemblyYear): RawElection {
  const file = path.join(process.cwd(), "public", "data", "elections", "northern-ireland", "assembly", year, "election_data.csv");
  const rows = parse(fs.readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    bom: true,
  }) as Array<Record<string, string>>;
  const byConstituency = new Map<string, Map<number, Map<string, CountCandidate>>>();
  const metadata = new Map<string, { seats: number; validVotes: number; electorate: number }>();
  const nationalVotes = new Map<string, number>();

  for (const row of rows) {
    const constituency = String(row.constituency ?? "").trim();
    const countNumber = Math.floor(toNumber(row.count));
    const id = String(row.candidate_id ?? "").trim();
    const party = String(row.party ?? "").trim().toUpperCase();
    if (!constituency || !id || !party || countNumber < 1) continue;
    const candidate: CountCandidate = {
      id,
      name: String(row.candidate ?? "").trim(),
      party,
      votes: String(row.votes ?? "").trim() === "" ? null : toNumber(row.votes),
      quota: toNumber(row.quota),
      status: String(row.status ?? "running").trim().toLowerCase(),
      incumbent: String(row.incumbent ?? "").trim().toUpperCase() === "TRUE",
    };
    const counts = byConstituency.get(constituency) ?? new Map<number, Map<string, CountCandidate>>();
    const count = counts.get(countNumber) ?? new Map<string, CountCandidate>();
    count.set(id, candidate);
    counts.set(countNumber, count);
    byConstituency.set(constituency, counts);

    if (countNumber === 1) {
      metadata.set(constituency, {
        seats: Math.floor(toNumber(row.seats)) || 5,
        validVotes: toNumber(row.tvp),
        electorate: toNumber(row.electorate),
      });
      const firstPreference = candidate.votes ?? 0;
      nationalVotes.set(party, (nationalVotes.get(party) ?? 0) + firstPreference);
    }
  }

  const constituencies = new Map<string, RawConstituency>();
  for (const [name, countMap] of byConstituency) {
    const allCounts = [...countMap.entries()].sort((a, b) => a[0] - b[0]);
    const firstCount = countMap.get(1);
    if (!firstCount) continue;
    const candidates = [...firstCount.values()];
    const counts = allCounts.map(([number, items]) => ({ number, candidates: [...items.values()] }));
    const stats = metadata.get(name) ?? { seats: 5, validVotes: 0, electorate: 0 };
    constituencies.set(name, {
      seats: stats.seats,
      validVotes: stats.validVotes || candidates.reduce((sum, item) => sum + (item.votes ?? 0), 0),
      electorate: stats.electorate,
      candidates,
      counts,
    });
  }
  return { constituencies, nationalVotes };
}

function inferTransferProfile(year: AssemblyYear) {
  const file = path.join(process.cwd(), "public", "data", "elections", "northern-ireland", "assembly", year, "election_data.csv");
  const rows = parse(fs.readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    bom: true,
  }) as Array<Record<string, string>>;
  const grouped = new Map<string, Map<number, Map<string, CountCandidate>>>();
  for (const row of rows) {
    const constituency = String(row.constituency ?? "").trim();
    const count = Math.floor(toNumber(row.count));
    const id = String(row.candidate_id ?? "").trim();
    if (!constituency || !id || count < 1) continue;
    const candidates = grouped.get(constituency) ?? new Map<number, Map<string, CountCandidate>>();
    const byCount = candidates.get(count) ?? new Map<string, CountCandidate>();
    byCount.set(id, {
      id,
      name: String(row.candidate ?? "").trim(),
      party: String(row.party ?? "").trim().toUpperCase(),
      votes: String(row.votes ?? "").trim() === "" ? null : toNumber(row.votes),
      quota: toNumber(row.quota),
      status: String(row.status ?? "running").trim().toLowerCase(),
      incumbent: String(row.incumbent ?? "").trim().toUpperCase() === "TRUE",
    });
    candidates.set(count, byCount);
    grouped.set(constituency, candidates);
  }

  const flows = new Map<string, Map<string, number>>();
  const pools = new Map<string, number>();
  const eventCounts = new Map<string, number>();
  let transitions = 0;
  let unusableTransitions = 0;

  for (const counts of grouped.values()) {
    const numbers = [...counts.keys()].sort((a, b) => a - b);
    for (let index = 0; index < numbers.length - 1; index += 1) {
      const previousCountNumber = numbers[index];
      const nextCountNumber = numbers[index + 1];
      if (nextCountNumber !== previousCountNumber + 1) continue;
      transitions += 1;
      const previous = counts.get(previousCountNumber)!;
      const next = counts.get(nextCountNumber)!;
      const earlier = index > 0 ? counts.get(numbers[index - 1]) : undefined;
      const sources = [...previous.values()].filter((candidate) => {
        const priorStatus = earlier?.get(candidate.id)?.status;
        return (candidate.status === "eliminated" && priorStatus !== "eliminated")
          || (candidate.status === "elected" && priorStatus !== "elected");
      });
      if (sources.length !== 1) {
        unusableTransitions += 1;
        continue;
      }
      const source = sources[0];
      if (source.votes === null) continue;
      const sourceType = source.status === "eliminated" ? "elimination" : "surplus";
      const pool = sourceType === "elimination" ? source.votes : Math.max(0, source.votes - source.quota);
      if (pool <= 0) continue;
      const destinationGains = new Map<string, number>();
      for (const recipient of next.values()) {
        if (recipient.id === source.id || recipient.votes === null) continue;
        const before = previous.get(recipient.id)?.votes;
        if (before === null || before === undefined) continue;
        const gain = recipient.votes - before;
        if (gain > 0) destinationGains.set(recipient.party, (destinationGains.get(recipient.party) ?? 0) + gain);
      }
      const observed = [...destinationGains.values()].reduce((sum, value) => sum + value, 0);
      if (observed <= 0 || observed > pool * 1.1) continue;
      const profileKey = `${sourceType}:${source.party}`;
      pools.set(profileKey, (pools.get(profileKey) ?? 0) + pool);
      eventCounts.set(profileKey, (eventCounts.get(profileKey) ?? 0) + 1);
      for (const [party, gain] of destinationGains) {
        const partyFlows = flows.get(profileKey) ?? new Map<string, number>();
        partyFlows.set(party, (partyFlows.get(party) ?? 0) + gain);
        flows.set(profileKey, partyFlows);
      }
    }
  }

  const profile: NiAssemblyTransferProfiles = { elimination: {}, surplus: {}, eliminationByBloc: {}, surplusByBloc: {} };
  for (const [profileKey, destinations] of flows) {
    const [sourceType, sourceParty] = profileKey.split(":") as ["elimination" | "surplus", string];
    const totalGains = [...destinations.values()].reduce((sum, value) => sum + value, 0);
    const sourcePool = pools.get(profileKey) ?? 0;
    const transferredVotes = Math.min(totalGains, sourcePool);
    profile[sourceType][sourceParty] = {
      sourceParty,
      destinations: Object.fromEntries([...destinations].map(([party, votes]) => [party, totalGains > 0 ? votes / totalGains : 0])),
      retention: sourcePool > 0 ? Math.min(1, totalGains / sourcePool) : 0.8,
      eventCount: eventCounts.get(profileKey) ?? 0,
      transferredVotes,
      sourceVotes: sourcePool,
    };
  }
  return { profile, transitions, unusableTransitions, eventCount: [...eventCounts.values()].reduce((sum, value) => sum + value, 0) };
}

export function loadNiAssemblyProjectionData(): NiAssemblyProjectionData {
  const electionByYear = Object.fromEntries(YEARS.map((year) => [year, readElection(year)])) as Record<AssemblyYear, RawElection>;
  const westminster2024File = path.join(process.cwd(), "public", "data", "elections", "northern-ireland", "house-of-commons", "2024", "election_data.csv");
  const westminster2024Rows = parse(fs.readFileSync(westminster2024File, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    bom: true,
  }) as Array<Record<string, string>>;
  const westminster2024Votes = new Map<string, Map<string, number>>();
  const westminster2024NationalVotes = new Map<string, number>();
  for (const row of westminster2024Rows) {
    if (String(row.count).trim() !== "1") continue;
    const sourceName = String(row.constituency ?? "").trim();
    const constituency = sourceName === "Belfast South" ? "Belfast South and Mid Down" : sourceName;
    const party = String(row.party ?? "").trim().toUpperCase();
    const votes = toNumber(row.votes);
    if (!constituency || !party || votes < 0) continue;
    const localVotes = westminster2024Votes.get(constituency) ?? new Map<string, number>();
    localVotes.set(party, (localVotes.get(party) ?? 0) + votes);
    westminster2024Votes.set(constituency, localVotes);
    westminster2024NationalVotes.set(party, (westminster2024NationalVotes.get(party) ?? 0) + votes);
  }
  const westminster2024Total = [...westminster2024NationalVotes.values()].reduce((sum, value) => sum + value, 0);
  const westminster2024NationalShare = Object.fromEntries([...westminster2024NationalVotes].map(([party, votes]) => [party, westminster2024Total > 0 ? votes / westminster2024Total * 100 : 0]));
  const nationalShares: Record<AssemblyYear, Record<string, number>> = { "2017": {}, "2022": {} };
  for (const year of YEARS) {
    const votes = electionByYear[year].nationalVotes;
    const total = [...votes.values()].reduce((sum, value) => sum + value, 0);
    nationalShares[year] = Object.fromEntries([...votes].map(([party, value]) => [party, total > 0 ? value / total * 100 : 0]));
  }

  const partiesSet = new Set([...Object.keys(nationalShares["2017"]), ...Object.keys(nationalShares["2022"])]);
  const baselineSeatsByParty: Record<string, number> = {};
  for (const constituency of electionByYear["2022"].constituencies.values()) {
    const lastCount = constituency.counts[constituency.counts.length - 1];
    const finalCount = lastCount?.candidates ?? [];
    for (const candidate of finalCount) {
      if (candidate.status === "elected") baselineSeatsByParty[candidate.party] = (baselineSeatsByParty[candidate.party] ?? 0) + 1;
    }
  }
  const parties: NiAssemblyParty[] = [...partiesSet].map((code) => ({
    code,
    name: PARTY_BY_CODE[code]?.name ?? code,
    color: PARTY_BY_CODE[code]?.color ?? "#7a8589",
    baselineShare: nationalShares["2022"][code] ?? 0,
    baselineSeats: baselineSeatsByParty[code] ?? 0,
  })).sort((a, b) => b.baselineShare - a.baselineShare || a.code.localeCompare(b.code));

  const constituencies: NiAssemblyConstituency[] = [...electionByYear["2022"].constituencies.entries()].map(([sourceName, current]) => {
    const name = sourceName === "Belfast South" ? "Belfast South and Mid Down" : sourceName;
    const currentFirstPrefs = Object.fromEntries(current.candidates.map((candidate) => [candidate.id, candidate.votes ?? 0]));
    const partyTotals = current.candidates.reduce<Record<string, number>>((totals, candidate) => {
      totals[candidate.party] = (totals[candidate.party] ?? 0) + (candidate.votes ?? 0);
      return totals;
    }, {});
    const candidates = current.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      party: candidate.party,
      incumbent: candidate.incumbent,
      firstPreferences: currentFirstPrefs[candidate.id] ?? 0,
      withinPartyShare: partyTotals[candidate.party] > 0 ? (candidate.votes ?? 0) / partyTotals[candidate.party] : 0,
    }));
    const firstPreferencesByParty = partyTotals;
    const localShareByYear = Object.fromEntries(YEARS.map((year) => {
      const historical = electionByYear[year].constituencies.get(sourceName);
      const historicPartyTotals = historical?.candidates.reduce<Record<string, number>>((totals, candidate) => {
        totals[candidate.party] = (totals[candidate.party] ?? 0) + (candidate.votes ?? 0);
        return totals;
      }, {}) ?? {};
      const validVotes = Object.values(historicPartyTotals).reduce((sum, value) => sum + value, 0);
      return [year, Object.fromEntries(Object.entries(historicPartyTotals).map(([party, votes]) => [party, validVotes > 0 ? votes / validVotes * 100 : 0]))];
    })) as Record<AssemblyYear, Record<string, number>>;
    const westminsterVotes = westminster2024Votes.get(name) ?? new Map<string, number>();
    const westminsterTotal = [...westminsterVotes.values()].reduce((sum, value) => sum + value, 0);
    const westminster2024LocalShare = Object.fromEntries([...westminsterVotes].map(([party, votes]) => [party, westminsterTotal > 0 ? votes / westminsterTotal * 100 : 0]));
    const total = current.validVotes || Object.values(firstPreferencesByParty).reduce((sum, value) => sum + value, 0);
    const quota = Math.floor(total / (current.seats + 1)) + 1;
    return {
      name,
      seats: current.seats,
      validVotes: total,
      electorate: current.electorate,
      quota,
      candidates,
      firstPreferencesByParty,
      localShareByYear,
      westminster2024LocalShare,
      countHistory: current.counts,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const transferByYear = YEARS.map((year) => ({ year, ...inferTransferProfile(year) }));
  const transfers: NiAssemblyTransferProfiles = { elimination: {}, surplus: {}, eliminationByBloc: {}, surplusByBloc: {} };
  for (const sourceType of ["elimination", "surplus"] as const) {
    const sourceRows = new Map<string, { flows: Record<string, number>; transferredVotes: number; sourceVotes: number; eventCount: number }>();
    for (const sourceResult of transferByYear) {
      for (const [sourceParty, row] of Object.entries(sourceResult.profile[sourceType])) {
        const pooled = sourceRows.get(sourceParty) ?? { flows: {}, transferredVotes: 0, sourceVotes: 0, eventCount: 0 };
        for (const [destination, share] of Object.entries(row.destinations)) pooled.flows[destination] = (pooled.flows[destination] ?? 0) + share * row.transferredVotes;
        pooled.transferredVotes += row.transferredVotes;
        pooled.sourceVotes += row.sourceVotes;
        pooled.eventCount += row.eventCount;
        sourceRows.set(sourceParty, pooled);
      }
    }
    const blocRows = new Map<string, { flows: Record<string, number>; transferredVotes: number; sourceVotes: number; eventCount: number }>();
    for (const [sourceParty, pooled] of sourceRows) {
      const total = Object.values(pooled.flows).reduce((sum, value) => sum + value, 0);
      const row: NiAssemblyTransfer = {
        sourceParty,
        destinations: Object.fromEntries(Object.entries(pooled.flows).map(([party, value]) => [party, total > 0 ? value / total : 0])),
        retention: pooled.sourceVotes > 0 ? Math.min(1, pooled.transferredVotes / pooled.sourceVotes) : 0.8,
        eventCount: pooled.eventCount,
        transferredVotes: pooled.transferredVotes,
        sourceVotes: pooled.sourceVotes,
      };
      transfers[sourceType][sourceParty] = row;
      const bloc = getProjectionBloc(sourceParty);
      const blocPool = blocRows.get(bloc) ?? { flows: {}, transferredVotes: 0, sourceVotes: 0, eventCount: 0 };
      for (const [destination, share] of Object.entries(row.destinations)) blocPool.flows[destination] = (blocPool.flows[destination] ?? 0) + share * row.transferredVotes;
      blocPool.transferredVotes += row.transferredVotes;
      blocPool.sourceVotes += row.sourceVotes;
      blocPool.eventCount += row.eventCount;
      blocRows.set(bloc, blocPool);
    }
    const blocProfiles = sourceType === "surplus" ? transfers.surplusByBloc : transfers.eliminationByBloc;
    for (const [bloc, pooled] of blocRows) {
      const total = Object.values(pooled.flows).reduce((sum, value) => sum + value, 0);
      blocProfiles[bloc] = {
        sourceParty: `${bloc} bloc`,
        destinations: Object.fromEntries(Object.entries(pooled.flows).map(([party, value]) => [party, total > 0 ? value / total : 0])),
        retention: pooled.sourceVotes > 0 ? Math.min(1, pooled.transferredVotes / pooled.sourceVotes) : 0.8,
        eventCount: pooled.eventCount,
        transferredVotes: pooled.transferredVotes,
        sourceVotes: pooled.sourceVotes,
      };
    }
  }

  const totalVotes = constituencies.reduce((sum, constituency) => sum + constituency.validVotes, 0);
  const transferEventCount = Object.values(transfers.elimination).reduce((sum, transfer) => sum + transfer.eventCount, 0)
    + Object.values(transfers.surplus).reduce((sum, transfer) => sum + transfer.eventCount, 0);
  return {
    baselineYear: "2022",
    electionLabel: "Northern Ireland Assembly 2022",
    seats: constituencies.reduce((sum, constituency) => sum + constituency.seats, 0),
    validVotes: totalVotes,
    nationalShareByYear: nationalShares,
    westminster2024NationalShare,
    parties,
    constituencies,
    mapFeatures: projectBoundaryFeatures(path.join(process.cwd(), "public", "data", "elections", "northern-ireland", "house-of-commons", "2024", "boundaries.geojson")),
    transfers,
    transferDiagnostics: {
      events: transferEventCount,
      transitions: transferByYear.reduce((sum, item) => sum + item.transitions, 0),
      unusableTransitions: transferByYear.reduce((sum, item) => sum + item.unusableTransitions, 0),
      years: [...YEARS],
    },
  };
}
