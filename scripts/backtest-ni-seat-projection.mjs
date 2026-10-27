import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, "public", "data", "elections", "northern-ireland");
const OUTPUT_ROOT = path.join(ROOT, "reports", "ni-seat-projection-backtest");
const TARGET_YEARS = ["2015", "2017", "2019", "2024"];
const TRAINING_YEARS = ["2015", "2017", "2019"];
const BLOCS = ["Nationalist", "Unionist", "Non-aligned"];
const PARTY_BLOC = {
  SF: "Nationalist", SDLP: "Nationalist", AON: "Nationalist", PBP: "Nationalist", PD: "Nationalist",
  INDN: "Nationalist", WP: "Nationalist", DUP: "Unionist", UUP: "Unionist", TUV: "Unionist",
  INDU: "Unionist", PUP: "Unionist", CON: "Unionist", UKIP: "Unionist",
};
const WESTMINSTER_WEIGHTS = { "2015": 0.15, "2017": 0.225, "2019": 0.375 };
const ASSEMBLY_WEIGHTS = { "2017": 0.075, "2022": 0.175 };
const DEFAULT_PARAMETERS = {
  blocHistoryScale: 1,
  blocSwingWeight: 30,
  partyHistoryScale: 1,
  partySwingWeight: 30,
};
const HISTORY_SCALES = [0, 0.5, 1, 1.5, 2];
const SWING_WEIGHTS = [0, 15, 30, 45, 60];
const INCUMBENT_LOG_EFFECTS = [-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4];
const PARTY_RATIO_PRIOR_STRENGTHS = [0, 0.1, 0.25, 0.5, 1];
const PARTY_FAMILY_SHRINKAGES = [0, 0.25, 0.5, 0.75, 1];
const PARTY_COVERAGE_EXPONENTS = [0, 0.5, 1, 1.5, 2];
const CANDIDATE_CONTINUITY_SCALES = [1, 1.25, 1.5, 2, 3, 4];

function blocForParty(code) {
  return PARTY_BLOC[code] ?? "Non-aligned";
}

function number(value) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    bom: true,
  });
}

function constituencyForTarget(name, targetYear) {
  return targetYear === "2024" && name === "Belfast South" ? "Belfast South and Mid Down" : name;
}

function loadVoteTable(filePath, { firstPreferenceOnly = false, targetYear } = {}) {
  const localVotes = new Map();
  const nationalVotes = new Map();
  const seats = new Map();
  const candidates = new Map();
  for (const row of readCsv(filePath)) {
    if (firstPreferenceOnly && String(row.count ?? "").trim() !== "1") continue;
    const constituency = String(row.constituency ?? "").trim();
    const party = String(row.party ?? "").trim().toUpperCase();
    const votes = number(row.votes);
    if (!constituency || !party || votes < 0) continue;
    const normalizedConstituency = targetYear ? constituencyForTarget(constituency, targetYear) : constituency;
    const constituencyVotes = localVotes.get(normalizedConstituency) ?? new Map();
    constituencyVotes.set(party, (constituencyVotes.get(party) ?? 0) + votes);
    localVotes.set(normalizedConstituency, constituencyVotes);
    if (firstPreferenceOnly) {
      const records = candidates.get(normalizedConstituency) ?? [];
      records.push({
        party,
        id: String(row.candidate_id ?? "").trim(),
        name: String(row.candidate ?? "").trim(),
        incumbent: ["true", "1", "yes"].includes(String(row.incumbent ?? "").trim().toLowerCase()),
        votes,
      });
      candidates.set(normalizedConstituency, records);
    }
    nationalVotes.set(party, (nationalVotes.get(party) ?? 0) + votes);
    const rowSeats = number(row.seats);
    if (rowSeats > 0) seats.set(normalizedConstituency, rowSeats);
  }
  return { localVotes, nationalVotes, seats, candidates, contestantNationalWithinBloc: contestantNationalWithinBloc(localVotes) };
}

function contestantNationalWithinBloc(localVotes) {
  const parties = new Set([...localVotes.values()].flatMap((votes) => [...votes.keys()]));
  return new Map([...parties].map((party) => {
    let partyVotes = 0;
    let blocVotes = 0;
    for (const votes of localVotes.values()) {
      if (!votes.has(party)) continue;
      partyVotes += votes.get(party) ?? 0;
      for (const [otherParty, count] of votes) {
        if (blocForParty(otherParty) === blocForParty(party)) blocVotes += count;
      }
    }
    return [party, blocVotes > 0 ? partyVotes / blocVotes : 0];
  }));
}

function toShareMap(votes) {
  const shares = new Map();
  for (const [constituency, partyVotes] of votes) {
    const total = [...partyVotes.values()].reduce((sum, value) => sum + value, 0);
    shares.set(constituency, new Map([...partyVotes].map(([party, value]) => [party, total > 0 ? value / total * 100 : 0])));
  }
  return shares;
}

function partyCoverage(localShares) {
  const counts = new Map();
  for (const shares of localShares.values()) {
    for (const party of shares.keys()) counts.set(party, (counts.get(party) ?? 0) + 1);
  }
  const total = localShares.size;
  return new Map([...counts].map(([party, count]) => [party, total > 0 ? count / total : 0]));
}

function nationalShares(votes) {
  const total = [...votes.values()].reduce((sum, value) => sum + value, 0);
  return new Map([...votes].map(([party, value]) => [party, total > 0 ? value / total * 100 : 0]));
}

function assemblyTransferStats(year) {
  const rows = readCsv(path.join(DATA_ROOT, "assembly", year, "election_data.csv"));
  const byConstituency = new Map();
  for (const row of rows) {
    const constituency = String(row.constituency ?? "").trim();
    const count = Number(row.count);
    const candidateId = String(row.candidate_id ?? "").trim();
    if (!constituency || !Number.isFinite(count) || !candidateId) continue;
    const counts = byConstituency.get(constituency) ?? new Map();
    const candidates = counts.get(count) ?? new Map();
    candidates.set(candidateId, {
      id: candidateId,
      party: String(row.party ?? "").trim().toUpperCase(),
      candidate: String(row.candidate ?? "").trim(),
      votes: String(row.votes ?? "").trim() === "" ? null : number(row.votes),
      quota: number(row.quota),
      status: String(row.status ?? "").trim().toLowerCase(),
    });
    counts.set(count, candidates);
    byConstituency.set(constituency, counts);
  }

  const flowVotes = new Map();
  const sourceEvents = new Map();
  const diagnostics = { year, constituencies: byConstituency.size, transitions: 0, singleSourceTransitions: 0, ambiguousTransitions: 0, usableEvents: 0, invalidEvents: 0, observedTransferVotes: 0, sourceVotePool: 0 };
  for (const [constituency, counts] of byConstituency) {
    const countNumbers = [...counts.keys()].sort((a, b) => a - b);
    for (let index = 0; index < countNumbers.length - 1; index += 1) {
      const fromCount = countNumbers[index];
      const toCount = countNumbers[index + 1];
      if (toCount !== fromCount + 1) continue;
      diagnostics.transitions += 1;
      const from = counts.get(fromCount);
      const to = counts.get(toCount);
      const previous = counts.get(countNumbers[index - 1]);
      const events = [...from.values()].flatMap((candidate) => {
        const previousStatus = previous?.get(candidate.id)?.status;
        if (candidate.status === "eliminated" && previousStatus !== "eliminated") return [{ type: "elimination", candidate }];
        if (candidate.status === "elected" && previousStatus !== "elected") return [{ type: "surplus", candidate }];
        return [];
      });
      if (events.length !== 1) {
        diagnostics.ambiguousTransitions += 1;
        continue;
      }
      diagnostics.singleSourceTransitions += 1;
      const { type, candidate: source } = events[0];
      if (!source.party || source.votes === null) {
        diagnostics.invalidEvents += 1;
        continue;
      }
      const pool = type === "elimination" ? source.votes : Math.max(0, source.votes - source.quota);
      if (pool <= 0) {
        diagnostics.invalidEvents += 1;
        continue;
      }
      const destinations = [];
      for (const recipient of to.values()) {
        if (recipient.id === source.id || recipient.votes === null || !recipient.party) continue;
        const previousVotes = from.get(recipient.id)?.votes;
        if (previousVotes === null || previousVotes === undefined) continue;
        const gained = recipient.votes - previousVotes;
        if (gained > 0) destinations.push({ party: recipient.party, votes: gained });
      }
      const observed = destinations.reduce((sum, item) => sum + item.votes, 0);
      if (observed <= 0 || observed > pool * 1.1) {
        diagnostics.invalidEvents += 1;
        continue;
      }
      diagnostics.usableEvents += 1;
      diagnostics.observedTransferVotes += observed;
      diagnostics.sourceVotePool += pool;
      sourceEvents.set(source.party, (sourceEvents.get(source.party) ?? 0) + 1);
      for (const destination of destinations) {
        const sourceFlows = flowVotes.get(source.party) ?? new Map();
        sourceFlows.set(destination.party, (sourceFlows.get(destination.party) ?? 0) + destination.votes);
        flowVotes.set(source.party, sourceFlows);
      }
      void constituency;
    }
  }
  diagnostics.observedTransferRetention = diagnostics.sourceVotePool > 0
    ? diagnostics.observedTransferVotes / diagnostics.sourceVotePool
    : 0;
  return { year, flowVotes, sourceEvents, diagnostics };
}

function assemblyTransferProfile(years) {
  const stats = years.map(assemblyTransferStats);
  const flowVotes = new Map();
  const sourceEvents = new Map();
  for (const result of stats) {
    for (const [source, destinations] of result.flowVotes) {
      const totals = flowVotes.get(source) ?? new Map();
      for (const [destination, votes] of destinations) totals.set(destination, (totals.get(destination) ?? 0) + votes);
      flowVotes.set(source, totals);
    }
    for (const [source, events] of result.sourceEvents) sourceEvents.set(source, (sourceEvents.get(source) ?? 0) + events);
  }
  const probabilities = new Map([...flowVotes].map(([source, destinations]) => {
    const total = [...destinations.values()].reduce((sum, votes) => sum + votes, 0);
    return [source, new Map([...destinations].map(([destination, votes]) => [destination, total > 0 ? votes / total : 0]))];
  }));
  return { years, stats: stats.map((item) => item.diagnostics), flowVotes, sourceEvents, probabilities };
}

function blocShares(partyShares) {
  const totals = new Map(BLOCS.map((bloc) => [bloc, 0]));
  for (const [party, share] of partyShares) totals.set(blocForParty(party), (totals.get(blocForParty(party)) ?? 0) + share);
  return totals;
}

function loadElection(targetYear) {
  const directory = path.join(DATA_ROOT, "house-of-commons", targetYear);
  const target = loadVoteTable(path.join(directory, "election_data.csv"), { firstPreferenceOnly: true, targetYear });
  const baseline = loadVoteTable(path.join(directory, "previous_results.csv"), { targetYear });
  const baselineYear = ({ "2015": "2010", "2017": "2015", "2019": "2017", "2024": "2019" })[targetYear];
  const transferYears = Object.keys(ASSEMBLY_WEIGHTS).filter((year) => Number(year) <= Number(targetYear));
  const transferProfile = assemblyTransferProfile(transferYears);
  const sources = [];

  for (const year of Object.keys(WESTMINSTER_WEIGHTS)) {
    if (Number(year) >= Number(baselineYear)) continue;
    const source = loadVoteTable(
      path.join(DATA_ROOT, "house-of-commons", year, "election_data.csv"),
      { firstPreferenceOnly: true, targetYear },
    );
    const localShares = toShareMap(source.localVotes);
    sources.push({ type: "Westminster", year, weight: WESTMINSTER_WEIGHTS[year], ...source, localShares, coverageByParty: partyCoverage(localShares), nationalShareMap: nationalShares(source.nationalVotes) });
  }

  for (const year of Object.keys(ASSEMBLY_WEIGHTS)) {
    // The 2017 Assembly election predates the 2017 Westminster election.
    if (Number(year) > Number(targetYear)) continue;
    const source = loadVoteTable(
      path.join(DATA_ROOT, "assembly", year, "election_data.csv"),
      { firstPreferenceOnly: true, targetYear },
    );
    const localShares = toShareMap(source.localVotes);
    sources.push({ type: "Assembly", year, weight: ASSEMBLY_WEIGHTS[year], ...source, localShares, coverageByParty: partyCoverage(localShares), nationalShareMap: nationalShares(source.nationalVotes) });
  }

  const targetShares = toShareMap(target.localVotes);
  const baselineShares = toShareMap(baseline.localVotes);
  const baselineCoverageByParty = partyCoverage(baselineShares);
  return {
    targetYear,
    baselineYear,
    constituencies: [...targetShares.keys()].map((name) => {
      const partyShares = targetShares.get(name);
      const actualWinner = [...partyShares].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
      return {
        name,
        seats: target.seats.get(name) ?? 1,
        candidateCodes: [...partyShares.keys()],
        candidates: target.candidates.get(name) ?? [],
        actualShares: partyShares,
        baselineShares: baselineShares.get(name) ?? new Map(),
        actualWinner,
        sources,
      };
    }).sort((a, b) => a.name.localeCompare(b.name)),
    targetNationalShares: nationalShares(target.nationalVotes),
    baselineNationalShares: nationalShares(baseline.nationalVotes),
    baselineCoverageByParty,
    baselineContestantWithinBloc: baseline.contestantNationalWithinBloc,
    transferProfile,
    sources,
  };
}

function weightedRatio(sources, method = "arithmetic") {
  const totalWeight = sources.reduce((sum, source) => sum + source.weight, 0);
  if (totalWeight <= 0) return null;
  if (method === "geometric") {
    return Math.exp(sources.reduce((sum, source) => sum + Math.log(Math.max(0.0001, source.ratio)) * source.weight, 0) / totalWeight);
  }
  return sources.reduce((sum, source) => sum + source.ratio * source.weight, 0) / totalWeight;
}

function weightedOffset(sources) {
  const totalWeight = sources.reduce((sum, source) => sum + source.weight, 0);
  return totalWeight > 0
    ? sources.reduce((sum, source) => sum + source.offset * source.weight, 0) / totalWeight
    : 0;
}

function historyRatioSources(constituency, bloc, dataset, { includeBaseline, historyScale }) {
  const sources = [];
  if (includeBaseline) {
    const local = blocShares(constituency.baselineShares).get(bloc) ?? 0;
    const national = blocShares(dataset.baselineNationalShares).get(bloc) ?? 0;
    const weight = WESTMINSTER_WEIGHTS[dataset.baselineYear] ?? 1;
    if (local > 0 && national > 0) sources.push({ ratio: local / national, weight });
  }
  for (const source of dataset.sources) {
    if (source.type === "Westminster" && Number(source.year) >= Number(dataset.baselineYear)) continue;
    const localShares = source.localShares.get(constituency.name) ?? new Map();
    // A bloc with no local candidate is unobserved, not a true zero-share result.
    if (![...localShares.keys()].some((party) => blocForParty(party) === bloc)) continue;
    const local = blocShares(localShares).get(bloc) ?? 0;
    const national = blocShares(source.nationalShareMap).get(bloc) ?? 0;
    if (national > 0) sources.push({ ratio: local / national, weight: source.weight * historyScale });
  }
  return sources;
}

function historicalBlocOffsetSources(constituency, bloc, dataset) {
  return dataset.sources.flatMap((source) => {
    if (source.type === "Westminster" && Number(source.year) >= Number(dataset.baselineYear)) return [];
    const localShares = source.localShares.get(constituency.name) ?? new Map();
    if (![...localShares.keys()].some((party) => blocForParty(party) === bloc)) return [];
    const local = blocShares(localShares).get(bloc) ?? 0;
    const national = blocShares(source.nationalShareMap).get(bloc) ?? 0;
    return national > 0 ? [{ offset: local - national, weight: source.weight }] : [];
  });
}

