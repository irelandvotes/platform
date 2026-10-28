import type { NiAssemblyCandidate, NiAssemblyProjectionData } from "./niAssemblyProjectionData";
import { getProjectionBloc, PROJECTION_BLOCS, type ProjectionBloc } from "./projectionBlocs";

type OutcomeProbability = { outcome: number; probability: number };
type BlocOutcome = {
  code: ProjectionBloc;
  share: number;
  shareStandardDeviation: number;
  baselineShare: number;
  shareChange: number;
  expectedSeats: number;
  seatStandardDeviation: number;
  baselineSeats: number;
  seatCountProbabilities: OutcomeProbability[];
};

export type NiAssemblySettings = {
  support: Record<string, number>;
  candidateCounts: Record<string, Record<string, number>>;
  pollingUncertainty: number;
  localVariation: number;
  iterations: number;
};

type CandidateDefinition = { id: string; name: string; party: string; weight: number };
type CandidateState = CandidateDefinition & { votes: number; status: "running" | "elected" | "eliminated" };

export type NiAssemblyCountStage = {
  count: number;
  action: "first preferences" | "elected" | "eliminated" | "remaining elected";
  candidate: string;
  party: string;
  tally: number;
  transferred: number;
  exhausted: number;
  quota: number;
  simulationCount: number;
  eventFrequencyPercent: number;
  candidateTallies: Array<{ name: string; party: string; votes: number; status: CandidateState["status"] }>;
};

export type NiAssemblyProjectionResult = {
  iterations: number;
  constituencies: Array<{
    name: string;
    seats: number;
    quota: number;
    validVotes: number;
    parties: Array<{
      code: string;
      firstPreferenceShare: number;
      firstPreferenceStandardDeviation: number;
      baselineShare: number;
      shareChange: number;
      firstPreferenceLow: number;
      firstPreferenceHigh: number;
      expectedSeats: number;
      seatStandardDeviation: number;
      baselineSeats: number;
      seatCountProbabilities: OutcomeProbability[];
      anySeatProbability: number;
      seatThresholdProbabilities: Array<number | null>;
      candidates: Array<{ name: string; meanFirstPreferences: number; electionProbability: number }>;
    }>;
    topFiveSeatsByParty: Record<string, number>;
    blocOutcomes: BlocOutcome[];
    meanCount: NiAssemblyCountStage[];
    leadingParty: string;
    leadingPartyProbability: Record<string, number>;
  }>;
  blocStandings: BlocOutcome[];
  standings: Array<{ code: string; expectedSeats: number; seatStandardDeviation: number; seatCountProbabilities: OutcomeProbability[]; topFiveSeats: number; medianSeats: number; lowSeats: number; highSeats: number; baselineSeats: number; seatChange: number; projectedShare: number; shareStandardDeviation: number; baselineShare: number; shareChange: number; largestPartyProbability: number }>;
};

function makeRandom(seedText: string) {
  let state = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) state = Math.imul(state ^ seedText.charCodeAt(index), 16777619);
  let spare: number | null = null;
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

function normalize(values: Record<string, number>) {
  const positive = Object.fromEntries(Object.entries(values).map(([code, value]) => [code, Math.max(0, value)]));
  const total = Object.values(positive).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    const count = Object.keys(values).length;
    return Object.fromEntries(Object.keys(values).map((code) => [code, count ? 1 / count : 0]));
  }
  return Object.fromEntries(Object.entries(positive).map(([code, value]) => [code, value / total]));
}

function standardDeviation(values: number[]) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function outcomeProbabilities(values: number[], maximum: number): OutcomeProbability[] {
  return Array.from({ length: maximum + 1 }, (_, outcome) => ({
    outcome,
    probability: values.length ? values.filter((value) => value === outcome).length / values.length * 100 : 0,
  }));
}

function standardNormalDensity(value: number) {
  return Math.exp(-0.5 * value * value) / Math.sqrt(2 * Math.PI);
}

function standardNormalCdf(value: number) {
  const absolute = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absolute);
  const tail = standardNormalDensity(absolute) * t * (
    0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))
  );
  return value >= 0 ? 1 - tail : tail;
}

function positiveNormalLocationForMean(mean: number, standardDeviation: number) {
  if (mean <= 0 || standardDeviation <= 0) return Math.max(0, mean);
  let low = mean - 12 * standardDeviation;
  let high = mean;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const location = (low + high) / 2;
    const z = location / standardDeviation;
    const clippedMean = location * standardNormalCdf(z) + standardDeviation * standardNormalDensity(z);
    if (clippedMean < mean) low = location;
    else high = location;
  }
  return (low + high) / 2;
}

const LOCAL_NATIONAL_CYCLES = [
  { year: "2022" as const, weight: 0.55 },
  { year: "2017" as const, weight: 0.30 },
  { year: "2024 HOC" as const, weight: 0.15 },
];

function localBlocRatio(data: NiAssemblyProjectionData, constituencyName: string, bloc: string) {
  const constituency = data.constituencies.find((item) => item.name === constituencyName);
  if (!constituency) return 1;
  let weightedRatio = 0;
  let weightTotal = 0;
  for (const cycle of LOCAL_NATIONAL_CYCLES) {
    const localShares = cycle.year === "2024 HOC"
      ? constituency.westminster2024LocalShare
      : constituency.localShareByYear[cycle.year];
    const nationalShares = cycle.year === "2024 HOC"
      ? data.westminster2024NationalShare
      : data.nationalShareByYear[cycle.year];
    const localBlocShare = Object.entries(localShares).reduce((sum, [code, share]) => sum + (getProjectionBloc(code) === bloc ? share : 0), 0);
    const nationalBlocShare = Object.entries(nationalShares).reduce((sum, [code, share]) => sum + (getProjectionBloc(code) === bloc ? share : 0), 0);
    if (localBlocShare <= 0 || nationalBlocShare <= 0) continue;
    weightedRatio += (localBlocShare / nationalBlocShare) * cycle.weight;
    weightTotal += cycle.weight;
  }
  // Missing cycles are neutral evidence, not a reason to treat one observed
  // local ratio as if it were supported by the full historical series.
  return weightedRatio + Math.max(0, 1 - weightTotal);
}

function partyWithinBlocRatio(data: NiAssemblyProjectionData, constituencyName: string, party: string) {
  const constituency = data.constituencies.find((item) => item.name === constituencyName);
  if (!constituency) return 1;
  const bloc = getProjectionBloc(party);
  let weightedRatio = 0;
  let weightTotal = 0;
  for (const cycle of LOCAL_NATIONAL_CYCLES) {
    const localShares = cycle.year === "2024 HOC"
      ? constituency.westminster2024LocalShare
      : constituency.localShareByYear[cycle.year];
    const nationalShares = cycle.year === "2024 HOC"
      ? data.westminster2024NationalShare
      : data.nationalShareByYear[cycle.year];
    const localPartyShare = localShares[party];
    const nationalPartyShare = nationalShares[party];
    const localBlocShare = Object.entries(localShares).reduce((sum, [code, share]) => sum + (getProjectionBloc(code) === bloc ? share : 0), 0);
    const nationalBlocShare = Object.entries(nationalShares).reduce((sum, [code, share]) => sum + (getProjectionBloc(code) === bloc ? share : 0), 0);
    if (localPartyShare === undefined || nationalPartyShare === undefined || localBlocShare <= 0 || nationalBlocShare <= 0 || nationalPartyShare <= 0) continue;
    const localWithinBloc = localPartyShare / localBlocShare;
    const nationalWithinBloc = nationalPartyShare / nationalBlocShare;
    weightedRatio += (localWithinBloc / nationalWithinBloc) * cycle.weight;
    weightTotal += cycle.weight;
  }
  // Keep the configured cycle weights on their original scale. A party
  // observed in only one cycle should be partly shrunk toward neutral strength.
  return weightedRatio + Math.max(0, 1 - weightTotal);
}