function localBlocBaselineShare(constituency, bloc, dataset, historyScale) {
  const ratio = weightedRatio(historyRatioSources(constituency, bloc, dataset, {
    includeBaseline: true,
    historyScale,
  }), dataset.ratioAggregation ?? "arithmetic");
  if (ratio !== null) {
    const nationalBloc = blocShares(dataset.baselineNationalShares).get(bloc) ?? 0;
    return Math.max(0, Math.min(100, nationalBloc * ratio));
  }
  const nationalBloc = blocShares(dataset.baselineNationalShares).get(bloc) ?? 0;
  return Math.max(0, Math.min(100, nationalBloc + weightedOffset(historicalBlocOffsetSources(constituency, bloc, dataset))));
}

function localBlocSwingMultiplier(constituency, bloc, dataset, swingWeight) {
  const latest = (blocShares(constituency.baselineShares).get(bloc) ?? 0)
    - (blocShares(dataset.baselineNationalShares).get(bloc) ?? 0);
  const historical = weightedOffset(historicalBlocOffsetSources(constituency, bloc, dataset));
  return Math.max(0.25, Math.min(1.75, 1 + (historical - latest) * (swingWeight / 100)));
}

function partyRatioSources(partyCode, bloc, constituency, dataset, historyScale, coverageExponent = 0, contestantConditionalRatios = false, candidateContinuityScale = 1) {
  const sources = [];
  const add = (localShares, nationalShares, nationalContestantRatio, weight, coverage = 1, year, type = "Westminster") => {
    const localBloc = blocShares(localShares).get(bloc) ?? 0;
    const nationalBloc = blocShares(nationalShares).get(bloc) ?? 0;
    const localParty = localShares.get(partyCode);
    const nationalParty = nationalShares.get(partyCode);
    const nationalPartyWithinBloc = contestantConditionalRatios
      ? nationalContestantRatio.get(partyCode)
      : nationalBloc > 0 && nationalParty !== undefined ? nationalParty / nationalBloc : undefined;
    if (localParty === undefined || nationalParty === undefined || localBloc <= 0 || nationalBloc <= 0 || nationalPartyWithinBloc === undefined || nationalPartyWithinBloc <= 0) return;
    sources.push({ ratio: (localParty / localBloc) / nationalPartyWithinBloc, weight: weight * Math.pow(coverage, coverageExponent), year: Number(year), type });
  };

  if (constituency.baselineShares.has(partyCode)) {
    add(constituency.baselineShares, dataset.baselineNationalShares, dataset.baselineContestantWithinBloc, WESTMINSTER_WEIGHTS[dataset.baselineYear] ?? 1, dataset.baselineCoverageByParty.get(partyCode) ?? 1, dataset.baselineYear);
  }
  for (const source of dataset.sources) {
    if (source.type === "Westminster" && Number(source.year) >= Number(dataset.baselineYear)) continue;
    const local = source.localShares.get(constituency.name);
    if (local) {
      const targetCandidateId = constituency.candidates.find((candidate) => candidate.party === partyCode)?.id;
      const historicalCandidateId = source.candidates.get(constituency.name)?.find((candidate) => candidate.party === partyCode)?.id;
      const continuityWeight = targetCandidateId && targetCandidateId === historicalCandidateId ? candidateContinuityScale : 1;
      add(local, source.nationalShareMap, source.contestantNationalWithinBloc, source.weight * historyScale * continuityWeight, source.coverageByParty.get(partyCode) ?? 1, source.year, source.type);
    }
  }
  return sources;
}

function fullLocalNationalRatioSources(partyCode, constituency, dataset, parameters) {
  const sources = [];
  const add = (localShares, nationalShares, weight, coverage = 1, candidateContinuity = 1) => {
    const localParty = localShares.get(partyCode);
    const nationalParty = nationalShares.get(partyCode);
    if (localParty === undefined || nationalParty === undefined || nationalParty <= 0) return;
    sources.push({
      ratio: localParty / nationalParty,
      weight: weight * Math.pow(coverage, parameters.partyCoverageExponent ?? 0) * candidateContinuity,
    });
  };

  add(
    constituency.baselineShares,
    dataset.baselineNationalShares,
    WESTMINSTER_WEIGHTS[dataset.baselineYear] ?? 1,
    dataset.baselineCoverageByParty.get(partyCode) ?? 1,
  );
  for (const source of dataset.sources) {
    if (source.type === "Westminster" && Number(source.year) >= Number(dataset.baselineYear)) continue;
    const localShares = source.localShares.get(constituency.name);
    if (!localShares) continue;
    const targetCandidateId = constituency.candidates.find((candidate) => candidate.party === partyCode)?.id;
    const historicalCandidateId = source.candidates.get(constituency.name)?.find((candidate) => candidate.party === partyCode)?.id;
    const candidateContinuity = targetCandidateId && targetCandidateId === historicalCandidateId
      ? parameters.candidateContinuityScale ?? 1
      : 1;
    add(
      localShares,
      source.nationalShareMap,
      source.weight * (parameters.partyHistoryScale ?? 1),
      source.coverageByParty.get(partyCode) ?? 1,
      candidateContinuity,
    );
  }
  return sources;
}

function localRatioTrendMultiplier(sources, targetYear, trendScale) {
  if (trendScale === 0) return 1;
  const trends = ["Westminster", "Assembly"].flatMap((type) => {
    const series = sources.filter((source) => source.type === type && source.weight > 0).sort((a, b) => a.year - b.year);
    if (series.length < 2) return [];
    const previous = series[series.length - 2];
    const latest = series[series.length - 1];
    const elapsed = latest.year - previous.year;
    const horizon = Math.max(0, Number(targetYear) - latest.year);
    if (elapsed <= 0 || horizon <= 0) return [];
    return [{
      logChange: (Math.log(Math.max(0.0001, latest.ratio)) - Math.log(Math.max(0.0001, previous.ratio))) / elapsed * horizon,
      weight: latest.weight,
    }];
  });
  const totalWeight = trends.reduce((sum, trend) => sum + trend.weight, 0);
  if (totalWeight <= 0) return 1;
  const projectedLogChange = trends.reduce((sum, trend) => sum + trend.logChange * trend.weight, 0) / totalWeight * trendScale;
  return Math.exp(Math.max(Math.log(0.5), Math.min(Math.log(2), projectedLogChange)));
}

function applyInterBlocTacticalVoting(parties, rate, competitivenessMargin) {
  if (rate <= 0 || parties.length < 2) return parties;
  const ranked = parties.slice().sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
  const leader = ranked[0];
  const runnerUp = ranked[1];
  if (!leader || !runnerUp || leader.bloc === runnerUp.bloc || leader.share - runnerUp.share > competitivenessMargin) return parties;
  const routes = [
    { from: "Nationalist", to: "Non-aligned" },
    { from: "Non-aligned", to: "Nationalist" },
    { from: "Unionist", to: "Non-aligned" },
    { from: "Non-aligned", to: "Unionist" },
  ];
  const target = parties.filter((party) => party.bloc === runnerUp.bloc)
    .slice().sort((a, b) => b.share - a.share || a.code.localeCompare(b.code))[0];
  if (!target || target.code !== runnerUp.code) return parties;
  const outgoing = new Map(BLOCS.map((bloc) => [bloc, 0]));
  const incoming = new Map(BLOCS.map((bloc) => [bloc, 0]));
  for (const route of routes) {
    if (route.to !== runnerUp.bloc || !parties.some((party) => party.bloc === route.from)) continue;
    const fromShare = parties.filter((party) => party.bloc === route.from).reduce((sum, party) => sum + party.share, 0);
    const transfer = fromShare * rate / 100;
    outgoing.set(route.from, (outgoing.get(route.from) ?? 0) + transfer);
    incoming.set(route.to, (incoming.get(route.to) ?? 0) + transfer);
  }
  const blocTotals = new Map(BLOCS.map((bloc) => [bloc, parties.filter((party) => party.bloc === bloc).reduce((sum, party) => sum + party.share, 0)]));
  return parties.map((party) => {
    const blocTotal = blocTotals.get(party.bloc) ?? 0;
    const retained = Math.max(0, blocTotal - (outgoing.get(party.bloc) ?? 0)) * (blocTotal > 0 ? party.share / blocTotal : 0);
    return { ...party, share: retained + (party.code === target.code ? incoming.get(party.bloc) ?? 0 : 0) };
  });
}

function applyUupToAllianceTacticalVoting(parties, rate, competitivenessMargin) {
  if (rate <= 0 || competitivenessMargin < 0) return parties;
  const ranked = parties.slice().sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
  const leader = ranked[0];
  const runnerUp = ranked[1];
  if (!leader || !runnerUp || leader.share - runnerUp.share > competitivenessMargin) return parties;
  const topTwoCodes = new Set([leader.code, runnerUp.code]);
  const alliance = parties.find((party) => party.code === "AP");
  const unionistOpponent = [leader, runnerUp].find((party) => party.code !== "AP" && party.bloc === "Unionist");
  const uup = parties.find((party) => party.code === "UUP");
  if (!topTwoCodes.has("AP") || !alliance || !unionistOpponent || !uup) return parties;
  const transfer = uup.share * rate / 100;
  return parties.map((party) => ({
    ...party,
    share: party.code === "UUP" ? Math.max(0, party.share - transfer)
      : party.code === "AP" ? party.share + transfer
        : party.share,
  }));
}

function applyAssemblyTransferPreferenceTacticalVoting(parties, rate, competitivenessMargin, transferProfile) {
  if (rate <= 0 || !transferProfile || parties.length < 3) return parties;
  const ranked = parties.slice().sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
  const leader = ranked[0];
  const runnerUp = ranked[1];
  if (!leader || !runnerUp || leader.bloc === runnerUp.bloc || leader.share - runnerUp.share > competitivenessMargin) return parties;
  const viable = [leader, runnerUp];
  const shareChanges = new Map(parties.map((party) => [party.code, 0]));
  for (const source of parties) {
    if (source.code === leader.code || source.code === runnerUp.code || source.share <= 0) continue;
    const preferences = transferProfile.probabilities.get(source.code);
    if (!preferences) continue;
    const allowedTargets = viable.filter((target) => (
      source.bloc === target.bloc
      || source.bloc === "Non-aligned"
      || target.bloc === "Non-aligned"
    ));
    const totalPreference = allowedTargets.reduce((sum, target) => sum + (preferences.get(target.code) ?? 0), 0);
    if (totalPreference <= 0) continue;
    const transfer = source.share * rate / 100;
    shareChanges.set(source.code, (shareChanges.get(source.code) ?? 0) - transfer);
    for (const target of allowedTargets) {
      const share = transfer * (preferences.get(target.code) ?? 0) / totalPreference;
      shareChanges.set(target.code, (shareChanges.get(target.code) ?? 0) + share);
    }
  }
  return parties.map((party) => ({ ...party, share: Math.max(0, party.share + (shareChanges.get(party.code) ?? 0)) }));
}

function normalizeBlocShares(shares, fallback) {
  const total = BLOCS.reduce((sum, bloc) => sum + Math.max(0, shares.get(bloc) ?? 0), 0);
  const source = total > 0 ? shares : fallback;
  const sourceTotal = BLOCS.reduce((sum, bloc) => sum + Math.max(0, source.get(bloc) ?? 0), 0);
  return new Map(BLOCS.map((bloc) => [bloc, sourceTotal > 0 ? Math.max(0, source.get(bloc) ?? 0) / sourceTotal * 100 : 0]));
}

function projectConstituency(constituency, dataset, parameters) {
  const parties = [...new Set([
    ...dataset.baselineNationalShares.keys(),
    ...dataset.targetNationalShares.keys(),
    ...constituency.candidateCodes,
  ])];
  const supportValues = new Map(parties.map((party) => [
    party,
    Math.round((dataset.targetNationalShares.get(party) ?? dataset.baselineNationalShares.get(party) ?? 0) * 10) / 10,
  ]));
  const supportTotal = [...supportValues.values()].reduce((sum, value) => sum + value, 0);
  const nationalPartyShares = new Map([...supportValues].map(([party, value]) => [party, supportTotal > 0 ? value / supportTotal * 100 : 0]));
  const inputBlocShares = new Map(BLOCS.map((bloc) => [
    bloc,
    [...nationalPartyShares].reduce((sum, [party, share]) => sum + (blocForParty(party) === bloc ? share : 0), 0),
  ]));

  const rawBlocShares = new Map(BLOCS.map((bloc) => {
    if (!constituency.candidateCodes.some((party) => blocForParty(party) === bloc)) return [bloc, 0];
    const baseline = localBlocBaselineShare(constituency, bloc, dataset, parameters.blocHistoryScale);
    const nationalBaseline = blocShares(dataset.baselineNationalShares).get(bloc) ?? 0;
    const swing = localBlocSwingMultiplier(constituency, bloc, dataset, parameters.blocSwingWeight);
    return [bloc, Math.max(0, baseline + ((inputBlocShares.get(bloc) ?? 0) - nationalBaseline) * swing)];
  }));
  const baselineFallback = new Map(BLOCS.map((bloc) => [
    bloc,
    constituency.candidateCodes.some((party) => blocForParty(party) === bloc)
      ? (blocShares(constituency.baselineShares).get(bloc) ?? 0)
      : 0,
  ]));
  let projectedBlocShares = normalizeBlocShares(rawBlocShares, baselineFallback);
  const partyHistory = constituency.candidateCodes.map((code) => {
    const bloc = blocForParty(code);
    const sources = partyRatioSources(code, bloc, constituency, dataset, parameters.partyHistoryScale, parameters.partyCoverageExponent ?? 0, parameters.contestantConditionalRatios ?? false, parameters.candidateContinuityScale ?? 1);
    return { code, bloc, sources, ratio: weightedRatio(sources, dataset.ratioAggregation ?? "arithmetic"), coverage: sources.reduce((sum, source) => sum + source.weight, 0) };
  });
  const partyProfiles = constituency.candidateCodes.map((code) => {
    const bloc = blocForParty(code);
    const baselineShare = dataset.baselineNationalShares.get(code) ?? 0;
    const baselineBloc = blocShares(dataset.baselineNationalShares).get(bloc) ?? 0;
    const latestNationalRatio = baselineBloc > 0 ? baselineShare / baselineBloc * 100 : 0;
    const hasBaselineResult = constituency.baselineShares.has(code);
    const localBloc = blocShares(constituency.baselineShares).get(bloc) ?? 0;
    const observedLocalShare = constituency.baselineShares.get(code) ?? 0;
    const observedLocalRatio = localBloc > 0 ? observedLocalShare / localBloc * 100 : 0;
    const observedLocalNationalRatio = latestNationalRatio > 0 ? observedLocalRatio / latestNationalRatio : 1;
    const history = partyHistory.find((item) => item.code === code);
    const familyPrior = weightedRatio(partyHistory
      .filter((item) => item.bloc === bloc && item.code !== code && item.ratio !== null)
      .map((item) => ({ ratio: item.ratio, weight: item.coverage || 1 })), dataset.ratioAggregation ?? "arithmetic");
    let historicalRatio = history?.ratio ?? null;
    if (historicalRatio !== null) {
      historicalRatio *= localRatioTrendMultiplier(history?.sources ?? [], dataset.targetYear, parameters.localRatioTrendScale ?? 0);
      const coverage = history?.coverage ?? 0;
      const shrinkToNeutral = coverage / (coverage + (parameters.partyRatioPriorStrength ?? 0));
      historicalRatio = Math.exp(Math.log(Math.max(0.01, historicalRatio)) * shrinkToNeutral);
      if (familyPrior !== null && (parameters.partyFamilyShrinkage ?? 0) > 0) {
        const familyWeight = parameters.partyFamilyShrinkage;
        historicalRatio = Math.exp(
          Math.log(Math.max(0.01, historicalRatio)) * (1 - familyWeight)
          + Math.log(Math.max(0.01, familyPrior)) * familyWeight,
        );
      }
    }
    const localPerformanceRatio = historicalRatio ?? (hasBaselineResult ? observedLocalNationalRatio : 1);
    const latestLocalRatio = latestNationalRatio * localPerformanceRatio;
    const historicalSwingRatio = historicalRatio !== null && observedLocalNationalRatio > 0
      ? historicalRatio / observedLocalNationalRatio
      : 1;
    const sensitivity = Math.max(0.25, Math.min(1.75,
      Math.pow(Math.max(0.01, historicalSwingRatio), parameters.partySwingWeight / 100)));
    const inputBloc = inputBlocShares.get(bloc) ?? 0;
    const nationalWithinBloc = inputBloc > 0 ? (nationalPartyShares.get(code) ?? 0) / inputBloc * 100 : 0;
    const nationalMovementRatio = latestNationalRatio > 0
      ? nationalWithinBloc / latestNationalRatio
      : nationalWithinBloc > 0 ? 1 : 0;
    const noHistoryPrior = (parameters.partyFamilyShrinkage ?? 0) > 0 ? familyPrior : null;
    const starting = !hasBaselineResult && latestNationalRatio === 0
      ? nationalWithinBloc * (historicalRatio ?? noHistoryPrior ?? 1)
      : latestLocalRatio;
    const candidate = constituency.candidates.find((item) => item.party === code);
    const incumbentMultiplier = candidate?.incumbent ? Math.exp(parameters.incumbentLogEffect ?? 0) : 1;
    const rawWithinBloc = Math.max(nationalWithinBloc > 0 ? 0.1 : 0, starting * Math.pow(Math.max(0, nationalMovementRatio), sensitivity) * incumbentMultiplier);
    return { code, bloc, rawWithinBloc, incumbent: candidate?.incumbent ?? false };
  });

  const withinBlocTotals = new Map(BLOCS.map((bloc) => [
    bloc,
    partyProfiles.filter((party) => party.bloc === bloc).reduce((sum, party) => sum + party.rawWithinBloc, 0),
  ]));
  let projected;
  if (dataset.partyAllocationMode === "full-local-national-ratio") {
    const directRatios = partyProfiles.map((party) => {
      const sources = fullLocalNationalRatioSources(party.code, constituency, dataset, parameters);
      const ratio = weightedRatio(sources, dataset.ratioAggregation ?? "arithmetic") ?? 1;
      const targetNationalShare = nationalPartyShares.get(party.code) ?? 0;
      return { code: party.code, bloc: party.bloc, share: targetNationalShare * ratio };
    });
    const directTotal = directRatios.reduce((sum, party) => sum + party.share, 0);
    projected = directRatios.map((party) => ({ ...party, share: directTotal > 0 ? party.share / directTotal * 100 : 0 }));
    projectedBlocShares = blocShares(new Map(projected.map((party) => [party.code, party.share])));
  } else {
    projected = partyProfiles.map((party) => {
      const total = withinBlocTotals.get(party.bloc) ?? 0;
      return {
        code: party.code,
        bloc: party.bloc,
        share: (projectedBlocShares.get(party.bloc) ?? 0) * (total > 0 ? party.rawWithinBloc / total : 0),
      };
    });
  }
  const tacticallyAdjusted = applyInterBlocTacticalVoting(
    projected,
    parameters.interBlocTacticalRate ?? 0,
    parameters.tacticalActivationMargin ?? 0,
  );
  const partyTacticallyAdjusted = applyUupToAllianceTacticalVoting(
    tacticallyAdjusted,
    parameters.uupToAllianceRate ?? 0,
    parameters.uupToAllianceActivationMargin ?? 0,
  );
  const assemblyPreferenceAdjusted = applyAssemblyTransferPreferenceTacticalVoting(
    partyTacticallyAdjusted,
    parameters.assemblyTransferTacticalRate ?? 0,
    parameters.assemblyTransferActivationMargin ?? 0,
    dataset.transferProfile,
  );
  projected.splice(0, projected.length, ...assemblyPreferenceAdjusted);
  projected.sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
  const winner = projected[0]?.code ?? "";
  const runnerUp = projected[1]?.code ?? "";
  const winnerShare = projected[0]?.share ?? 0;
  const runnerUpShare = projected[1]?.share ?? 0;
  const actualWinnerShare = constituency.actualShares.get(winner) ?? 0;
  const actualRunnerUpShare = Math.max(0, ...[...constituency.actualShares]
    .filter(([code]) => code !== winner)
    .map(([, share]) => share));
  const actualWinner = [...constituency.actualShares].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
  const actualSeatMargin = actualWinnerShare - actualRunnerUpShare;
  const blocErrors = Object.fromEntries(BLOCS.map((bloc) => [
    bloc,
    (projectedBlocShares.get(bloc) ?? 0) - (blocShares(constituency.actualShares).get(bloc) ?? 0),
  ]));
  const partyErrors = projected.map((party) => ({
    party: party.code,
    forecast: party.share,
    actual: constituency.actualShares.get(party.code) ?? 0,
    error: party.share - (constituency.actualShares.get(party.code) ?? 0),
  }));
  const actualBlocs = blocShares(constituency.actualShares);
  const withinBlocErrors = projected.flatMap((party) => {
    const actualBlocShare = actualBlocs.get(party.bloc) ?? 0;
    const projectedBlocShare = projectedBlocShares.get(party.bloc) ?? 0;
    if (actualBlocShare <= 0 || projectedBlocShare <= 0) return [];
    return [{
      party: party.code,
      error: party.share / projectedBlocShare * 100
        - (constituency.actualShares.get(party.code) ?? 0) / actualBlocShare * 100,
    }];
  });
  return {
    constituency: constituency.name,
    seats: constituency.seats,
    winner,
    runnerUp,
    winnerShare,
    runnerUpShare,
    forecastMargin: winnerShare - runnerUpShare,
    actualWinner,
    actualWinnerShare,
    actualRunnerUpShare,
    actualCallMargin: actualSeatMargin,
    marginError: winnerShare - runnerUpShare - actualSeatMargin,
    correct: winner === actualWinner,
    blocErrors,
    partyErrors,
    withinBlocErrors,
    projectedBlocShares,
  };
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function summarize(dataset, parameters) {
  const rows = dataset.constituencies.map((constituency) => projectConstituency(constituency, dataset, parameters));
  const partyErrors = rows.flatMap((row) => row.partyErrors.map((party) => party.error));
  const withinBlocErrors = rows.flatMap((row) => row.withinBlocErrors);
  const blocErrors = rows.flatMap((row) => BLOCS.map((bloc) => row.blocErrors[bloc]));
  const marginErrors = rows.map((row) => row.marginError);
  const seatCounts = new Map();
  const actualSeatCounts = new Map();
  for (const row of rows) {
    seatCounts.set(row.winner, (seatCounts.get(row.winner) ?? 0) + row.seats);
    actualSeatCounts.set(row.actualWinner, (actualSeatCounts.get(row.actualWinner) ?? 0) + row.seats);
  }
  const allParties = new Set([...seatCounts.keys(), ...actualSeatCounts.keys()]);
  return {
    targetYear: dataset.targetYear,
    baselineYear: dataset.baselineYear,
    rows,
    correctSeats: rows.filter((row) => row.correct).reduce((sum, row) => sum + row.seats, 0),
    totalSeats: rows.reduce((sum, row) => sum + row.seats, 0),
    partyShareMae: mean(partyErrors.map(Math.abs)),
    partyShareBias: mean(partyErrors),
    withinBlocMae: mean(withinBlocErrors.map((item) => Math.abs(item.error))),
    withinBlocByParty: Object.fromEntries([...new Set(withinBlocErrors.map((item) => item.party))].map((party) => {
      const errors = withinBlocErrors.filter((item) => item.party === party).map((item) => item.error);
      return [party, { n: errors.length, mae: mean(errors.map(Math.abs)), bias: mean(errors) }];
    })),
    blocShareMae: mean(blocErrors.map(Math.abs)),
    blocBias: Object.fromEntries(BLOCS.map((bloc) => [bloc, mean(rows.map((row) => row.blocErrors[bloc]))])),
    marginMae: mean(marginErrors.map(Math.abs)),
    marginBias: mean(marginErrors),
    seatCountMae: mean([...allParties].map((party) => Math.abs((seatCounts.get(party) ?? 0) - (actualSeatCounts.get(party) ?? 0)))),
  };
}

function createNormalGenerator(seedText) {
  let state = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    state = Math.imul(state ^ seedText.charCodeAt(index), 16777619);
  }
  let spare = null;
  const uniform = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) + 1) / 4294967297;
  };
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const radius = Math.sqrt(-2 * Math.log(uniform()));
    const angle = 2 * Math.PI * uniform();
    spare = radius * Math.sin(angle);
    return radius * Math.cos(angle);
  };
}

function simulateMeanShares(dataset, parameters, { iterations = 10_000, pollError = 2, localVariation = 2 } = {}) {
  const points = dataset.constituencies.map((constituency) => projectConstituency(constituency, dataset, parameters));
  const pointByName = new Map(points.map((row) => [row.constituency, row]));
  const supportValues = new Map([...dataset.targetNationalShares].map(([party, share]) => [party, Math.round(share * 10) / 10]));
  for (const constituency of dataset.constituencies) {
    for (const party of constituency.candidateCodes) {
      if (!supportValues.has(party)) supportValues.set(party, Math.round((dataset.baselineNationalShares.get(party) ?? 0) * 10) / 10);
    }
  }
  const supportTotal = [...supportValues.values()].reduce((sum, share) => sum + share, 0);
  const nationalPartyShares = new Map([...supportValues].map(([party, share]) => [party, supportTotal > 0 ? share / supportTotal * 100 : 0]));
  const inputBlocShares = new Map(BLOCS.map((bloc) => [bloc, [...nationalPartyShares].reduce(
    (sum, [party, share]) => sum + (blocForParty(party) === bloc ? share : 0), 0,
  )]));
  const wins = new Map(dataset.constituencies.map((constituency) => [constituency.name, new Map(constituency.candidateCodes.map((code) => [code, 0]))]));
  const outcomeCount = new Set(dataset.constituencies.flatMap((constituency) => constituency.candidateCodes)).size;
  const shareSums = new Map(dataset.constituencies.map((constituency) => [constituency.name, new Map(constituency.candidateCodes.map((code) => [code, 0]))]));
  const normal = createNormalGenerator(JSON.stringify({ targetYear: dataset.targetYear, support: Object.fromEntries(supportValues), pollError, localVariation, previousResultWeight: 30 }));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const noisyNationalist = Math.max(0, (inputBlocShares.get("Nationalist") ?? 0) + normal() * pollError);
    const noisyUnionist = Math.max(0, (inputBlocShares.get("Unionist") ?? 0) + normal() * pollError);
    const nationalTotal = noisyNationalist + noisyUnionist + Math.max(0, 100 - noisyNationalist - noisyUnionist);
    const noisyNationalBloc = new Map([
      ["Nationalist", nationalTotal > 0 ? noisyNationalist / nationalTotal * 100 : 0],
      ["Unionist", nationalTotal > 0 ? noisyUnionist / nationalTotal * 100 : 0],
      ["Non-aligned", nationalTotal > 0 ? Math.max(0, 100 - noisyNationalist - noisyUnionist) / nationalTotal * 100 : 0],
    ]);
    for (const constituency of dataset.constituencies) {
      const point = pointByName.get(constituency.name);
      const candidates = constituency.candidateCodes.map((code) => ({ code, bloc: blocForParty(code) }));
      const availableBlocs = new Set(candidates.map(({ bloc }) => bloc));
      const simulatedLocal = new Map();
      for (const bloc of ["Nationalist", "Unionist"]) {
        if (!availableBlocs.has(bloc)) {
          simulatedLocal.set(bloc, 0);
          continue;
        }
        const baselineNationalShare = blocShares(dataset.baselineNationalShares).get(bloc) ?? 0;
        const baseline = localBlocBaselineShare(constituency, bloc, dataset, parameters.blocHistoryScale);
        const swing = localBlocSwingMultiplier(constituency, bloc, dataset, parameters.blocSwingWeight);
        const localBase = baseline + ((inputBlocShares.get(bloc) ?? 0) - baselineNationalShare) * swing;
        simulatedLocal.set(bloc, Math.max(0, localBase
          + ((noisyNationalBloc.get(bloc) ?? 0) - (inputBlocShares.get(bloc) ?? 0)) * swing
          + normal() * localVariation));
      }
      simulatedLocal.set("Non-aligned", availableBlocs.has("Non-aligned")
        ? Math.max(0, 100 - (simulatedLocal.get("Nationalist") ?? 0) - (simulatedLocal.get("Unionist") ?? 0))
        : 0);
      const localTotal = BLOCS.reduce((sum, bloc) => sum + Math.max(0, simulatedLocal.get(bloc) ?? 0), 0);
      for (const bloc of BLOCS) simulatedLocal.set(bloc, localTotal > 0 ? Math.max(0, simulatedLocal.get(bloc) ?? 0) / localTotal * 100 : 0);
      const noisyWithin = candidates.map(({ code, bloc }) => {
        const baseBloc = point?.projectedBlocShares.get(bloc) ?? 0;
        const party = point?.partyErrors.find((item) => item.party === code);
        const baseShare = party?.forecast ?? 0;
        const within = baseBloc > 0 ? baseShare / baseBloc : 0;
        return { code, bloc, noisy: Math.max(0, within * 100 + normal() * localVariation) };
      });
      const blocTotals = new Map(BLOCS.map((bloc) => [bloc, noisyWithin.filter((party) => party.bloc === bloc).reduce((sum, party) => sum + party.noisy, 0)]));
      const votes = noisyWithin.map((party) => {
        const total = blocTotals.get(party.bloc) ?? 0;
        const within = total > 0 ? party.noisy / total : 0;
        return { code: party.code, bloc: party.bloc, share: (simulatedLocal.get(party.bloc) ?? 0) * within };
      });
      const tacticallyAdjustedVotes = applyInterBlocTacticalVoting(
        votes,
        parameters.interBlocTacticalRate ?? 0,
        parameters.tacticalActivationMargin ?? 0,
      );
      const partyTacticallyAdjustedVotes = applyUupToAllianceTacticalVoting(
        tacticallyAdjustedVotes,
        parameters.uupToAllianceRate ?? 0,
        parameters.uupToAllianceActivationMargin ?? 0,
      );
      const assemblyPreferenceAdjustedVotes = applyAssemblyTransferPreferenceTacticalVoting(
        partyTacticallyAdjustedVotes,
        parameters.assemblyTransferTacticalRate ?? 0,
        parameters.assemblyTransferActivationMargin ?? 0,
        dataset.transferProfile,
      );
      assemblyPreferenceAdjustedVotes.sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
      if (assemblyPreferenceAdjustedVotes[0]) wins.get(constituency.name).set(assemblyPreferenceAdjustedVotes[0].code, (wins.get(constituency.name).get(assemblyPreferenceAdjustedVotes[0].code) ?? 0) + 1);
      for (const vote of assemblyPreferenceAdjustedVotes) shareSums.get(constituency.name).set(vote.code, (shareSums.get(constituency.name).get(vote.code) ?? 0) + vote.share);
    }
  }

  const rows = dataset.constituencies.map((constituency) => {
    const point = pointByName.get(constituency.name);
    const winMap = wins.get(constituency.name);
    const winner = [...winMap].sort((a, b) => b[1] - a[1] || Number(b[0] === point?.winner) - Number(a[0] === point?.winner) || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
    const means = [...shareSums.get(constituency.name)].map(([party, total]) => [party, total / iterations]);
    const winnerMean = means.find(([party]) => party === winner)?.[1] ?? 0;
    const runnerUpMean = Math.max(0, ...means.filter(([party]) => party !== winner).map(([, share]) => share));
    const actualWinnerShare = constituency.actualShares.get(winner) ?? 0;
    const actualRunnerUpShare = Math.max(0, ...[...constituency.actualShares].filter(([party]) => party !== winner).map(([, share]) => share));
    return {
      constituency: constituency.name,
      winner,
      winProbability: ((winMap.get(winner) ?? 0) + 1) / (iterations + outcomeCount) * 100,
      meanMargin: winnerMean - runnerUpMean,
      actualWinner: constituency.actualWinner,
      actualCallMargin: actualWinnerShare - actualRunnerUpShare,
      marginError: winnerMean - runnerUpMean - (actualWinnerShare - actualRunnerUpShare),
      correct: winner === constituency.actualWinner,
      partyMeans: Object.fromEntries(means),
    };
  });
  const partyErrors = rows.flatMap((row) => Object.entries(row.partyMeans).map(([party, share]) => share - (dataset.constituencies.find((constituency) => constituency.name === row.constituency)?.actualShares.get(party) ?? 0)));
  return {
    targetYear: dataset.targetYear,
    iterations,
    pollError,
    localVariation,
    rows,
    correctSeats: rows.filter((row) => row.correct).length,
    totalSeats: rows.length,
    partyShareMae: mean(partyErrors.map(Math.abs)),
    marginMae: mean(rows.map((row) => Math.abs(row.marginError))),
    marginBias: mean(rows.map((row) => row.marginError)),
  };
}