function createCandidateDefinitions(
  data: NiAssemblyProjectionData,
  constituencyName: string,
  candidateCounts: Record<string, number>,
): CandidateDefinition[] {
  const constituency = data.constituencies.find((item) => item.name === constituencyName);
  const candidatesByParty = new Map<string, NiAssemblyCandidate[]>();
  for (const candidate of constituency?.candidates ?? []) {
    const partyCandidates = candidatesByParty.get(candidate.party) ?? [];
    partyCandidates.push(candidate);
    candidatesByParty.set(candidate.party, partyCandidates);
  }
  return Object.entries(candidateCounts).filter(([, count]) => count > 0).flatMap(([party, count]) => {
    const historicalCandidates = [...(candidatesByParty.get(party) ?? [])].sort((a, b) => b.firstPreferences - a.firstPreferences);
    const requested = Math.max(0, Math.min(6, Math.floor(count)));
    if (requested === 0) return [];
    const historicalWeights = historicalCandidates.map((candidate) => candidate.withinPartyShare);
    const newCandidateWeight = historicalWeights.length > 0 ? 1 / historicalWeights.length : 1;
    const weights = Array.from({ length: requested }, (_, index) => historicalWeights[index] ?? newCandidateWeight);
    const totalWeight = weights.reduce((sum, value) => sum + value, 0) || requested;
    return weights.map((weight, index) => ({
      id: `${constituencyName}:${party}:${index + 1}`,
      name: `${party} Candidate ${index + 1}`,
      party,
      weight: weight / totalWeight,
    }));
  });
}

function distributeCandidateTransfer(
  source: CandidateState,
  amount: number,
  candidates: CandidateState[],
  transferProfiles: NiAssemblyProjectionData["transfers"],
  sourceType: "elimination" | "surplus",
) {
  const blocProfiles = sourceType === "surplus" ? transferProfiles.surplusByBloc : transferProfiles.eliminationByBloc;
  const profile = transferProfiles[sourceType][source.party] ?? blocProfiles[getProjectionBloc(source.party)];
  const eligible = candidates.filter((candidate) => candidate.status === "running" && candidate.id !== source.id);
  if (!eligible.length || amount <= 0) return { transferred: 0, exhausted: Math.max(0, amount) };

  const destinationMasses = new Map<string, number>();
  for (const candidate of eligible) {
    const mass = profile?.destinations[candidate.party] ?? 0;
    destinationMasses.set(candidate.party, Math.max(destinationMasses.get(candidate.party) ?? 0, mass));
  }
  let massTotal = [...destinationMasses.values()].reduce((sum, value) => sum + value, 0);
  if (massTotal <= 0) {
    for (const candidate of eligible) {
      const sameBloc = getProjectionBloc(candidate.party) === getProjectionBloc(source.party);
      destinationMasses.set(candidate.party, sameBloc ? 2 : 1);
    }
    massTotal = [...destinationMasses.values()].reduce((sum, value) => sum + value, 0);
  }

  const transferable = amount * Math.max(0, Math.min(1, profile?.retention ?? 0.8));
  for (const [party, mass] of destinationMasses) {
    const partyCandidates = eligible.filter((candidate) => candidate.party === party);
    const partyGain = massTotal > 0 ? transferable * mass / massTotal : 0;
    const currentPartyVotes = partyCandidates.reduce((sum, candidate) => sum + candidate.votes, 0);
    for (const candidate of partyCandidates) {
      const candidateWeight = currentPartyVotes > 0 ? candidate.votes / currentPartyVotes : 1 / partyCandidates.length;
      candidate.votes += partyGain * candidateWeight;
    }
  }
  return { transferred: transferable, exhausted: amount - transferable };
}

function runStvCount(
  definitions: CandidateDefinition[],
  firstPreferences: Record<string, number>,
  seats: number,
  validVotes: number,
  transfers: NiAssemblyProjectionData["transfers"],
) {
  const quota = Math.floor(validVotes / (seats + 1)) + 1;
  const candidates: CandidateState[] = definitions.map((candidate) => ({
    ...candidate,
    votes: firstPreferences[candidate.id] ?? 0,
    status: "running",
  }));
  const electedByParty = new Map<string, number>();
  const electedCandidateIds = new Set<string>();
  const snapshot = () => candidates.map(({ name, party, votes, status }) => ({ name, party, votes, status }));
  const stages: NiAssemblyCountStage[] = [{ count: 1, action: "first preferences", candidate: "All candidates", party: "", tally: validVotes, transferred: 0, exhausted: 0, quota, simulationCount: 1, eventFrequencyPercent: 100, candidateTallies: snapshot() }];
  let count = 1;
  const maxCounts = candidates.length * 4 + seats + 10;
  const totalElected = () => [...electedByParty.values()].reduce((sum, value) => sum + value, 0);
  while (totalElected() < seats && count < maxCounts) {
    const seatsLeft = seats - totalElected();
    const continuing = candidates.filter((candidate) => candidate.status === "running");
    if (!continuing.length) break;
    if (continuing.length <= seatsLeft) {
      for (const candidate of continuing) {
        candidate.status = "elected";
        electedCandidateIds.add(candidate.id);
        electedByParty.set(candidate.party, (electedByParty.get(candidate.party) ?? 0) + 1);
        stages.push({ count: ++count, action: "remaining elected", candidate: candidate.name, party: candidate.party, tally: candidate.votes, transferred: 0, exhausted: 0, quota, simulationCount: 1, eventFrequencyPercent: 100, candidateTallies: snapshot() });
      }
      break;
    }

    const qualifying = continuing.filter((candidate) => candidate.votes >= quota)
      .sort((a, b) => b.votes - a.votes || a.id.localeCompare(b.id));
    if (qualifying.length) {
      const candidate = qualifying[0];
      const tally = candidate.votes;
      const surplus = Math.max(0, tally - quota);
      candidate.status = "elected";
      electedCandidateIds.add(candidate.id);
      candidate.votes = quota;
      electedByParty.set(candidate.party, (electedByParty.get(candidate.party) ?? 0) + 1);
      const outcome = distributeCandidateTransfer(candidate, surplus, candidates, transfers, "surplus");
      stages.push({ count: ++count, action: "elected", candidate: candidate.name, party: candidate.party, tally, transferred: outcome.transferred, exhausted: outcome.exhausted, quota, simulationCount: 1, eventFrequencyPercent: 100, candidateTallies: snapshot() });
    } else {
      const candidate = [...continuing].sort((a, b) => a.votes - b.votes || a.id.localeCompare(b.id))[0];
      const tally = candidate.votes;
      candidate.status = "eliminated";
      candidate.votes = 0;
      const outcome = distributeCandidateTransfer(candidate, tally, candidates, transfers, "elimination");
      stages.push({ count: ++count, action: "eliminated", candidate: candidate.name, party: candidate.party, tally, transferred: outcome.transferred, exhausted: outcome.exhausted, quota, simulationCount: 1, eventFrequencyPercent: 100, candidateTallies: snapshot() });
    }
  }
  return { quota, electedByParty, electedCandidateIds, stages };
}