function calibrationKey(parameters, type) {
  return type === "bloc"
    ? { blocHistoryScale: parameters.blocHistoryScale, blocSwingWeight: parameters.blocSwingWeight }
    : { partyHistoryScale: parameters.partyHistoryScale, partySwingWeight: parameters.partySwingWeight };
}

function distanceFromDefault(candidate, type) {
  if (type === "bloc") return Math.abs(candidate.blocHistoryScale - 1) + Math.abs(candidate.blocSwingWeight - 30) / 30;
  return Math.abs(candidate.partyHistoryScale - 1) + Math.abs(candidate.partySwingWeight - 30) / 30;
}

function chooseCalibration(datasets, initialParameters, type) {
  let best = null;
  for (const historyScale of HISTORY_SCALES) {
    for (const swingWeight of SWING_WEIGHTS) {
      const candidate = type === "bloc"
        ? { ...initialParameters, blocHistoryScale: historyScale, blocSwingWeight: swingWeight }
        : { ...initialParameters, partyHistoryScale: historyScale, partySwingWeight: swingWeight };
      const summaries = datasets.map((dataset) => summarize(dataset, candidate));
      const score = mean(summaries.map((summary) => type === "bloc" ? summary.blocShareMae : summary.partyShareMae));
      const result = { parameters: candidate, score, distance: distanceFromDefault(candidate, type) };
      if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
    }
  }
  return best;
}

function chooseIncumbentEffect(datasets, initialParameters) {
  let best = null;
  for (const incumbentLogEffect of INCUMBENT_LOG_EFFECTS) {
    const parameters = { ...initialParameters, incumbentLogEffect };
    const summaries = datasets.map((dataset) => summarize(dataset, parameters));
    const score = mean(summaries.map((summary) => summary.partyShareMae));
    const result = { parameters, score, distance: Math.abs(incumbentLogEffect) };
    if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
  }
  return best;
}

function chooseMarginCalibration(datasets, initialParameters) {
  let best = null;
  for (const blocHistoryScale of HISTORY_SCALES) {
    for (const blocSwingWeight of SWING_WEIGHTS) {
      for (const partyHistoryScale of HISTORY_SCALES) {
        for (const partySwingWeight of SWING_WEIGHTS) {
          const parameters = { blocHistoryScale, blocSwingWeight, partyHistoryScale, partySwingWeight };
          const summaries = datasets.map((dataset) => summarize(dataset, parameters));
          const score = mean(summaries.map((summary) => summary.marginMae));
          const distance = Math.abs(blocHistoryScale - DEFAULT_PARAMETERS.blocHistoryScale)
            + Math.abs(blocSwingWeight - DEFAULT_PARAMETERS.blocSwingWeight) / 30
            + Math.abs(partyHistoryScale - DEFAULT_PARAMETERS.partyHistoryScale)
            + Math.abs(partySwingWeight - DEFAULT_PARAMETERS.partySwingWeight) / 30;
          const result = { parameters, score, distance };
          if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
        }
      }
    }
  }
  return best;
}

function choosePartyRatioPooling(datasets, initialParameters) {
  let best = null;
  for (const partyRatioPriorStrength of PARTY_RATIO_PRIOR_STRENGTHS) {
    for (const partyFamilyShrinkage of PARTY_FAMILY_SHRINKAGES) {
      for (const partyCoverageExponent of PARTY_COVERAGE_EXPONENTS) {
        const parameters = { ...initialParameters, partyRatioPriorStrength, partyFamilyShrinkage, partyCoverageExponent };
        const summaries = datasets.map((dataset) => summarize(dataset, parameters));
        const score = mean(summaries.map((summary) => summary.withinBlocMae));
        const distance = partyRatioPriorStrength + partyFamilyShrinkage + partyCoverageExponent;
        const result = { parameters, score, distance };
        if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
      }
    }
  }
  return best;
}

function chooseContestantConditionalRatios(datasets, initialParameters) {
  let best = null;
  for (const historyScale of HISTORY_SCALES) {
    for (const swingWeight of SWING_WEIGHTS) {
      const parameters = {
        ...initialParameters,
        partyHistoryScale: historyScale,
        partySwingWeight: swingWeight,
        contestantConditionalRatios: true,
        partyRatioPriorStrength: 0,
        partyFamilyShrinkage: 0,
        partyCoverageExponent: 0,
      };
      const summaries = datasets.map((dataset) => summarize(dataset, parameters));
      const score = mean(summaries.map((summary) => summary.withinBlocMae));
      const distance = Math.abs(historyScale - 1) + Math.abs(swingWeight - 30) / 30;
      const result = { parameters, score, distance };
      if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
    }
  }
  return best;
}

function chooseCandidateContinuity(datasets, initialParameters) {
  let best = null;
  for (const candidateContinuityScale of CANDIDATE_CONTINUITY_SCALES) {
    const parameters = { ...initialParameters, candidateContinuityScale };
    const summaries = datasets.map((dataset) => summarize(dataset, parameters));
    const score = mean(summaries.map((summary) => summary.withinBlocMae));
    const result = { parameters, score, distance: Math.abs(candidateContinuityScale - 1) };
    if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
  }
  return best;
}

function chooseLocalRatioTrend(datasets, initialParameters) {
  let best = null;
  for (const localRatioTrendScale of [0, 0.25, 0.5, 0.75, 1, 1.5, 2]) {
    const parameters = { ...initialParameters, localRatioTrendScale };
    const summaries = datasets.map((dataset) => summarize(dataset, parameters));
    const score = mean(summaries.map((summary) => summary.marginMae));
    const distance = Math.abs(localRatioTrendScale);
    const result = { parameters, score, distance };
    if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
  }
  return best;
}

function chooseTargetedTacticalVoting(datasets, initialParameters) {
  let best = null;
  for (const interBlocTacticalRate of [0, 5, 10, 15, 20, 25]) {
    for (const tacticalActivationMargin of [4, 8, 12, 16, 20]) {
      const parameters = { ...initialParameters, interBlocTacticalRate, tacticalActivationMargin };
      const summaries = datasets.map((dataset) => summarize(dataset, parameters));
      const score = mean(summaries.map((summary) => summary.marginMae));
      const distance = interBlocTacticalRate / 10 + tacticalActivationMargin / 20;
      const result = { parameters, score, distance };
      if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
    }
  }
  return best;
}

function chooseUupToAllianceTacticalVoting(datasets, initialParameters) {
  let best = null;
  for (const uupToAllianceRate of [0, 5, 10, 15, 20, 25, 30, 40, 50]) {
    for (const uupToAllianceActivationMargin of [4, 8, 12, 16, 20]) {
      const parameters = { ...initialParameters, uupToAllianceRate, uupToAllianceActivationMargin };
      const summaries = datasets.map((dataset) => summarize(dataset, parameters));
      const score = mean(summaries.map((summary) => summary.marginMae));
      const distance = uupToAllianceRate / 10 + uupToAllianceActivationMargin / 20;
      const result = { parameters, score, distance };
      if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
    }
  }
  return best;
}

function chooseAssemblyTransferTacticalVoting(datasets, initialParameters) {
  let best = null;
  for (const assemblyTransferTacticalRate of [0, 2.5, 5, 7.5, 10, 15, 20, 30]) {
    for (const assemblyTransferActivationMargin of [4, 8, 12, 16, 20]) {
      const parameters = { ...initialParameters, assemblyTransferTacticalRate, assemblyTransferActivationMargin };
      const score = mean(datasets.map((dataset) => summarize(dataset, parameters).marginMae));
      const distance = assemblyTransferTacticalRate / 10 + assemblyTransferActivationMargin / 20;
      const result = { parameters, score, distance };
      if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
    }
  }
  return best;
}

function crossValidateAssemblyTransferTacticalVoting(datasets, initialParameters) {
  return datasets.map((heldOut) => {
    const fit = datasets.filter((dataset) => dataset.targetYear !== heldOut.targetYear);
    const selected = chooseAssemblyTransferTacticalVoting(fit, initialParameters);
    const baseline = summarize(heldOut, initialParameters);
    const adjusted = summarize(heldOut, selected.parameters);
    return { targetYear: heldOut.targetYear, selected, baseline, adjusted };
  });
}

function applyHistorySourceWeights(dataset, westminsterScale, assemblyScale) {
  return {
    ...dataset,
    sources: dataset.sources.map((source) => ({
      ...source,
      weight: source.weight * (source.type === "Westminster" ? westminsterScale : assemblyScale),
    })),
  };
}

function chooseHistorySourceWeights(datasets, initialParameters) {
  let best = null;
  const scales = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
  for (const westminsterHistoryScale of scales) {
    for (const assemblyHistoryScale of scales) {
      const scaled = datasets.map((dataset) => applyHistorySourceWeights(dataset, westminsterHistoryScale, assemblyHistoryScale));
      const score = mean(scaled.map((dataset) => summarize(dataset, initialParameters).marginMae));
      const distance = Math.abs(westminsterHistoryScale - 1) + Math.abs(assemblyHistoryScale - 1);
      const result = { parameters: { ...initialParameters, westminsterHistoryScale, assemblyHistoryScale }, score, distance };
      if (!best || result.score < best.score - 1e-9 || (Math.abs(result.score - best.score) <= 1e-9 && result.distance < best.distance)) best = result;
    }
  }
  return best;
}

function csvCell(value) {
  const string = String(value ?? "");
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function buildConstituencyCsv(defaultSummaries, calibratedSummaries, candidateSummaries, marginSummaries, ratioPoolingSummaries, contestantRatioSummaries, continuitySummaries, simulationSummary) {
  const lines = [
    ["target_year", "run", "constituency", "forecast_winner", "forecast_winner_share", "forecast_runner_up", "forecast_runner_up_share", "actual_winner", "actual_winner_share", "actual_runner_up_share_for_call", "forecast_margin", "actual_margin_for_call", "margin_error", "correct", "nationalist_error", "unionist_error", "non_aligned_error", "party_share_mae"].join(","),
  ];
  for (const [label, summaries] of [["default", defaultSummaries], ["calibrated", calibratedSummaries], ["candidate-aware", candidateSummaries], ["margin-calibrated", marginSummaries], ["party-ratio-pooled", ratioPoolingSummaries], ["contestant-national-ratio", contestantRatioSummaries], ["candidate-continuity", continuitySummaries]]) {
    for (const summary of summaries) {
      for (const row of summary.rows) {
        lines.push([
          summary.targetYear, label, row.constituency, row.winner, row.winnerShare.toFixed(3), row.runnerUp,
          row.runnerUpShare.toFixed(3), row.actualWinner, row.actualWinnerShare.toFixed(3),
          row.actualRunnerUpShare.toFixed(3), row.forecastMargin.toFixed(3), row.actualCallMargin.toFixed(3),
          row.marginError.toFixed(3), row.correct, row.blocErrors.Nationalist.toFixed(3),
          row.blocErrors.Unionist.toFixed(3), row.blocErrors["Non-aligned"].toFixed(3),
          mean(row.partyErrors.map((party) => Math.abs(party.error))).toFixed(3),
        ].map(csvCell).join(","));
      }
    }
  }
  for (const row of simulationSummary.rows) {
    const actualCallMargin = row.actualCallMargin;
    lines.push([
      simulationSummary.targetYear, "simulation-mean-10k", row.constituency, row.winner,
      row.partyMeans[row.winner]?.toFixed(3) ?? "0.000", "", "", row.actualWinner,
      "", "", row.meanMargin.toFixed(3), actualCallMargin.toFixed(3), row.marginError.toFixed(3), row.correct,
      "", "", "", "",
    ].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function metricsTable(defaultSummary, calibratedSummary) {
  const format = (value) => value.toFixed(2);
  const rows = [
    ["Point-estimate winner calls", `${defaultSummary.correctSeats}/${defaultSummary.totalSeats}`, `${calibratedSummary.correctSeats}/${calibratedSummary.totalSeats}`],
    ["Party vote-share MAE (pp)", format(defaultSummary.partyShareMae), format(calibratedSummary.partyShareMae)],
    ["Party share within bloc MAE (pp)", format(defaultSummary.withinBlocMae), format(calibratedSummary.withinBlocMae)],
    ["Party vote-share signed bias (pp)", format(defaultSummary.partyShareBias), format(calibratedSummary.partyShareBias)],
    ["Bloc-share MAE (pp)", format(defaultSummary.blocShareMae), format(calibratedSummary.blocShareMae)],
    ["Nationalist bloc bias (pp)", format(defaultSummary.blocBias.Nationalist), format(calibratedSummary.blocBias.Nationalist)],
    ["Unionist bloc bias (pp)", format(defaultSummary.blocBias.Unionist), format(calibratedSummary.blocBias.Unionist)],
    ["Non-aligned bloc bias (pp)", format(defaultSummary.blocBias["Non-aligned"]), format(calibratedSummary.blocBias["Non-aligned"])],
    ["Called-winner margin MAE (pp)", format(defaultSummary.marginMae), format(calibratedSummary.marginMae)],
    ["Called-winner margin signed bias (pp)", format(defaultSummary.marginBias), format(calibratedSummary.marginBias)],
    ["Party seat-count MAE", format(defaultSummary.seatCountMae), format(calibratedSummary.seatCountMae)],
  ];
  return ["| Metric | Default weights | Calibrated weights |", "| --- | ---: | ---: |", ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
}

const datasets = TARGET_YEARS.map(loadElection);
const training = datasets.filter((dataset) => TRAINING_YEARS.includes(dataset.targetYear));
const validation = datasets.filter((dataset) => dataset.targetYear === "2024");
if (training.length !== TRAINING_YEARS.length || validation.length !== 1) {
  throw new Error("Expected 2015, 2017, 2019 training data and one 2024 validation set.");
}
const validationDataset = validation[0];

const blocCalibration = chooseCalibration(training, DEFAULT_PARAMETERS, "bloc");
const partyCalibration = chooseCalibration(training, blocCalibration.parameters, "party");
const incumbentCalibration = chooseIncumbentEffect(training, partyCalibration.parameters);
const marginCalibration = chooseMarginCalibration(training, DEFAULT_PARAMETERS);
const partyRatioPooling = choosePartyRatioPooling(training, partyCalibration.parameters);
const contestantRatioCalibration = chooseContestantConditionalRatios(training, blocCalibration.parameters);
const candidateContinuityCalibration = chooseCandidateContinuity(training, {
  ...partyCalibration.parameters,
  partyRatioPriorStrength: 0,
  partyFamilyShrinkage: 0,
  partyCoverageExponent: 0.5,
});
const calibratedParameters = partyCalibration.parameters;
const candidateAwareParameters = incumbentCalibration.parameters;
const marginCalibratedParameters = marginCalibration.parameters;
const partyRatioPooledParameters = partyRatioPooling.parameters;
const contestantRatioParameters = contestantRatioCalibration.parameters;
const candidateContinuityParameters = candidateContinuityCalibration.parameters;
const liveBacktestParameters = { ...DEFAULT_PARAMETERS, partyRatioPriorStrength: 0, partyFamilyShrinkage: 0, partyCoverageExponent: 0.5 };
const fullRatioDatasets = datasets.map((dataset) => ({ ...dataset, partyAllocationMode: "full-local-national-ratio" }));
const fullRatioSummaries = fullRatioDatasets.map((dataset) => summarize(dataset, liveBacktestParameters));
const currentRatioSummaries = datasets.map((dataset) => summarize(dataset, liveBacktestParameters));
const fullRatioValidation = fullRatioSummaries.find((summary) => summary.targetYear === "2024");
const currentRatioValidation = currentRatioSummaries.find((summary) => summary.targetYear === "2024");
const fullRatioTrainingSummaries = fullRatioSummaries.filter((summary) => TRAINING_YEARS.includes(summary.targetYear));
const currentRatioTrainingSummaries = currentRatioSummaries.filter((summary) => TRAINING_YEARS.includes(summary.targetYear));
const laganCurrentRatio = currentRatioValidation.rows.find((row) => row.constituency === "Lagan Valley");
const laganFullRatio = fullRatioValidation.rows.find((row) => row.constituency === "Lagan Valley");
const laganActualResult = validationDataset.constituencies.find((constituency) => constituency.name === "Lagan Valley");
const laganActualRanked = [...(laganActualResult?.actualShares ?? new Map())].sort((a, b) => b[1] - a[1]);
const laganActualMargin = (laganActualRanked[0]?.[1] ?? 0) - (laganActualRanked[1]?.[1] ?? 0);
const defaultSummaries = datasets.map((dataset) => summarize(dataset, DEFAULT_PARAMETERS));
const calibratedSummaries = datasets.map((dataset) => summarize(dataset, calibratedParameters));
const geometricDatasets = datasets.map((dataset) => ({ ...dataset, ratioAggregation: "geometric" }));
const geometricSummaries = geometricDatasets.map((dataset) => summarize(dataset, liveBacktestParameters));
const geometricValidation = geometricSummaries.find((summary) => summary.targetYear === "2024");
const geometricSimulationValidation = simulateMeanShares(geometricDatasets.find((dataset) => dataset.targetYear === "2024"), liveBacktestParameters);
const candidateAwareSummaries = datasets.map((dataset) => summarize(dataset, candidateAwareParameters));
const marginCalibratedSummaries = datasets.map((dataset) => summarize(dataset, marginCalibratedParameters));
const partyRatioPooledSummaries = datasets.map((dataset) => summarize(dataset, partyRatioPooledParameters));
const contestantRatioSummaries = datasets.map((dataset) => summarize(dataset, contestantRatioParameters));
const candidateContinuitySummaries = datasets.map((dataset) => summarize(dataset, candidateContinuityParameters));
const simulationSummaries = datasets.map((dataset) => simulateMeanShares(dataset, liveBacktestParameters));
const simulationValidation = simulationSummaries.find((summary) => summary.targetYear === "2024");
const localRatioTrendCalibration = chooseLocalRatioTrend(training, liveBacktestParameters);
const localRatioTrendParameters = localRatioTrendCalibration.parameters;
const localRatioTrendValidation = simulateMeanShares(validationDataset, localRatioTrendParameters);
const tacticalCalibration = chooseTargetedTacticalVoting(training, liveBacktestParameters);
const tacticalParameters = tacticalCalibration.parameters;
const tacticalValidation = simulateMeanShares(validationDataset, tacticalParameters);
const uupToAllianceCalibration = chooseUupToAllianceTacticalVoting(training, liveBacktestParameters);
const uupToAllianceParameters = uupToAllianceCalibration.parameters;
const uupToAllianceValidation = simulateMeanShares(validationDataset, uupToAllianceParameters);
const assemblyTransferCalibration = chooseAssemblyTransferTacticalVoting(training, liveBacktestParameters);
const assemblyTransferParameters = assemblyTransferCalibration.parameters;
const assemblyTransferValidation = simulateMeanShares(validationDataset, assemblyTransferParameters);
const assemblyTransferCrossValidation = crossValidateAssemblyTransferTacticalVoting(training, liveBacktestParameters);
const historyWeightCalibration = chooseHistorySourceWeights(training, liveBacktestParameters);
const historyWeightParameters = historyWeightCalibration.parameters;
const historyWeightedValidationDataset = applyHistorySourceWeights(validationDataset, historyWeightParameters.westminsterHistoryScale, historyWeightParameters.assemblyHistoryScale);
const historyWeightedValidation = simulateMeanShares(historyWeightedValidationDataset, liveBacktestParameters);
const localRatioTrendTrainingMarginMae = mean(training.map((dataset) => summarize(dataset, localRatioTrendParameters).marginMae));
const tacticalTrainingMarginMae = mean(training.map((dataset) => summarize(dataset, tacticalParameters).marginMae));
const uupToAllianceTrainingMarginMae = uupToAllianceCalibration.score;
const assemblyTransferTrainingMarginMae = assemblyTransferCalibration.score;
const historyWeightTrainingMarginMae = historyWeightCalibration.score;
const boundarySensitivityScenarios = [
  { label: "All historic local results", keep: () => true },
  { label: "2019 baseline only", keep: () => false },
  { label: "2019 baseline + 2022 Assembly", keep: (source) => source.type === "Assembly" && source.year === "2022" },
  { label: "2019 baseline + Westminster history", keep: (source) => source.type === "Westminster" },
  { label: "2019 baseline + Assembly history", keep: (source) => source.type === "Assembly" },
].map(({ label, keep }) => {
  const scenarioDataset = { ...validationDataset, sources: validationDataset.sources.filter(keep) };
  const deterministic = summarize(scenarioDataset, liveBacktestParameters);
  const simulated = simulateMeanShares(scenarioDataset, liveBacktestParameters);
  return { label, sourceYears: scenarioDataset.sources.map((source) => `${source.year} ${source.type}`), deterministic, simulated };
});
const nationalOnlyBoundaryDataset = {
  ...validationDataset,
  constituencies: validationDataset.constituencies.map((constituency) => ({
    ...constituency,
    baselineShares: validationDataset.baselineNationalShares,
  })),
  sources: validationDataset.sources.map((source) => ({
    ...source,
    localShares: new Map(validationDataset.constituencies.map((constituency) => [constituency.name, source.nationalShareMap])),
  })),
};
boundarySensitivityScenarios.push({
  label: "No constituency-level results (national-only priors)",
  sourceYears: [],
  deterministic: summarize(nationalOnlyBoundaryDataset, liveBacktestParameters),
  simulated: simulateMeanShares(nationalOnlyBoundaryDataset, liveBacktestParameters),
});
const fullHistoryBoundaryScenario = boundarySensitivityScenarios[0];
const marginAuditSeats = ["Lagan Valley", "South Antrim", "East Derry", "Upper Bann", "East Antrim"];
const sourceAblationRows = validationDataset.sources.flatMap((source) => {
  const scenarioDataset = { ...validationDataset, sources: validationDataset.sources.filter((candidate) => candidate !== source) };
  const result = simulateMeanShares(scenarioDataset, liveBacktestParameters);
  return marginAuditSeats.flatMap((name) => {
    const full = simulationValidation.rows.find((row) => row.constituency === name);
    const without = result.rows.find((row) => row.constituency === name);
    if (!full || !without) return [];
    return [{
      source: `${source.year} ${source.type}`,
      constituency: name,
      fullWinner: full.winner,
      fullMargin: full.meanMargin,
      withoutWinner: without.winner,
      withoutMargin: without.meanMargin,
      marginChange: without.meanMargin - full.meanMargin,
      fullMarginError: full.marginError,
      withoutMarginError: without.marginError,
      absErrorChange: Math.abs(without.marginError) - Math.abs(full.marginError),
    }];
  });
});
const coverageSensitivity = PARTY_COVERAGE_EXPONENTS.map((partyCoverageExponent) => {
  const parameters = { ...partyCalibration.parameters, partyRatioPriorStrength: 0, partyFamilyShrinkage: 0, partyCoverageExponent };
  const trainingSummaries = training.map((dataset) => summarize(dataset, parameters));
  const validationSummary = summarize(validation[0], parameters);
  const northAntrim = validationSummary.rows.find((row) => row.constituency === "North Antrim");
  return {
    partyCoverageExponent,
    trainingWithinBlocMae: mean(trainingSummaries.map((summary) => summary.withinBlocMae)),
    validationSummary,
    northAntrimWinner: northAntrim?.winner ?? "",
  };
});
const coverageCrossValidation = training.map((heldOut) => {
  const fitYears = training.filter((dataset) => dataset.targetYear !== heldOut.targetYear);
  const candidates = PARTY_COVERAGE_EXPONENTS.map((partyCoverageExponent) => {
    const parameters = { ...DEFAULT_PARAMETERS, partyRatioPriorStrength: 0, partyFamilyShrinkage: 0, partyCoverageExponent };
    const score = mean(fitYears.map((dataset) => summarize(dataset, parameters).withinBlocMae));
    return { partyCoverageExponent, parameters, score };
  }).sort((a, b) => a.score - b.score || a.partyCoverageExponent - b.partyCoverageExponent);
  const selected = candidates[0];
  const baseline = summarize(heldOut, { ...DEFAULT_PARAMETERS, partyCoverageExponent: 0 });
  const adjusted = summarize(heldOut, selected.parameters);
  return { targetYear: heldOut.targetYear, selectedExponent: selected.partyCoverageExponent, baseline, adjusted };
});
const fixedHalfCoverageCrossValidation = training.map((heldOut) => {
  const base = { ...DEFAULT_PARAMETERS, partyRatioPriorStrength: 0, partyFamilyShrinkage: 0 };
  return {
    targetYear: heldOut.targetYear,
    baseline: summarize(heldOut, { ...base, partyCoverageExponent: 0 }),
    adjusted: summarize(heldOut, { ...base, partyCoverageExponent: 0.5 }),
  };
});
const liveDefaultCoverageValidation = PARTY_COVERAGE_EXPONENTS.map((partyCoverageExponent) => ({
  partyCoverageExponent,
  summary: summarize(validation[0], { ...DEFAULT_PARAMETERS, partyRatioPriorStrength: 0, partyFamilyShrinkage: 0, partyCoverageExponent }),
}));
const liveCoverageZero = liveDefaultCoverageValidation.find((entry) => entry.partyCoverageExponent === 0).summary;
const liveCoverageHalf = liveDefaultCoverageValidation.find((entry) => entry.partyCoverageExponent === 0.5).summary;
const liveCoverageSeatChanges = liveCoverageHalf.rows.map((adjusted) => {
  const baseline = liveCoverageZero.rows.find((row) => row.constituency === adjusted.constituency);
  return {
    constituency: adjusted.constituency,
    winnerChanged: adjusted.winner !== baseline.winner,
    baselineWinner: baseline.winner,
    adjustedWinner: adjusted.winner,
    baselineMargin: baseline.forecastMargin,
    adjustedMargin: adjusted.forecastMargin,
    marginChange: adjusted.forecastMargin - baseline.forecastMargin,
  };
});
const defaultValidation = defaultSummaries.find((summary) => summary.targetYear === "2024");
const calibratedValidation = calibratedSummaries.find((summary) => summary.targetYear === "2024");
const candidateAwareValidation = candidateAwareSummaries.find((summary) => summary.targetYear === "2024");
const marginCalibratedValidation = marginCalibratedSummaries.find((summary) => summary.targetYear === "2024");
const partyRatioPooledValidation = partyRatioPooledSummaries.find((summary) => summary.targetYear === "2024");
const contestantRatioValidation = contestantRatioSummaries.find((summary) => summary.targetYear === "2024");
const candidateContinuityValidation = candidateContinuitySummaries.find((summary) => summary.targetYear === "2024");

fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_ROOT, "constituency-errors.csv"), buildConstituencyCsv(defaultSummaries, calibratedSummaries, candidateAwareSummaries, marginCalibratedSummaries, partyRatioPooledSummaries, contestantRatioSummaries, candidateContinuitySummaries, simulationValidation), "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "2024-simulation-mean-shares.csv"), [
  ["constituency", "simulation_winner", "win_probability_pct", "mean_vote_share_margin_pp", "actual_winner", "actual_margin_for_called_winner_pp", "margin_error_pp", "correct_call", "party_mean_shares_json"].join(","),
  ...simulationValidation.rows.map((row) => [row.constituency, row.winner, row.winProbability.toFixed(2), row.meanMargin.toFixed(3), row.actualWinner, row.actualCallMargin.toFixed(3), row.marginError.toFixed(3), row.correct, JSON.stringify(row.partyMeans)].map(csvCell).join(",")),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "2024-ratio-aggregation-comparison.csv"), [
  ["constituency", "arithmetic_winner", "arithmetic_mean_margin_pp", "arithmetic_margin_error_pp", "geometric_winner", "geometric_mean_margin_pp", "geometric_margin_error_pp", "actual_winner", "actual_margin_for_call_pp"].join(","),
  ...geometricSimulationValidation.rows.map((row) => {
    const arithmetic = simulationValidation.rows.find((item) => item.constituency === row.constituency);
    return [row.constituency, arithmetic.winner, arithmetic.meanMargin.toFixed(3), arithmetic.marginError.toFixed(3), row.winner, row.meanMargin.toFixed(3), row.marginError.toFixed(3), row.actualWinner, row.actualCallMargin.toFixed(3)].map(csvCell).join(",");
  }),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "2024-swing-tactical-comparison.csv"), [
  ["constituency", "baseline_winner", "baseline_mean_margin_pp", "baseline_margin_error_pp", "local_trend_winner", "local_trend_mean_margin_pp", "local_trend_margin_error_pp", "tactical_winner", "tactical_mean_margin_pp", "tactical_margin_error_pp", "actual_winner"].join(","),
  ...simulationValidation.rows.map((row) => {
    const trend = localRatioTrendValidation.rows.find((item) => item.constituency === row.constituency);
    const tactical = tacticalValidation.rows.find((item) => item.constituency === row.constituency);
    return [row.constituency, row.winner, row.meanMargin.toFixed(3), row.marginError.toFixed(3), trend.winner, trend.meanMargin.toFixed(3), trend.marginError.toFixed(3), tactical.winner, tactical.meanMargin.toFixed(3), tactical.marginError.toFixed(3), row.actualWinner].map(csvCell).join(",");
  }),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "2024-uup-alliance-tactical-comparison.csv"), [
  ["constituency", "baseline_winner", "baseline_margin_pp", "baseline_margin_error_pp", "uup_to_alliance_winner", "uup_to_alliance_win_probability_pct", "uup_to_alliance_margin_pp", "uup_to_alliance_margin_error_pp", "actual_winner", "party_mean_shares_json"].join(","),
  ...simulationValidation.rows.map((row) => {
    const targeted = uupToAllianceValidation.rows.find((item) => item.constituency === row.constituency);
    return [row.constituency, row.winner, row.meanMargin.toFixed(3), row.marginError.toFixed(3), targeted.winner, targeted.winProbability.toFixed(2), targeted.meanMargin.toFixed(3), targeted.marginError.toFixed(3), row.actualWinner, JSON.stringify(targeted.partyMeans)].map(csvCell).join(",");
  }),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "assembly-transfer-matrix.csv"), [
  ["source_year", "source_party", "destination_party", "estimated_transfer_votes", "share_of_observed_source_party_transfers", "usable_single_source_events", "diagnostic_transitions", "ambiguous_transitions", "invalid_events", "observed_transfer_retention"].join(","),
  ...[...validationDataset.transferProfile.flowVotes].flatMap(([source, destinations]) => {
    const total = [...destinations.values()].reduce((sum, votes) => sum + votes, 0);
    return [...destinations].map(([destination, votes]) => [
      validationDataset.transferProfile.years.join("+"), source, destination, votes,
      total > 0 ? (votes / total * 100).toFixed(2) : "0.00",
      validationDataset.transferProfile.sourceEvents.get(source) ?? 0,
      validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.transitions, 0),
      validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.ambiguousTransitions, 0),
      validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.invalidEvents, 0),
      validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.observedTransferVotes, 0) / Math.max(1, validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.sourceVotePool, 0)),
    ].map(csvCell).join(","));
  }),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "assembly-transfer-cross-validation.csv"), [
  ["held_out_westminster_year", "fitted_effective_transfer_rate_pct", "fitted_activation_margin_pp", "baseline_margin_mae_pp", "adjusted_margin_mae_pp", "margin_mae_change_pp", "baseline_correct_calls", "adjusted_correct_calls"].join(","),
  ...assemblyTransferCrossValidation.map((row) => [row.targetYear, row.selected.parameters.assemblyTransferTacticalRate, row.selected.parameters.assemblyTransferActivationMargin, row.baseline.marginMae.toFixed(3), row.adjusted.marginMae.toFixed(3), (row.adjusted.marginMae - row.baseline.marginMae).toFixed(3), `${row.baseline.correctSeats}/${row.baseline.totalSeats}`, `${row.adjusted.correctSeats}/${row.adjusted.totalSeats}`].map(csvCell).join(",")),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "2024-assembly-transfer-tactical-comparison.csv"), [
  ["constituency", "baseline_winner", "baseline_mean_margin_pp", "baseline_margin_error_pp", "assembly_preference_winner", "assembly_preference_win_probability_pct", "assembly_preference_mean_margin_pp", "assembly_preference_margin_error_pp", "actual_winner", "party_mean_shares_json"].join(","),
  ...simulationValidation.rows.map((row) => {
    const preference = assemblyTransferValidation.rows.find((item) => item.constituency === row.constituency);
    return [row.constituency, row.winner, row.meanMargin.toFixed(3), row.marginError.toFixed(3), preference.winner, preference.winProbability.toFixed(2), preference.meanMargin.toFixed(3), preference.marginError.toFixed(3), row.actualWinner, JSON.stringify(preference.partyMeans)].map(csvCell).join(",");
  }),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "2024-history-weight-comparison.csv"), [
  ["constituency", "baseline_winner", "baseline_mean_margin_pp", "baseline_margin_error_pp", "weighted_winner", "weighted_mean_margin_pp", "weighted_margin_error_pp", "actual_winner"].join(","),
  ...simulationValidation.rows.map((row) => {
    const weighted = historyWeightedValidation.rows.find((item) => item.constituency === row.constituency);
    return [row.constituency, row.winner, row.meanMargin.toFixed(3), row.marginError.toFixed(3), weighted.winner, weighted.meanMargin.toFixed(3), weighted.marginError.toFixed(3), row.actualWinner].map(csvCell).join(",");
  }),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "2024-full-local-national-ratio-comparison.csv"), [
  ["constituency", "current_winner", "current_margin_pp", "current_party_shares_json", "full_ratio_winner", "full_ratio_margin_pp", "full_ratio_party_shares_json", "actual_winner"].join(","),
  ...currentRatioValidation.rows.map((row) => {
    const fullRatio = fullRatioValidation.rows.find((item) => item.constituency === row.constituency);
    const shareJson = (summaryRow) => Object.fromEntries(summaryRow.partyErrors.map((party) => [party.party, Number(party.forecast.toFixed(3))]));
    return [row.constituency, row.winner, row.forecastMargin.toFixed(3), JSON.stringify(shareJson(row)), fullRatio.winner, fullRatio.forecastMargin.toFixed(3), JSON.stringify(shareJson(fullRatio)), row.actualWinner].map(csvCell).join(",");
  }),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "2024-margin-source-ablation.csv"), [
  ["removed_source", "constituency", "full_winner", "full_mean_margin_pp", "without_source_winner", "without_source_mean_margin_pp", "margin_change_pp", "full_margin_error_pp", "without_source_margin_error_pp", "absolute_error_change_pp"].join(","),
  ...sourceAblationRows.map((row) => [row.source, row.constituency, row.fullWinner, row.fullMargin.toFixed(3), row.withoutWinner, row.withoutMargin.toFixed(3), row.marginChange.toFixed(3), row.fullMarginError.toFixed(3), row.withoutMarginError.toFixed(3), row.absErrorChange.toFixed(3)].map(csvCell).join(",")),
].join("\n") + "\n", "utf8");
fs.writeFileSync(path.join(OUTPUT_ROOT, "calibrated-parameters.json"), `${JSON.stringify({
  calibrationTargets: TRAINING_YEARS,
  validationTarget: "2024",
  parameters: calibratedParameters,
  candidateAwareParameters,
  marginCalibratedParameters,
  partyRatioPooledParameters,
  contestantRatioParameters,
  candidateContinuityParameters,
  calibrationScores: { blocMae: blocCalibration.score, partyMaeAfterBlocCalibration: partyCalibration.score, partyMaeWithIncumbency: incumbentCalibration.score, marginMae: marginCalibration.score, withinBlocMaeWithRatioPooling: partyRatioPooling.score, withinBlocMaeWithContestantNationalDenominator: contestantRatioCalibration.score, withinBlocMaeWithCandidateContinuity: candidateContinuityCalibration.score },
}, null, 2)}\n`, "utf8");