export function runNiAssemblyProjection(data: NiAssemblyProjectionData, settings: NiAssemblySettings): NiAssemblyProjectionResult {
  const partyCodes = data.parties.map((party) => party.code);
  const settingsKey = JSON.stringify(settings);
  const nationalNoiseLocations = Object.fromEntries(partyCodes.map((code) => {
    const mean = settings.support[code] ?? data.parties.find((party) => party.code === code)?.baselineShare ?? 0;
    return [code, positiveNormalLocationForMean(mean, settings.pollingUncertainty)];
  }));
  const nationalSamples = Array.from({ length: settings.iterations }, (_, iteration) => {
    const random = makeRandom(`${settingsKey}:national:${iteration}`);
    return normalize(Object.fromEntries(partyCodes.map((code) => [code,
      Math.max(0, nationalNoiseLocations[code] + random() * settings.pollingUncertainty),
    ])));
  });
  const seatTotalsByIteration = new Map(partyCodes.map((code) => [code, Array(settings.iterations).fill(0) as number[]]));
  const quantile = (values: number[], probability: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * probability)))];
  };
  const constituencyResults = data.constituencies.map((constituency) => {
    const counts = settings.candidateCounts[constituency.name] ?? {};
    const includedCodes = partyCodes.filter((code) => (counts[code] ?? 0) > 0);
    const partyFirstPrefs = Object.fromEntries(includedCodes.map((code) => [code, 0]));
    const partyFirstPrefSamples = Object.fromEntries(includedCodes.map((code) => [code, [] as number[]]));
    const partySeatSums = Object.fromEntries(includedCodes.map((code) => [code, 0]));
    const partySeatSamples = Object.fromEntries(includedCodes.map((code) => [code, [] as number[]]));
    const partyAnySeat = Object.fromEntries(includedCodes.map((code) => [code, 0]));
    const partySeatThresholdCounts = Object.fromEntries(includedCodes.map((code) => [code, Array(constituency.seats).fill(0) as number[]]));
    const partyLeadingCount = Object.fromEntries(includedCodes.map((code) => [code, 0]));
    const activeBlocs = PROJECTION_BLOCS.filter((bloc) => includedCodes.some((code) => getProjectionBloc(code) === bloc));
    const blocSeatSamples = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, [] as number[]])) as Record<ProjectionBloc, number[]>;
    const blocShareSamples = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, [] as number[]])) as Record<ProjectionBloc, number[]>;
    const candidateDefinitions = createCandidateDefinitions(data, constituency.name, counts);
    const candidateStats = new Map(candidateDefinitions.map((candidate) => [candidate.id, { firstPreferenceSum: 0, electedCount: 0 }]));
    const countAggregates = new Map<number, {
      pathCount: number;
      events: Map<string, { action: NiAssemblyCountStage["action"]; candidate: string; party: string; tally: number; transferred: number; exhausted: number; count: number }>;
      candidateTallies: Map<string, { votes: number; statuses: Map<CandidateState["status"], number> }>;
    }>();

    for (let iteration = 0; iteration < settings.iterations; iteration += 1) {
      const random = makeRandom(`${settingsKey}:${constituency.name}:${iteration}`);
      const nationalNoisy = nationalSamples[iteration];
      const nationalBlocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc,
        data.parties.reduce((sum, party) => sum + (getProjectionBloc(party.code) === bloc ? nationalNoisy[party.code] ?? 0 : 0), 0),
      ])) as Record<(typeof PROJECTION_BLOCS)[number], number>;
      const localBlocShares = normalize(Object.fromEntries(activeBlocs.map((bloc) => [
        bloc,
        Math.max(0, nationalBlocShares[bloc] * localBlocRatio(data, constituency.name, bloc) + random() * settings.localVariation / 100),
      ])));
      const localShares: Record<string, number> = {};
      for (const bloc of activeBlocs) {
        const blocParties = includedCodes.filter((code) => getProjectionBloc(code) === bloc);
        const nationalBlocTotal = blocParties.reduce((sum, code) => sum + (nationalNoisy[code] ?? 0), 0);
        const withinBlocShares = normalize(Object.fromEntries(blocParties.map((code) => {
          const nationalWithinBloc = nationalBlocTotal > 0 ? (nationalNoisy[code] / nationalBlocTotal) * 100 : 0;
          const localRatio = partyWithinBlocRatio(data, constituency.name, code);
          return [code, Math.max(0, nationalWithinBloc * localRatio + random() * settings.localVariation)];
        })));
        for (const code of blocParties) localShares[code] = (localBlocShares[bloc] ?? 0) * (withinBlocShares[code] ?? 0);
      }
      const candidateFirstPreferences: Record<string, number> = {};
      for (const code of includedCodes) {
        const votes = localShares[code] * constituency.validVotes;
        const share = votes / constituency.validVotes * 100;
        partyFirstPrefs[code] = (partyFirstPrefs[code] ?? 0) + share;
        partyFirstPrefSamples[code].push(share);
        const partyCandidates = candidateDefinitions.filter((candidate) => candidate.party === code);
        const rawWeights = Object.fromEntries(partyCandidates.map((candidate) => [
          candidate.id,
          Math.max(0.001, candidate.weight + random() * Math.min(0.12, settings.localVariation / 100)),
        ]));
        const totalWeight = Object.values(rawWeights).reduce((sum, value) => sum + value, 0);
        for (const candidate of partyCandidates) {
          const candidateVotes = totalWeight > 0 ? votes * rawWeights[candidate.id] / totalWeight : votes / Math.max(1, partyCandidates.length);
          candidateFirstPreferences[candidate.id] = candidateVotes;
          candidateStats.get(candidate.id)!.firstPreferenceSum += candidateVotes;
        }
      }
      const count = runStvCount(candidateDefinitions, candidateFirstPreferences, constituency.seats, constituency.validVotes, data.transfers);
      const seatsByBloc = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, 0])) as Record<ProjectionBloc, number>;
      for (const [code, seats] of count.electedByParty) seatsByBloc[getProjectionBloc(code)] += seats;
      for (const bloc of PROJECTION_BLOCS) {
        blocSeatSamples[bloc].push(seatsByBloc[bloc]);
        blocShareSamples[bloc].push(includedCodes.reduce((sum, code) => sum + (getProjectionBloc(code) === bloc ? (localShares[code] ?? 0) * 100 : 0), 0));
      }
      for (const stage of count.stages) {
        const aggregate = countAggregates.get(stage.count) ?? {
          pathCount: 0,
          events: new Map(),
          candidateTallies: new Map(),
        };
        aggregate.pathCount += 1;
        const eventKey = `${stage.action}:${stage.candidate}:${stage.party}`;
        const event = aggregate.events.get(eventKey) ?? {
          action: stage.action,
          candidate: stage.candidate,
          party: stage.party,
          tally: 0,
          transferred: 0,
          exhausted: 0,
          count: 0,
        };
        event.tally += stage.tally;
        event.transferred += stage.transferred;
        event.exhausted += stage.exhausted;
        event.count += 1;
        aggregate.events.set(eventKey, event);
        for (const candidateTally of stage.candidateTallies) {
          const candidateAggregate = aggregate.candidateTallies.get(candidateTally.name) ?? { votes: 0, statuses: new Map<CandidateState["status"], number>() };
          candidateAggregate.votes += candidateTally.votes;
          candidateAggregate.statuses.set(candidateTally.status, (candidateAggregate.statuses.get(candidateTally.status) ?? 0) + 1);
          aggregate.candidateTallies.set(candidateTally.name, candidateAggregate);
        }
        countAggregates.set(stage.count, aggregate);
      }
      const largestPartySeats = Math.max(0, ...includedCodes.map((code) => count.electedByParty.get(code) ?? 0));
      const leadingParties = includedCodes.filter((code) => (count.electedByParty.get(code) ?? 0) === largestPartySeats);
      leadingParties.forEach((code) => { partyLeadingCount[code] += 1 / Math.max(1, leadingParties.length); });
      for (const code of includedCodes) {
        const seats = count.electedByParty.get(code) ?? 0;
        partySeatSums[code] = (partySeatSums[code] ?? 0) + seats;
        partySeatSamples[code].push(seats);
        seatTotalsByIteration.get(code)![iteration] += seats;
        if (seats > 0) partyAnySeat[code] += 1;
        for (let thresholdIndex = 0; thresholdIndex < seats; thresholdIndex += 1) {
          partySeatThresholdCounts[code][thresholdIndex] += 1;
        }
      }
      for (const [candidateId, stats] of candidateStats) {
        if (count.electedCandidateIds.has(candidateId)) stats.electedCount += 1;
      }
    }

    const meanCount: NiAssemblyCountStage[] = [...countAggregates.entries()].sort(([a], [b]) => a - b).map(([countNumber, aggregate]) => {
      const mostCommonEvent = [...aggregate.events.values()].sort((a, b) => b.count - a.count || a.candidate.localeCompare(b.candidate))[0];
      return {
        count: countNumber,
        action: mostCommonEvent.action,
        candidate: mostCommonEvent.candidate,
        party: mostCommonEvent.party,
        tally: mostCommonEvent.tally / mostCommonEvent.count,
        transferred: mostCommonEvent.transferred / mostCommonEvent.count,
        exhausted: mostCommonEvent.exhausted / mostCommonEvent.count,
        quota: constituency.quota,
        simulationCount: aggregate.pathCount,
        eventFrequencyPercent: mostCommonEvent.count / aggregate.pathCount * 100,
        candidateTallies: candidateDefinitions.map((candidate) => {
          const candidateAggregate = aggregate.candidateTallies.get(candidate.name);
          const status = [...(candidateAggregate?.statuses.entries() ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "running";
          return {
            name: candidate.name,
            party: candidate.party,
            votes: (candidateAggregate?.votes ?? 0) / Math.max(1, aggregate.pathCount),
            status,
          };
        }),
      };
    });

    const parties = includedCodes.map((code) => {
      const baselineVotes = constituency.firstPreferencesByParty[code] ?? 0;
      const baselineShare = constituency.validVotes > 0 ? baselineVotes / constituency.validVotes * 100 : 0;
      const finalCount = constituency.countHistory[constituency.countHistory.length - 1]?.candidates ?? [];
      const baselineSeats = finalCount.filter((candidate) => candidate.party === code && candidate.status === "elected").length;
      const shareSamples = partyFirstPrefSamples[code];
      const seatSamples = partySeatSamples[code];
      return {
      code,
      firstPreferenceShare: (partyFirstPrefs[code] ?? 0) / settings.iterations,
      firstPreferenceStandardDeviation: standardDeviation(shareSamples),
      baselineShare,
      shareChange: (partyFirstPrefs[code] ?? 0) / settings.iterations - baselineShare,
      firstPreferenceLow: quantile(shareSamples, 0.1),
      firstPreferenceHigh: quantile(shareSamples, 0.9),
      expectedSeats: (partySeatSums[code] ?? 0) / settings.iterations,
      seatStandardDeviation: standardDeviation(seatSamples),
      baselineSeats,
      seatCountProbabilities: outcomeProbabilities(seatSamples, constituency.seats),
      anySeatProbability: (partyAnySeat[code] ?? 0) / settings.iterations * 100,
      seatThresholdProbabilities: partySeatThresholdCounts[code].map((count, index, counts) => {
        const priorSeatCount = index === 0 ? settings.iterations : counts[index - 1] ?? 0;
        return priorSeatCount > 0 ? count / priorSeatCount * 100 : null;
      }),
      candidates: candidateDefinitions.filter((candidate) => candidate.party === code).map((candidate) => {
        const stats = candidateStats.get(candidate.id)!;
        return {
          name: candidate.name,
          meanFirstPreferences: stats.firstPreferenceSum / settings.iterations,
          electionProbability: stats.electedCount / settings.iterations * 100,
        };
      }),
    }; }).sort((a, b) => b.expectedSeats - a.expectedSeats || b.firstPreferenceShare - a.firstPreferenceShare);
    const blocOutcomes = PROJECTION_BLOCS.map((bloc) => {
      const baselineShare = constituency.validVotes > 0
        ? Object.entries(constituency.firstPreferencesByParty).reduce((sum, [code, votes]) => sum + (getProjectionBloc(code) === bloc ? votes / constituency.validVotes * 100 : 0), 0)
        : 0;
      const baselineSeats = (constituency.countHistory[constituency.countHistory.length - 1]?.candidates ?? [])
        .filter((candidate) => candidate.status === "elected" && getProjectionBloc(candidate.party) === bloc).length;
      const shares = blocShareSamples[bloc];
      const seatSamples = blocSeatSamples[bloc];
      const share = shares.reduce((sum, value) => sum + value, 0) / Math.max(1, shares.length);
      const expectedSeats = seatSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, seatSamples.length);
      return {
        code: bloc,
        share,
        shareStandardDeviation: standardDeviation(shares),
        baselineShare,
        shareChange: share - baselineShare,
        expectedSeats,
        seatStandardDeviation: standardDeviation(seatSamples),
        baselineSeats,
        seatCountProbabilities: outcomeProbabilities(seatSamples, constituency.seats),
      };
    });
    const topFiveSeatsByParty = Object.fromEntries(includedCodes.map((code) => [code, 0]));
    parties.flatMap((party) => party.candidates.map((candidate) => ({ party: party.code, candidate })))
      .sort((a, b) => b.candidate.electionProbability - a.candidate.electionProbability
        || b.candidate.meanFirstPreferences - a.candidate.meanFirstPreferences
        || a.party.localeCompare(b.party)
        || a.candidate.name.localeCompare(b.candidate.name))
      .slice(0, constituency.seats)
      .forEach(({ party }) => { topFiveSeatsByParty[party] += 1; });

    return {
      name: constituency.name,
      seats: constituency.seats,
      quota: constituency.quota,
      validVotes: constituency.validVotes,
      parties,
      topFiveSeatsByParty,
      blocOutcomes,
      meanCount,
      leadingParty: [...includedCodes].sort((a, b) => partyLeadingCount[b] - partyLeadingCount[a]
        || (partySeatSums[b] ?? 0) - (partySeatSums[a] ?? 0)
        || a.localeCompare(b))[0] ?? "",
      leadingPartyProbability: Object.fromEntries(includedCodes.map((code) => [code, partyLeadingCount[code] / settings.iterations * 100])),
    };
  });

  const largestPartyCounts = Object.fromEntries(partyCodes.map((code) => [code, 0]));
  for (const samples of Array.from({ length: settings.iterations }, (_, iteration) =>
    partyCodes.map((code) => [code, seatTotalsByIteration.get(code)![iteration]] as const))) {
    const maximum = Math.max(0, ...samples.map(([, seats]) => seats));
    const leaders = samples.filter(([, seats]) => seats === maximum);
    leaders.forEach(([code]) => { largestPartyCounts[code] += 1 / Math.max(1, leaders.length); });
  }
  const blocSeatSamples = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, Array.from({ length: settings.iterations }, (_, iteration) =>
    partyCodes.reduce((sum, code) => sum + (getProjectionBloc(code) === bloc ? seatTotalsByIteration.get(code)![iteration] : 0), 0),
  )])) as Record<ProjectionBloc, number[]>;
  const blocShareSamples = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, nationalSamples.map((sample) =>
    partyCodes.reduce((sum, code) => sum + (getProjectionBloc(code) === bloc ? (sample[code] ?? 0) * 100 : 0), 0),
  )])) as Record<ProjectionBloc, number[]>;
  const blocStandings = PROJECTION_BLOCS.map((bloc) => {
    const baselineShare = Object.entries(data.nationalShareByYear["2022"]).reduce((sum, [code, share]) => sum + (getProjectionBloc(code) === bloc ? share : 0), 0);
    const baselineSeats = data.parties.filter((party) => getProjectionBloc(party.code) === bloc).reduce((sum, party) => sum + party.baselineSeats, 0);
    const shares = blocShareSamples[bloc];
    const seats = blocSeatSamples[bloc];
    const meanShare = shares.reduce((sum, value) => sum + value, 0) / Math.max(1, shares.length);
    return {
      code: bloc,
      share: meanShare,
      shareStandardDeviation: standardDeviation(shares),
      baselineShare,
      shareChange: meanShare - baselineShare,
      expectedSeats: seats.reduce((sum, value) => sum + value, 0) / Math.max(1, seats.length),
      seatStandardDeviation: standardDeviation(seats),
      baselineSeats,
      seatCountProbabilities: outcomeProbabilities(seats, data.seats),
    };
  });
  const standings = partyCodes.map((code) => {
    const samples = seatTotalsByIteration.get(code) ?? [];
    const expectedSeats = samples.reduce((sum, value) => sum + value, 0) / Math.max(1, samples.length);
    const topFiveSeats = constituencyResults.reduce((sum, constituency) => sum + (constituency.topFiveSeatsByParty[code] ?? 0), 0);
    const shareSamples = nationalSamples.map((sample) => (sample[code] ?? 0) * 100);
    const projectedShare = shareSamples.reduce((sum, value) => sum + value, 0) / Math.max(1, shareSamples.length);
    const baselineShare = data.nationalShareByYear["2022"][code] ?? 0;
    const baselineSeats = data.parties.find((party) => party.code === code)?.baselineSeats ?? 0;
    return {
      code,
      expectedSeats,
      seatStandardDeviation: standardDeviation(samples),
      seatCountProbabilities: outcomeProbabilities(samples, data.seats),
      topFiveSeats,
      medianSeats: quantile(samples, 0.5),
      lowSeats: quantile(samples, 0.1),
      highSeats: quantile(samples, 0.9),
      baselineSeats,
      seatChange: expectedSeats - baselineSeats,
      projectedShare,
      shareStandardDeviation: standardDeviation(shareSamples),
      baselineShare,
      shareChange: projectedShare - baselineShare,
      largestPartyProbability: largestPartyCounts[code] / settings.iterations * 100,
    };
  }).sort((a, b) => b.expectedSeats - a.expectedSeats || a.code.localeCompare(b.code));
  return { iterations: settings.iterations, constituencies: constituencyResults, standings, blocStandings };
}