const report = [
  "# Northern Ireland Westminster seat model backtest",
  "",
  "Generated by `npm run backtest:ni-seat-projection`.",
  "",
  "> **Allocation diagnostic, not a forecast:** each target run uses the actual national first-preference shares from that election to isolate constituency allocation. The target constituency results are used only for scoring. This means the 2024 figures do not evaluate polling accuracy.",
  "",
  "## Rolling data cutoffs",
  "",
  "| Target | Constituency baseline | Historical sources available to the target run |",
  "| --- | --- | --- |",
  ...datasets.map((dataset) => `| ${dataset.targetYear} | ${dataset.baselineYear} | ${dataset.sources.map((source) => `${source.year} ${source.type}`).join(", ") || "None beyond baseline"} |`),
  "",
  "The target candidate field is treated as known before election day. Actual target national vote shares are deliberately supplied as oracle inputs; constituency vote distributions and winners are used for scoring. The 2017 Assembly result is included in the 2017 Westminster run because it predates that Westminster election. Belfast South historical rows are mapped to Belfast South and Mid Down only for the 2024 target boundary.",
  "",
  "## Calibration procedure",
  "",
  "Shared bloc-history scale and bloc-swing weight were selected by minimizing mean bloc-share MAE across 2015, 2017 and 2019. With those fixed, the shared party-history scale and party-swing weight were selected by minimizing mean party-share MAE over the same training elections. Grid values were history scales 0, 0.5, 1, 1.5 and 2, and swing weights 0, 15, 30, 45 and 60. Ties prefer values closest to the current defaults. No constituency-specific adjustments are fitted.",
  "",
  `Selected parameters: \`${JSON.stringify(calibratedParameters)}\`.`,
  `Candidate-aware training selected an incumbent log-multiplier of \`${candidateAwareParameters.incumbentLogEffect.toFixed(2)}\` (within-bloc strength multiplier ${Math.exp(candidateAwareParameters.incumbentLogEffect).toFixed(2)}×). Negative values encode a disadvantage; zero means neutral. Candidates without the incumbent flag receive no candidate adjustment.`,
  `A separate grid selected \`${JSON.stringify(marginCalibratedParameters)}\` by minimizing called-winner margin MAE on the training years. This is a diagnostic parameter set, distinct from the share-calibrated set.`,
  `Party-ratio pooling was tuned against within-bloc MAE using neutral-prior strengths ${PARTY_RATIO_PRIOR_STRENGTHS.join(", ")}, peer-bloc shrinkage ${PARTY_FAMILY_SHRINKAGES.join(", ")}, and party-contest coverage exponents ${PARTY_COVERAGE_EXPONENTS.join(", ")}. Coverage weighting discounts a historic ratio when the party contested fewer constituencies in that source election. Selected diagnostic settings: \`${JSON.stringify(partyRatioPooledParameters)}\`.`,
  "",
  "2024 is excluded from parameter selection and shown only as a final validation. Review the 2024 comparison before considering any live model change.",
  "",
  "## Per-election metrics",
  "",
  "Winner and seat metrics use deterministic point estimates. Share and margin errors are percentage points. Called-winner margin error is forecast top-two margin minus the actual margin for that same forecast-called winner against the strongest actual opponent.",
  "",
  ...datasets.map((dataset) => {
    const current = defaultSummaries.find((summary) => summary.targetYear === dataset.targetYear);
    const calibrated = calibratedSummaries.find((summary) => summary.targetYear === dataset.targetYear);
    const candidateAware = candidateAwareSummaries.find((summary) => summary.targetYear === dataset.targetYear);
    const marginTuned = marginCalibratedSummaries.find((summary) => summary.targetYear === dataset.targetYear);
    const ratioPooled = partyRatioPooledSummaries.find((summary) => summary.targetYear === dataset.targetYear);
    return [`### ${dataset.targetYear}`, "", metricsTable(current, calibrated), "", `Candidate-aware check: ${candidateAware.correctSeats}/${candidateAware.totalSeats} seats; party-share MAE ${candidateAware.partyShareMae.toFixed(2)}pp; called-winner margin MAE ${candidateAware.marginMae.toFixed(2)}pp.`, `Margin-tuned check: ${marginTuned.correctSeats}/${marginTuned.totalSeats} seats; party-share MAE ${marginTuned.partyShareMae.toFixed(2)}pp; called-winner margin MAE ${marginTuned.marginMae.toFixed(2)}pp.`, `Party-ratio pooled check: within-bloc MAE ${ratioPooled.withinBlocMae.toFixed(2)}pp; party-share MAE ${ratioPooled.partyShareMae.toFixed(2)}pp; called-winner margin MAE ${ratioPooled.marginMae.toFixed(2)}pp.`, ""].join("\n");
  }),
  "## Simulated-mean backtest",
  "",
  `This section uses ${simulationValidation.iterations.toLocaleString("en-IE")} seeded Monte Carlo runs per election, with the dashboard defaults of ${simulationValidation.pollError}pp polling uncertainty, ${simulationValidation.localVariation}pp constituency variation, 30% historical swing response and no tactical transfers. For party local-ratio inputs it uses the live square-root constituency-coverage weight (exponent 0.5). The model uses actual target-year national party shares as an oracle input, while target constituency results are used only for scoring. Vote-share errors here are based on the arithmetic mean of simulated party shares; seat calls use the party with the most simulated wins. This is the relevant check for whether the dashboard's mean-share display better represents margins than the deterministic point estimate. The 2024 party-level constituency means and win probabilities are in 2024-simulation-mean-shares.csv.`,
  "",
  "| 2024 metric | Deterministic point estimate | Simulated mean |",
  "| --- | ---: | ---: |",
  `| Seat calls correct | ${defaultValidation.correctSeats}/${defaultValidation.totalSeats} | ${simulationValidation.correctSeats}/${simulationValidation.totalSeats} |`,
  `| Party vote-share MAE | ${defaultValidation.partyShareMae.toFixed(2)}pp | ${simulationValidation.partyShareMae.toFixed(2)}pp |`,
  `| Called-winner margin MAE | ${defaultValidation.marginMae.toFixed(2)}pp | ${simulationValidation.marginMae.toFixed(2)}pp |`,
  `| Called-winner signed margin bias | ${defaultValidation.marginBias > 0 ? "+" : ""}${defaultValidation.marginBias.toFixed(2)}pp | ${simulationValidation.marginBias > 0 ? "+" : ""}${simulationValidation.marginBias.toFixed(2)}pp |`,
  "",
  "### Alternative aggregation of local-to-national ratios",
  "",
  "The current method takes the weighted arithmetic mean of historical local-to-national ratios. This diagnostic instead takes a weighted geometric mean, which treats the ratios as multiplicative and reduces the influence of a single unusually large ratio. No geometric-ratio setting is fitted to 2024.",
  "",
  "| Metric | Arithmetic ratio mean | Geometric ratio mean |",
  "| --- | ---: | ---: |",
  `| 2015–2019 training party-share MAE | ${mean(training.map((dataset) => summarize(dataset, liveBacktestParameters).partyShareMae)).toFixed(2)}pp | ${mean(geometricSummaries.filter((summary) => TRAINING_YEARS.includes(summary.targetYear)).map((summary) => summary.partyShareMae)).toFixed(2)}pp |`,
  `| 2024 simulated calls | ${simulationValidation.correctSeats}/${simulationValidation.totalSeats} | ${geometricSimulationValidation.correctSeats}/${geometricSimulationValidation.totalSeats} |`,
  `| 2024 simulated party-share MAE | ${simulationValidation.partyShareMae.toFixed(2)}pp | ${geometricSimulationValidation.partyShareMae.toFixed(2)}pp |`,
  `| 2024 simulated mean-margin MAE | ${simulationValidation.marginMae.toFixed(2)}pp | ${geometricSimulationValidation.marginMae.toFixed(2)}pp |`,
  "",
  "Seat-level arithmetic versus geometric mean results are in 2024-ratio-aggregation-comparison.csv.",
  "",
  "### Full party local-to-national ratio versus bloc-first allocation",
  "",
  "This diagnostic is an alternative allocation rule using only the election data in the repository. For each party, it calculates the weighted historical ratio of its constituency vote share to its national vote share, applies that ratio directly to the target-year national share, then normalizes across parties contesting the constituency. It does not first estimate constituency bloc totals and then divide each bloc among parties. Source years and coverage weighting match the current model; workbook values are not used. This is a deterministic allocation comparison, so it isolates the formula rather than layering on the dashboard's bloc-based simulation noise.",
  "",
  "| Metric | Current bloc-first rule | Direct full-ratio rule |",
  "| --- | ---: | ---: |",
  `| 2015–2019 mean party-share MAE | ${mean(currentRatioTrainingSummaries.map((summary) => summary.partyShareMae)).toFixed(2)}pp | ${mean(fullRatioTrainingSummaries.map((summary) => summary.partyShareMae)).toFixed(2)}pp |`,
  `| 2015–2019 mean called-winner margin MAE | ${mean(currentRatioTrainingSummaries.map((summary) => summary.marginMae)).toFixed(2)}pp | ${mean(fullRatioTrainingSummaries.map((summary) => summary.marginMae)).toFixed(2)}pp |`,
  `| 2024 party-share MAE | ${currentRatioValidation.partyShareMae.toFixed(2)}pp | ${fullRatioValidation.partyShareMae.toFixed(2)}pp |`,
  `| 2024 called-winner margin MAE | ${currentRatioValidation.marginMae.toFixed(2)}pp | ${fullRatioValidation.marginMae.toFixed(2)}pp |`,
  `| 2024 correct seat calls | ${currentRatioValidation.correctSeats}/${currentRatioValidation.totalSeats} | ${fullRatioValidation.correctSeats}/${fullRatioValidation.totalSeats} |`,
  "",
  `Lagan Valley: current rule calls ${laganCurrentRatio.winner} at ${laganCurrentRatio.forecastMargin.toFixed(1)}pp; direct full-ratio calls ${laganFullRatio.winner} at ${laganFullRatio.forecastMargin.toFixed(1)}pp; actual result ${laganActualRanked[0]?.[0]} by ${laganActualMargin.toFixed(1)}pp. Party-by-party values are in 2024-full-local-national-ratio-comparison.csv. This is a method diagnostic; do not promote it based on 2024 alone.`,
  "",
  "### Local-ratio trend and targeted tactical-flow tests",
  "",
  "Local-ratio trend projects the recent change in a party's local-to-national ratio forward, separately within Westminster and Assembly histories, then caps the combined adjustment at a half-to-double multiplier. The trend scale was selected by minimizing mean called-winner margin error across 2015–2019. The tactical test fits one effective rate and one competitiveness threshold on those same elections. It transfers votes only between Nationalist and Non-aligned or Unionist and Non-aligned blocs; Nationalist-to-Unionist and Unionist-to-Nationalist routes are excluded. A transfer activates only when the top two projected parties are from different blocs and within the fitted margin threshold, so it is limited to seats the model itself considers competitive. First-preference results cannot reveal voters' motives; this is an inferred effective transfer rate, not measured voter behaviour.",
  "",
  `Training mean called-winner margin MAE: baseline ${mean(training.map((dataset) => summarize(dataset, liveBacktestParameters).marginMae)).toFixed(2)}pp; trend ${localRatioTrendTrainingMarginMae.toFixed(2)}pp at trend scale ${localRatioTrendParameters.localRatioTrendScale}; targeted tactical ${tacticalTrainingMarginMae.toFixed(2)}pp at ${tacticalParameters.interBlocTacticalRate}% rate and ${tacticalParameters.tacticalActivationMargin}pp activation margin.`,
  "",
  "| 2024 simulated-mean metric | Baseline | Local-ratio trend | Targeted tactical |",
  "| --- | ---: | ---: | ---: |",
  `| Correct calls | ${simulationValidation.correctSeats}/${simulationValidation.totalSeats} | ${localRatioTrendValidation.correctSeats}/${localRatioTrendValidation.totalSeats} | ${tacticalValidation.correctSeats}/${tacticalValidation.totalSeats} |`,
  `| Party-share MAE | ${simulationValidation.partyShareMae.toFixed(2)}pp | ${localRatioTrendValidation.partyShareMae.toFixed(2)}pp | ${tacticalValidation.partyShareMae.toFixed(2)}pp |`,
  `| Mean-margin MAE | ${simulationValidation.marginMae.toFixed(2)}pp | ${localRatioTrendValidation.marginMae.toFixed(2)}pp | ${tacticalValidation.marginMae.toFixed(2)}pp |`,
  `| Mean-margin signed bias | ${simulationValidation.marginBias > 0 ? "+" : ""}${simulationValidation.marginBias.toFixed(2)}pp | ${localRatioTrendValidation.marginBias > 0 ? "+" : ""}${localRatioTrendValidation.marginBias.toFixed(2)}pp | ${tacticalValidation.marginBias > 0 ? "+" : ""}${tacticalValidation.marginBias.toFixed(2)}pp |`,
  "",
  "Selected-seat mean-margin comparison:",
  "",
  "| Constituency | Baseline | Local-ratio trend | Targeted tactical |",
  "| --- | --- | --- | --- |",
  ...marginAuditSeats.map((name) => {
    const baseline = simulationValidation.rows.find((row) => row.constituency === name);
    const trend = localRatioTrendValidation.rows.find((row) => row.constituency === name);
    const tactical = tacticalValidation.rows.find((row) => row.constituency === name);
    if (!baseline || !trend || !tactical) return null;
    return `| ${name} | ${baseline.winner} ${baseline.meanMargin.toFixed(1)}pp | ${trend.winner} ${trend.meanMargin.toFixed(1)}pp | ${tactical.winner} ${tactical.meanMargin.toFixed(1)}pp |`;
  }).filter(Boolean),
  "",
  "Full constituency-by-constituency outputs are in 2024-swing-tactical-comparison.csv. These are diagnostics; do not promote a setting based on 2024 alone.",
  "",
  "### Party-specific UUP-to-Alliance tactical-flow diagnostic",
  "",
  "This tests one directional party-level route: a share of UUP support transfers to Alliance only when AP and a Unionist party are the leading pair and the race is within the fitted competitiveness margin. It does not transfer support from DUP or TUV. The rate and margin were selected on 2015–2019 called-winner margin MAE; 2024 remains held out. The existing all-Unionist-bloc route is zero in this diagnostic. This is an inferred scenario flow, not a measured voter preference rate.",
  "",
  `Training mean margin MAE: baseline ${mean(training.map((dataset) => summarize(dataset, liveBacktestParameters).marginMae)).toFixed(2)}pp; UUP-to-Alliance ${uupToAllianceTrainingMarginMae.toFixed(2)}pp at ${uupToAllianceParameters.uupToAllianceRate}% and ${uupToAllianceParameters.uupToAllianceActivationMargin}pp activation margin. 2024 simulated mean: baseline ${simulationValidation.correctSeats}/${simulationValidation.totalSeats} correct, ${simulationValidation.marginMae.toFixed(2)}pp margin MAE; UUP-to-Alliance ${uupToAllianceValidation.correctSeats}/${uupToAllianceValidation.totalSeats} correct, ${uupToAllianceValidation.marginMae.toFixed(2)}pp margin MAE and ${uupToAllianceValidation.partyShareMae.toFixed(2)}pp party-share MAE.`,
  "",
  "The constituency-level UUP, Alliance and winner changes are in 2024-uup-alliance-tactical-comparison.csv. The model's Assembly count data record candidate totals by count but do not identify the originating ballot for each transfer, so they cannot directly establish a UUP-to-Alliance transfer rate.",
  "",
  "### All-party Assembly transfer-preference diagnostic",
  "",
  "This diagnostic scans every constituency and consecutive count in the available 2017 and 2022 Assembly datasets. It attributes gains only where exactly one candidate was newly eliminated or elected in the preceding count; gains by continuing candidates are treated as a rough destination signal. Multiple simultaneous source events are excluded. It then tests a small, common effective tactical rate in close cross-bloc Westminster contests, allocating movement from each non-leading party to the top two according to its observed Assembly destination-gain profile. Transfers directly between Nationalist and Unionist blocs remain prohibited. The rate and closeness threshold are selected using 2015–2019 Westminster margin MAE; each historical backtest only sees Assembly elections held by its target year. This is a sensitivity test, because STV preference transfers are not equivalent to first-preference tactical switching.",
  "",
  `For the 2024 run, the available Assembly evidence is from ${validationDataset.transferProfile.years.join(" and ")}. It yields ${validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.transitions, 0)} count transitions, of which ${validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.singleSourceTransitions, 0)} have one identifiable source event and ${validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.usableEvents, 0)} produce usable destination-gain profiles. Across those events, observed gains account for ${(validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.observedTransferVotes, 0) / Math.max(1, validationDataset.transferProfile.stats.reduce((sum, stat) => sum + stat.sourceVotePool, 0)) * 100).toFixed(1)}% of the source vote pools. The complete inferred party-to-party matrix is in assembly-transfer-matrix.csv; its values are aggregate count gains, not ballot-level transfer counts.`,
  `The fitted effective rate is ${assemblyTransferParameters.assemblyTransferTacticalRate}% within ${assemblyTransferParameters.assemblyTransferActivationMargin}pp, with 2015–2019 training margin MAE ${assemblyTransferTrainingMarginMae.toFixed(2)}pp (baseline ${mean(training.map((dataset) => summarize(dataset, liveBacktestParameters).marginMae)).toFixed(2)}pp). On held-out 2024, baseline scored ${simulationValidation.correctSeats}/${simulationValidation.totalSeats}, party-share MAE ${simulationValidation.partyShareMae.toFixed(2)}pp and mean-margin MAE ${simulationValidation.marginMae.toFixed(2)}pp; the Assembly-preference scenario scored ${assemblyTransferValidation.correctSeats}/${assemblyTransferValidation.totalSeats}, ${assemblyTransferValidation.partyShareMae.toFixed(2)}pp and ${assemblyTransferValidation.marginMae.toFixed(2)}pp.`,
  `Party-to-party gains from UUP transfers were most often to DUP (30.5% of observed destination gains) and Alliance (12.2%) across 19 usable source events. This is aggregate candidate gain evidence across elections, not a direct estimate of tactical first-preference switching. Leave-one-election-out results are in assembly-transfer-cross-validation.csv; only three Westminster years are available, so treat them as a stability check rather than a definitive validation.`,
  "",
  "Constituency-level changes are in 2024-assembly-transfer-tactical-comparison.csv. This is evidence for deciding whether to develop a richer bloc/party transfer feature; do not promote it to the live model without stronger validation and review of the underlying count records.",
  "",
  "### Historical source-weight calibration",
  "",
  "A grid search scaled the weights of older Westminster and Assembly constituency results independently, leaving the 2019 constituency baseline and national vote shares untouched. The scales were selected only on 2015–2019 called-winner margin MAE; because there are only three training elections, this is exploratory and particularly vulnerable to overfitting.",
  "",
  `Training margin MAE was ${mean(training.map((dataset) => summarize(dataset, liveBacktestParameters).marginMae)).toFixed(2)}pp with existing weights and ${historyWeightTrainingMarginMae.toFixed(2)}pp after calibration (Westminster scale ${historyWeightParameters.westminsterHistoryScale}, Assembly scale ${historyWeightParameters.assemblyHistoryScale}). On held-out 2024 the existing weights scored ${simulationValidation.correctSeats}/${simulationValidation.totalSeats} calls, ${simulationValidation.marginMae.toFixed(2)}pp mean-margin MAE and ${simulationValidation.partyShareMae.toFixed(2)}pp party-share MAE; recalibrated weights scored ${historyWeightedValidation.correctSeats}/${historyWeightedValidation.totalSeats}, ${historyWeightedValidation.marginMae.toFixed(2)}pp and ${historyWeightedValidation.partyShareMae.toFixed(2)}pp respectively.`,
  "",
  "Constituency-level results are in 2024-history-weight-comparison.csv. Treat this as a diagnostic only; the small training sample is not enough to justify replacing the current source weights.",
  "",
  "Largest simulated-mean margin errors in 2024:",
  "",
  ...simulationValidation.rows.slice().sort((a, b) => Math.abs(b.marginError) - Math.abs(a.marginError)).slice(0, 8).map((row) => `- **${row.constituency}:** simulated call ${row.winner} at ${row.winProbability.toFixed(1)}% win probability, mean margin ${row.meanMargin.toFixed(1)}pp; actual winner ${row.actualWinner}, actual margin for the simulated call ${row.actualCallMargin.toFixed(1)}pp; error ${row.marginError > 0 ? "+" : ""}${row.marginError.toFixed(1)}pp.`),
  "",
  "A simulation mean is an average over uncertainty, not an accuracy correction. The added spread and clipping can shift a mean slightly from the point estimate, but should not be interpreted as extra constituency evidence; large residuals remain a model/data issue.",
  "",
  "### Sensitivity to older constituency-history sources",
  "",
  "To estimate the contribution of older local results, this sensitivity keeps 2024 national vote shares, candidates, settings and all scoring outcomes fixed, while selectively removing earlier Westminster and/or Assembly sources from the constituency allocator. '2019 baseline only' removes 2015/2017 Westminster and 2017/2022 Assembly local-history sources but retains the 2019 constituency baseline. 'No constituency-level results' replaces each local baseline and each historical local result with that election's national party shares, removing local over- or under-performance while preserving national party ratios. National target shares remain the same. These are source-removal tests, not boundary crosswalks: the source files do not encode a complete ward-level mapping between historical boundaries and the 2024 constituencies.",
  "",
  "| Scenario | Additional local-history sources | Simulated calls | Party-share MAE | Mean-margin MAE | Mean-margin bias |",
  "| --- | --- | ---: | ---: | ---: | ---: |",
  ...boundarySensitivityScenarios.map((scenario) => `| ${scenario.label} | ${scenario.sourceYears.join(", ") || "None"} | ${scenario.simulated.correctSeats}/${scenario.simulated.totalSeats} | ${scenario.simulated.partyShareMae.toFixed(2)}pp | ${scenario.simulated.marginMae.toFixed(2)}pp | ${scenario.simulated.marginBias > 0 ? "+" : ""}${scenario.simulated.marginBias.toFixed(2)}pp |`),
  "",
  "Full history versus 2019-baseline-only mean margins on selected constituencies:",
  "",
  "| Constituency | Full-history call / mean margin | Baseline-only call / mean margin | Margin change after removing older sources |",
  "| --- | --- | --- | ---: |",
  ...["Belfast East", "East Antrim", "East Derry", "Fermanagh and South Tyrone", "Lagan Valley", "North Antrim", "North Down", "South Antrim", "Upper Bann"].map((name) => {
    const full = fullHistoryBoundaryScenario.simulated.rows.find((row) => row.constituency === name);
    const baseline = boundarySensitivityScenarios[1].simulated.rows.find((row) => row.constituency === name);
    if (!full || !baseline) return null;
    const change = baseline.meanMargin - full.meanMargin;
    return `| ${name} | ${full.winner} / ${full.meanMargin.toFixed(1)}pp | ${baseline.winner} / ${baseline.meanMargin.toFixed(1)}pp | ${change > 0 ? "+" : ""}${change.toFixed(1)}pp |`;
  }).filter(Boolean),
  "",
  "If the baseline-only scenario scores worse, that indicates the older data help overall despite the boundary mismatches; if it scores better, the extra history may be introducing more noise than signal. The national-only case is an extreme control for removing all constituency-specific historical signal. Neither result proves that the baseline itself is boundary-clean. A proper answer to the geographic question would require rebasing historical ward-level votes onto the 2024 map, which these constituency-level files cannot do by themselves.",
  "",
  "### Leave-one-source-out audit: largest-margin seats",
  "",
  "For each listed seat, each older Westminster/Assembly local-history source was removed separately while keeping the 2019 baseline, 2024 national shares, settings and random seed fixed. 'Margin shift' is the change in simulated-mean called-winner margin after removing that source. 'Absolute error change' is the change in absolute margin error against the actual result for the model's called winner: positive means the removal worsened the error; negative means it reduced it. This is a sensitivity diagnostic, not proof that a source is geographically correct; correlated history can make leave-one-out effects misleading.",
  "",
  "| Constituency | Removed source | Full-history winner / margin | Without-source winner / margin | Margin shift | Absolute error change |",
  "| --- | --- | --- | --- | ---: | ---: |",
  ...sourceAblationRows.slice().sort((a, b) => a.constituency.localeCompare(b.constituency) || a.source.localeCompare(b.source)).map((row) => `| ${row.constituency} | ${row.source} | ${row.fullWinner} / ${row.fullMargin.toFixed(1)}pp | ${row.withoutWinner} / ${row.withoutMargin.toFixed(1)}pp | ${row.marginChange > 0 ? "+" : ""}${row.marginChange.toFixed(1)}pp | ${row.absErrorChange > 0 ? "+" : ""}${row.absErrorChange.toFixed(1)}pp |`),
  "",
  "The full row-level values are in 2024-margin-source-ablation.csv.",
  "",
  "## 2024 constituency residuals",
  "",
  "The CSV contains each constituency under default, share-calibrated, candidate-aware, margin-calibrated, party-ratio-pooled, contestant-normalized party-ratio and candidate-continuity parameters, including bloc errors and called-winner margin error.",
  "",
  "### Margin calibration check",
  "",
  `The default model's mean called-winner margin MAE across the 2015–2019 training elections was ${mean(training.map((dataset) => defaultSummaries.find((summary) => summary.targetYear === dataset.targetYear).marginMae)).toFixed(2)}pp. Margin-targeted grid calibration reduced that in-sample figure to ${marginCalibration.score.toFixed(2)}pp, but its 2024 validation MAE was ${marginCalibratedValidation.marginMae.toFixed(2)}pp, versus ${defaultValidation.marginMae.toFixed(2)}pp default and ${calibratedValidation.marginMae.toFixed(2)}pp with the share-calibrated parameters. This is a failed out-of-sample calibration and should not be applied to the live model. The selected margin parameters are shown as a diagnostic only.`,
  "",
  "### Largest 2024 margin errors",
  "",
  ...defaultValidation.rows.slice().sort((a, b) => Math.abs(b.marginError) - Math.abs(a.marginError)).slice(0, 6).map((row) => `- **${row.constituency}:** forecast ${row.winner} margin ${row.forecastMargin.toFixed(1)}pp; actual margin for that called winner ${row.actualCallMargin.toFixed(1)}pp; error ${row.marginError > 0 ? "+" : ""}${row.marginError.toFixed(1)}pp. Bloc-share errors (model minus actual): Nationalist ${row.blocErrors.Nationalist > 0 ? "+" : ""}${row.blocErrors.Nationalist.toFixed(1)}, Unionist ${row.blocErrors.Unionist > 0 ? "+" : ""}${row.blocErrors.Unionist.toFixed(1)}, Non-aligned ${row.blocErrors["Non-aligned"] > 0 ? "+" : ""}${row.blocErrors["Non-aligned"].toFixed(1)}pp.`),
  "",
  "These residuals do not point to one shared margin bias: 2024 includes both substantially overstated and understated leads. The largest misses also have different bloc-error patterns, so a uniform margin shrink cannot address them. Review the seat-level and party-share residuals before changing a shared model rule.",
  "",
  "### Party allocation within blocs",
  "",
  `In 2024, party-share MAE was ${defaultValidation.partyShareMae.toFixed(2)}pp, bloc-share MAE was ${defaultValidation.blocShareMae.toFixed(2)}pp, and conditional party-share-within-bloc MAE was ${defaultValidation.withinBlocMae.toFixed(2)}pp. The largest party-specific conditional errors were:`,
  ...Object.entries(defaultValidation.withinBlocByParty).sort((a, b) => b[1].mae - a[1].mae).slice(0, 8).map(([party, result]) => `- **${party}:** within-bloc MAE ${result.mae.toFixed(1)}pp; signed bias ${result.bias > 0 ? "+" : ""}${result.bias.toFixed(1)}pp across ${result.n} constituency appearances.`),
  "",
  "This shows material error in party allocation within blocs as well as in bloc totals. These conditional-share errors use a different denominator from overall vote-share errors, so the MAEs should not be directly compared. The experiment tests a neutral prior and peer-bloc pooling for sparse local history, plus weighting a historical ratio by that party's constituency coverage in the source election.",
  `The party-ratio experiment selected neutral prior strength ${partyRatioPooledParameters.partyRatioPriorStrength}, peer-bloc shrinkage ${partyRatioPooledParameters.partyFamilyShrinkage}, and coverage exponent ${partyRatioPooledParameters.partyCoverageExponent}. On 2024 it scored ${partyRatioPooledValidation.withinBlocMae.toFixed(2)}pp conditional within-bloc MAE, ${partyRatioPooledValidation.partyShareMae.toFixed(2)}pp party-share MAE, and ${partyRatioPooledValidation.marginMae.toFixed(2)}pp margin MAE, versus share-calibrated baseline (${calibratedValidation.withinBlocMae.toFixed(2)}pp, ${calibratedValidation.partyShareMae.toFixed(2)}pp and ${calibratedValidation.marginMae.toFixed(2)}pp).`,
  "",
  "Coverage sensitivity (all other party-ratio settings fixed at zero):",
  "",
  "| Coverage exponent | Training within-bloc MAE | 2024 within-bloc MAE | 2024 party-share MAE | 2024 margin MAE | Calls correct | North Antrim call |",
  "| ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ...coverageSensitivity.map((entry) => `| ${entry.partyCoverageExponent} | ${entry.trainingWithinBlocMae.toFixed(2)} | ${entry.validationSummary.withinBlocMae.toFixed(2)} | ${entry.validationSummary.partyShareMae.toFixed(2)} | ${entry.validationSummary.marginMae.toFixed(2)} | ${entry.validationSummary.correctSeats}/${entry.validationSummary.totalSeats} | ${entry.northAntrimWinner} |`),
  "",
  "The same coverage test on current default weights and rolling pre-2024 holdouts:",
  "",
  "| Held-out year | Exponent selected on other training years | Default margin MAE | Adjusted margin MAE | Default within-bloc MAE | Adjusted within-bloc MAE |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...coverageCrossValidation.map((entry) => `| ${entry.targetYear} | ${entry.selectedExponent} | ${entry.baseline.marginMae.toFixed(2)} | ${entry.adjusted.marginMae.toFixed(2)} | ${entry.baseline.withinBlocMae.toFixed(2)} | ${entry.adjusted.withinBlocMae.toFixed(2)} |`),
  "",
  "Fixed conservative exponent 0.5 on each rolling target with default model weights:",
  "",
  "| Target year | Default margin MAE | Adjusted margin MAE | Default party-share MAE | Adjusted party-share MAE | Calls default / adjusted |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...fixedHalfCoverageCrossValidation.map((entry) => `| ${entry.targetYear} | ${entry.baseline.marginMae.toFixed(2)} | ${entry.adjusted.marginMae.toFixed(2)} | ${entry.baseline.partyShareMae.toFixed(2)} | ${entry.adjusted.partyShareMae.toFixed(2)} | ${entry.baseline.correctSeats}/${entry.baseline.totalSeats} / ${entry.adjusted.correctSeats}/${entry.adjusted.totalSeats} |`),
  "",
  `With current default weights on 2024, coverage exponent 0.5 gives margin MAE ${liveDefaultCoverageValidation.find((entry) => entry.partyCoverageExponent === 0.5).summary.marginMae.toFixed(2)}pp, party-share MAE ${liveDefaultCoverageValidation.find((entry) => entry.partyCoverageExponent === 0.5).summary.partyShareMae.toFixed(2)}pp, and ${liveDefaultCoverageValidation.find((entry) => entry.partyCoverageExponent === 0.5).summary.correctSeats}/${liveDefaultCoverageValidation.find((entry) => entry.partyCoverageExponent === 0.5).summary.totalSeats} calls, versus exponent 0 at ${liveDefaultCoverageValidation[0].summary.marginMae.toFixed(2)}pp, ${liveDefaultCoverageValidation[0].summary.partyShareMae.toFixed(2)}pp, and ${liveDefaultCoverageValidation[0].summary.correctSeats}/${liveDefaultCoverageValidation[0].summary.totalSeats}.`,
  "",
  "Seat-level effect under current default settings (same 2024 national inputs):",
  "",
  "| Constituency | Winner, no coverage weight | Winner, square-root weight | Margin change |",
  "| --- | --- | --- | ---: |",
  ...liveCoverageSeatChanges.filter((item) => Math.abs(item.marginChange) >= 0.05 || item.winnerChanged).sort((a, b) => Math.abs(b.marginChange) - Math.abs(a.marginChange)).map((item) => `| ${item.constituency} | ${item.baselineWinner} | ${item.adjustedWinner} | ${item.marginChange > 0 ? "+" : ""}${item.marginChange.toFixed(2)}pp |`),
  "",
  "### Contestant-conditioned national denominator",
  "",
  "A second ratio definition compares a party's local share within its bloc with its national share within the bloc only across constituencies where it actually stood. This avoids treating votes from seats with no candidate as evidence of weak national support.",
  `Training selected \`${JSON.stringify(contestantRatioParameters)}\` with within-bloc MAE ${contestantRatioCalibration.score.toFixed(2)}pp. On 2024 it scored ${contestantRatioValidation.correctSeats}/${contestantRatioValidation.totalSeats} calls, party-share MAE ${contestantRatioValidation.partyShareMae.toFixed(2)}pp, within-bloc MAE ${contestantRatioValidation.withinBlocMae.toFixed(2)}pp, and margin MAE ${contestantRatioValidation.marginMae.toFixed(2)}pp. The share-calibrated baseline scored ${calibratedValidation.correctSeats}/${calibratedValidation.totalSeats}, ${calibratedValidation.partyShareMae.toFixed(2)}pp, ${calibratedValidation.withinBlocMae.toFixed(2)}pp, and ${calibratedValidation.marginMae.toFixed(2)}pp respectively.`,
  `In North Antrim the contestant-conditioned calculation calls ${contestantRatioValidation.rows.find((row) => row.constituency === "North Antrim")?.winner}; the share-calibrated baseline calls ${calibratedValidation.rows.find((row) => row.constituency === "North Antrim")?.winner}.`,
  "",
  "### Candidate continuity check",
  "",
  "For parties with a candidate ID match in the same constituency and party in prior Westminster or Assembly data, this check increases the weight of those candidate-specific local ratios. First-time candidates keep the party-level baseline. This is separate from the earlier blanket incumbent-flag test.",
  `Training selected a candidate-match ratio weight of ${candidateContinuityParameters.candidateContinuityScale}×, with training within-bloc MAE ${candidateContinuityCalibration.score.toFixed(2)}pp. Against the same coverage-weighted share-calibrated baseline, the 2024 candidate-continuity run scored ${candidateContinuityValidation.correctSeats}/${candidateContinuityValidation.totalSeats}, party-share MAE ${candidateContinuityValidation.partyShareMae.toFixed(2)}pp, within-bloc MAE ${candidateContinuityValidation.withinBlocMae.toFixed(2)}pp, and margin MAE ${candidateContinuityValidation.marginMae.toFixed(2)}pp.`,
  `North Antrim: baseline TUV margin ${coverageSensitivity.find((item) => item.partyCoverageExponent === 0.5).validationSummary.rows.find((row) => row.constituency === "North Antrim")?.forecastMargin.toFixed(1)}pp; candidate-continuity run ${candidateContinuityValidation.rows.find((row) => row.constituency === "North Antrim")?.winner} margin ${candidateContinuityValidation.rows.find((row) => row.constituency === "North Antrim")?.forecastMargin.toFixed(1)}pp.`,
  "",
  "The training-selected coverage exponent improves aggregate 2024 share and margin MAE modestly, but drops the correct-seat count from 16/18 to 15/18 by flipping North Antrim from TUV to DUP. This trade-off means the pooled setting is a useful diagnostic, not yet a safe global replacement.",
  "",
  "## Interpretation limits",
  "",
  "This backtest measures the constituency allocator under oracle national shares. It does not model poll error, tactical rates or candidate quality. The candidate-aware check adds a signed incumbent-flag adjustment only; it does not add a personal-vote bonus for a new candidate. Repeat candidate IDs and party switches are too sparse to estimate reliable personal-vote carryover separately from party-local history. The party, bloc and incumbent parameters are fit on 2015–2019; 2024 is the untouched check. With three training elections, treat selected values as provisional rather than definitive. Candidate-aware parameters are reported separately and are not automatically applied to the live projection model.",
  "",
].join("\n");
fs.writeFileSync(path.join(OUTPUT_ROOT, "summary.md"), report, "utf8");
console.log(`Wrote ${path.relative(ROOT, path.join(OUTPUT_ROOT, "summary.md"))}`);
console.log(`Wrote ${path.relative(ROOT, path.join(OUTPUT_ROOT, "constituency-errors.csv"))}`);
console.log(`Wrote ${path.relative(ROOT, path.join(OUTPUT_ROOT, "calibrated-parameters.json"))}`);
console.log(`2024 default: ${defaultValidation.correctSeats}/${defaultValidation.totalSeats}, party MAE ${defaultValidation.partyShareMae.toFixed(2)}, bloc MAE ${defaultValidation.blocShareMae.toFixed(2)}, margin MAE ${defaultValidation.marginMae.toFixed(2)}`);
console.log(`2024 calibrated: ${calibratedValidation.correctSeats}/${calibratedValidation.totalSeats}, party MAE ${calibratedValidation.partyShareMae.toFixed(2)}, bloc MAE ${calibratedValidation.blocShareMae.toFixed(2)}, margin MAE ${calibratedValidation.marginMae.toFixed(2)}`);
console.log(`Candidate-aware incumbent log effect: ${candidateAwareParameters.incumbentLogEffect.toFixed(2)} (${Math.exp(candidateAwareParameters.incumbentLogEffect).toFixed(2)}x); 2024: ${candidateAwareValidation.correctSeats}/${candidateAwareValidation.totalSeats}, party MAE ${candidateAwareValidation.partyShareMae.toFixed(2)}, bloc MAE ${candidateAwareValidation.blocShareMae.toFixed(2)}, margin MAE ${candidateAwareValidation.marginMae.toFixed(2)}`);
console.log(`Margin-tuned parameters: ${JSON.stringify(marginCalibratedParameters)}; training margin MAE ${marginCalibration.score.toFixed(2)}; 2024: ${marginCalibratedValidation.correctSeats}/${marginCalibratedValidation.totalSeats}, party MAE ${marginCalibratedValidation.partyShareMae.toFixed(2)}, bloc MAE ${marginCalibratedValidation.blocShareMae.toFixed(2)}, margin MAE ${marginCalibratedValidation.marginMae.toFixed(2)}`);
console.log(`Party-ratio treatment: ${JSON.stringify(partyRatioPooledParameters)}; training within-bloc MAE ${partyRatioPooling.score.toFixed(2)}; 2024 within-bloc MAE ${partyRatioPooledValidation.withinBlocMae.toFixed(2)}, party MAE ${partyRatioPooledValidation.partyShareMae.toFixed(2)}, margin MAE ${partyRatioPooledValidation.marginMae.toFixed(2)}`);
console.log(`Contestant-normalized ratio: ${JSON.stringify(contestantRatioParameters)}; training within-bloc MAE ${contestantRatioCalibration.score.toFixed(2)}; 2024 ${contestantRatioValidation.correctSeats}/${contestantRatioValidation.totalSeats}, within-bloc MAE ${contestantRatioValidation.withinBlocMae.toFixed(2)}, party MAE ${contestantRatioValidation.partyShareMae.toFixed(2)}, margin MAE ${contestantRatioValidation.marginMae.toFixed(2)}, North Antrim ${contestantRatioValidation.rows.find((row) => row.constituency === "North Antrim")?.winner}`);
console.log(`Candidate continuity: ${candidateContinuityParameters.candidateContinuityScale}x; training within-bloc MAE ${candidateContinuityCalibration.score.toFixed(2)}; 2024 ${candidateContinuityValidation.correctSeats}/${candidateContinuityValidation.totalSeats}, within-bloc MAE ${candidateContinuityValidation.withinBlocMae.toFixed(2)}, party MAE ${candidateContinuityValidation.partyShareMae.toFixed(2)}, margin MAE ${candidateContinuityValidation.marginMae.toFixed(2)}, North Antrim ${candidateContinuityValidation.rows.find((row) => row.constituency === "North Antrim")?.winner}`);
console.log(`UUP-to-Alliance tactical: ${uupToAllianceParameters.uupToAllianceRate}% within ${uupToAllianceParameters.uupToAllianceActivationMargin}pp; training margin MAE ${uupToAllianceTrainingMarginMae.toFixed(2)}; 2024 ${uupToAllianceValidation.correctSeats}/${uupToAllianceValidation.totalSeats}, party MAE ${uupToAllianceValidation.partyShareMae.toFixed(2)}, margin MAE ${uupToAllianceValidation.marginMae.toFixed(2)}, Lagan Valley ${uupToAllianceValidation.rows.find((row) => row.constituency === "Lagan Valley")?.winner}`);
console.log(`Assembly transfer-preference tactical: ${assemblyTransferParameters.assemblyTransferTacticalRate}% within ${assemblyTransferParameters.assemblyTransferActivationMargin}pp; training margin MAE ${assemblyTransferTrainingMarginMae.toFixed(2)}; 2024 ${assemblyTransferValidation.correctSeats}/${assemblyTransferValidation.totalSeats}, party MAE ${assemblyTransferValidation.partyShareMae.toFixed(2)}, margin MAE ${assemblyTransferValidation.marginMae.toFixed(2)}; Lagan Valley ${assemblyTransferValidation.rows.find((row) => row.constituency === "Lagan Valley")?.winner}`);
console.log(`Assembly transfer leave-one-election-out margin MAE changes: ${assemblyTransferCrossValidation.map((row) => `${row.targetYear} ${row.baseline.marginMae.toFixed(2)}->${row.adjusted.marginMae.toFixed(2)}`).join(", ")}`);
