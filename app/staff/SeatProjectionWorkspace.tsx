"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import { getProjectionBloc, PROJECTION_BLOCS, type ProjectionBloc } from "@/lib/staff/projectionBlocs";
import ProjectionMap from "./ProjectionMap";
import ProjectionModelSwitcher from "./ProjectionModelSwitcher";
import ProjectionScenarioManager from "./ProjectionScenarioManager";
import ProjectionDistributionCharts, { type DistributionSeries, type DistributionScope } from "./ProjectionDistributionCharts";
import type { ProjectionScenarioPreset } from "./ProjectionScenarioManager";
import type { ProjectionSupportPresets } from "@/lib/staff/projectionSupportPresets";
import type {
  SeatProjectionData,
  SeatProjectionBaseline,
  SeatProjectionParty,
  SeatProjectionConstituency as BaselineConstituency,
  AssemblyProjectionYear,
  WestminsterProjectionYear,
} from "@/lib/staff/seatProjectionData";

type Props = { data: SeatProjectionData; supportPresets: ProjectionSupportPresets };

type InterBlocTacticalVoting = {
  nationalistToNonAligned: number;
  nonAlignedToNationalist: number;
  unionistToNonAligned: number;
  nonAlignedToUnionist: number;
};

type ProjectionSettings = {
  support: Record<string, string>;
  pollError: number;
  localVariation: number;
  previousResultWeight: number;
  partyPresence: Record<string, string[]>;
  tacticalVoting: Record<ProjectionBloc, number>;
  interBlocTacticalVoting: InterBlocTacticalVoting;
};

type ProjectionMode = "current" | "backtest-2024";

function createDefaultProjectionSettings(
  data: SeatProjectionBaseline,
  supportSource: SeatProjectionBaseline = data,
): ProjectionSettings {
  const supportByCode = new Map(supportSource.parties.map((party) => [party.code, party.baselineShare]));
  return {
    support: Object.fromEntries(data.parties.map((party) => [party.code, (supportByCode.get(party.code) ?? party.baselineShare).toFixed(1)])),
    pollError: 2,
    localVariation: 2,
    previousResultWeight: 0,
    partyPresence: Object.fromEntries(data.constituencies.map((constituency) => [constituency.name, constituency.contestantCodes])),
    tacticalVoting: { Nationalist: 0, Unionist: 0, "Non-aligned": 0 },
    interBlocTacticalVoting: { nationalistToNonAligned: 0, nonAlignedToNationalist: 0, unionistToNonAligned: 0, nonAlignedToUnionist: 0 },
  };
}

type ProjectedConstituency = SeatProjectionData["constituencies"][number] & {
  projected: Array<{
    code: string;
    bloc: ProjectionBloc;
    share: number;
    shareStandardDeviation: number;
    baselineShare: number;
    shareChange: number;
    shareLow: number;
    shareHigh: number;
    withinBlocShare: number;
    baselineLocalNationalRatio: number;
    hasBaselineResult: boolean;
    historicalWithinBlocRatio: number | null;
  }>;
  winner: string;
  runnerUp: string;
  margin: number;
  winProbability: Record<string, number>;
  projectedBlocShares: Record<ProjectionBloc, number>;
  blocOutcomes: Array<{ code: ProjectionBloc; share: number; shareStandardDeviation: number; baselineShare: number; shareChange: number; expectedSeats: number; seatStandardDeviation: number; baselineSeats: number; seatCountProbabilities: Array<{ outcome: number; probability: number }> }>;
};

type ProjectionOutcomeProbability = { outcome: number; probability: number };
type ProjectionBlocSummary = { code: ProjectionBloc; share: number; shareStandardDeviation: number; baselineShare: number; shareChange: number; expectedSeats: number; seatStandardDeviation: number; baselineSeats: number; seatCountProbabilities: ProjectionOutcomeProbability[] };

function createNormalGenerator(seedText: string) {
  let state = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    state = Math.imul(state ^ seedText.charCodeAt(index), 16777619);
  }
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

function enteredTotalShare(values: Record<string, number>, partyCode: string) {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return total > 0 ? ((values[partyCode] ?? 0) / total) * 100 : 0;
}

function textColorForPartyColor(color: string) {
  const hex = color.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(hex)) return "#172326";
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.42 ? "#172326" : "#ffffff";
}

function formatHistoricalShare(value: number | undefined) {
  return value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function formatSignedPoints(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function blocShareFromParties(shares: Record<string, number>, bloc: ProjectionBloc) {
  return Object.entries(shares).reduce(
    (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
    0,
  );
}

function quantile(values: number[], fraction: number) {
  const index = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * fraction)));
  return values[index] ?? 0;
}

function standardDeviation(values: number[]) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function outcomeProbabilities(values: number[], maximum: number): ProjectionOutcomeProbability[] {
  return Array.from({ length: maximum + 1 }, (_, outcome) => ({
    outcome,
    probability: values.length ? values.filter((value) => value === outcome).length / values.length * 100 : 0,
  }));
}

function smoothedSimulationChance(wins: number, iterations: number, outcomes: number) {
  return ((wins + 1) / (iterations + outcomes)) * 100;
}

function normalizeBlocShares(shares: Record<ProjectionBloc, number>, fallback: Record<ProjectionBloc, number>) {
  const total = PROJECTION_BLOCS.reduce((sum, bloc) => sum + Math.max(0, shares[bloc]), 0);
  const source = total > 0 ? shares : fallback;
  const sourceTotal = PROJECTION_BLOCS.reduce((sum, bloc) => sum + Math.max(0, source[bloc]), 0);
  return Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
    bloc,
    sourceTotal > 0 ? (Math.max(0, source[bloc]) / sourceTotal) * 100 : 0,
  ])) as Record<ProjectionBloc, number>;
}

function applyInterBlocTacticalVoting(
  blocShares: Record<ProjectionBloc, number>,
  parties: Array<{ code: string; bloc: ProjectionBloc; withinBlocShare: number }>,
  flows: InterBlocTacticalVoting,
  competitivenessMargin: number,
) {
  const routes: Array<{ from: ProjectionBloc; to: ProjectionBloc; rate: number }> = [
    { from: "Nationalist", to: "Non-aligned", rate: flows.nationalistToNonAligned },
    { from: "Non-aligned", to: "Nationalist", rate: flows.nonAlignedToNationalist },
    { from: "Unionist", to: "Non-aligned", rate: flows.unionistToNonAligned },
    { from: "Non-aligned", to: "Unionist", rate: flows.nonAlignedToUnionist },
  ];
  const outgoing = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, 0])) as Record<ProjectionBloc, number>;
  const incoming = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, 0])) as Record<ProjectionBloc, number>;
  const tacticalTargets: Partial<Record<ProjectionBloc, string>> = {};
  const rankedCandidates = parties
    .map((party) => ({ ...party, projectedShare: blocShares[party.bloc] * party.withinBlocShare }))
    .sort((a, b) => b.projectedShare - a.projectedShare || a.code.localeCompare(b.code));
  const leader = rankedCandidates[0];
  const runnerUp = rankedCandidates[1];
  if (!leader || !runnerUp || leader.bloc === runnerUp.bloc) {
    const partyShares = Object.fromEntries(parties.map((party) => [
      party.code,
      blocShares[party.bloc] * party.withinBlocShare,
    ])) as Record<string, number>;
    return { partyShares, blocShares };
  }
  for (const route of routes) {
    if (route.rate <= 0 || !parties.some((party) => party.bloc === route.from)) continue;
    const targetParties = parties.filter((party) => party.bloc === route.to);
    if (targetParties.length === 0) continue;
    const target = [...targetParties].sort((a, b) => b.withinBlocShare - a.withinBlocShare || a.code.localeCompare(b.code))[0];
    if (runnerUp.code !== target.code || leader.projectedShare - runnerUp.projectedShare > competitivenessMargin) continue;
    const amount = blocShares[route.from] * route.rate / 100;
    outgoing[route.from] += amount;
    incoming[route.to] += amount;
    tacticalTargets[route.to] = target.code;
  }
  const partyShares = Object.fromEntries(parties.map((party) => [
    party.code,
    Math.max(0, blocShares[party.bloc] - outgoing[party.bloc]) * party.withinBlocShare
      + (tacticalTargets[party.bloc] === party.code ? incoming[party.bloc] : 0),
  ])) as Record<string, number>;
  const adjustedBlocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
    bloc,
    parties.filter((party) => party.bloc === bloc).reduce((sum, party) => sum + partyShares[party.code], 0),
  ])) as Record<ProjectionBloc, number>;
  return { partyShares, blocShares: adjustedBlocShares };
}

function applyWithinBlocTacticalVoting<T extends { code: string; bloc: ProjectionBloc; withinBlocShare: number }>(
  parties: T[],
  blocShares: Record<ProjectionBloc, number>,
  rates: Record<ProjectionBloc, number>,
): Array<T & { withinBlocShare: number }> {
  const rankedCandidates = parties
    .map((party) => ({ ...party, projectedShare: blocShares[party.bloc] * party.withinBlocShare }))
    .sort((a, b) => b.projectedShare - a.projectedShare || a.code.localeCompare(b.code));
  const leader = rankedCandidates[0];
  const runnerUp = rankedCandidates[1];
  if (!leader || !runnerUp || leader.bloc === runnerUp.bloc) return parties;

  const adjustedShares = new Map(parties.map((party) => [party.code, party.withinBlocShare]));
  for (const bloc of PROJECTION_BLOCS) {
    const rate = rates[bloc] / 100;
    if (rate <= 0) continue;
    const blocParties = parties.filter((party) => party.bloc === bloc);
    const blocLeader = [...blocParties].sort((a, b) => b.withinBlocShare - a.withinBlocShare || a.code.localeCompare(b.code))[0];
    if (!blocLeader) continue;
    const transfer = blocParties
      .filter((party) => party.code !== blocLeader.code)
      .reduce((sum, party) => sum + party.withinBlocShare * rate, 0);
    blocParties.forEach((party) => adjustedShares.set(
      party.code,
      party.code === blocLeader.code
        ? party.withinBlocShare + transfer
        : party.withinBlocShare * (1 - rate),
    ));
  }
  return parties.map((party) => ({ ...party, withinBlocShare: adjustedShares.get(party.code) ?? party.withinBlocShare }));
}

function perturbWithinBlocPartyShares(
  parties: Array<{ code: string; bloc: ProjectionBloc; withinBlocShare: number }>,
  variation: number,
  normal: () => number,
) {
  const noisy = parties.map((party) => ({
    ...party,
    noisyShare: Math.max(0, party.withinBlocShare * 100 + normal() * variation),
  }));
  const blocTotals: Record<ProjectionBloc, number> = { Nationalist: 0, Unionist: 0, "Non-aligned": 0 };
  noisy.forEach((party) => { blocTotals[party.bloc] += party.noisyShare; });
  return noisy.map((party) => {
    const blocTotal = blocTotals[party.bloc];
    return {
      code: party.code,
      bloc: party.bloc,
      withinBlocShare: blocTotal > 0 ? party.noisyShare / blocTotal : party.withinBlocShare,
    };
  });
}

const HISTORICAL_WESTMINSTER_WEIGHTS: Record<WestminsterProjectionYear, number> = {
  "2019": 0.375,
  "2017": 0.225,
  "2015": 0.15,
};
const HISTORICAL_ASSEMBLY_WEIGHTS: Record<AssemblyProjectionYear, number> = {
  "2022": 0.175,
  "2017": 0.075,
};

const SIMULATION_ITERATIONS = 10_000;

function historicalBlocLocalOffset(
  constituency: BaselineConstituency,
  bloc: ProjectionBloc,
  data: SeatProjectionBaseline,
) {
  const historicalSources = [
    ...Object.entries(HISTORICAL_WESTMINSTER_WEIGHTS).filter(([year]) => Number(year) < Number(data.baselineYear)).map(([year, weight]) => {
      const cycle = year as WestminsterProjectionYear;
      const localShares = constituency.historicalPartyShares[cycle];
      return {
        localShare: Object.entries(localShares).reduce(
          (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
          0,
        ),
        hasLocalContest: Object.keys(localShares).some((party) => getProjectionBloc(party) === bloc),
        nationalShare: Object.entries(data.historicalNationalShares[cycle]).reduce(
          (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
          0,
        ),
        weight,
      };
    }),
    ...Object.entries(HISTORICAL_ASSEMBLY_WEIGHTS).map(([year, weight]) => {
      const cycle = year as AssemblyProjectionYear;
      const localShares = constituency.assemblyPartyShares[cycle];
      return {
        localShare: Object.entries(localShares).reduce(
          (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
          0,
        ),
        hasLocalContest: Object.keys(localShares).some((party) => getProjectionBloc(party) === bloc),
        nationalShare: Object.entries(data.assemblyNationalShares[cycle]).reduce(
          (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
          0,
        ),
        weight,
      };
    }),
  ];
  // No local candidate means the bloc's local support was unobserved, not zero.
  const availableSources = historicalSources.filter((source) => source.nationalShare > 0 && source.hasLocalContest);
  return availableSources.length > 0
    ? availableSources.reduce((sum, source) => sum + (source.localShare - source.nationalShare) * source.weight, 0)
      / availableSources.reduce((sum, source) => sum + source.weight, 0)
    : 0;
}

function localBlocSwingMultiplier(
  constituency: BaselineConstituency,
  bloc: ProjectionBloc,
  data: SeatProjectionBaseline,
  previousWeight: number,
) {
  const latest = constituency.blocShares[bloc] - data.baselineBlocShares[bloc];
  const historical = historicalBlocLocalOffset(constituency, bloc, data);
  const historicalAdjustment = (historical - latest) * (previousWeight / 100);
  return Math.min(1.75, Math.max(0.25, 1 + historicalAdjustment / 100));
}

function localBlocBaselineShare(constituency: BaselineConstituency, bloc: ProjectionBloc, data: SeatProjectionBaseline) {
  if (data.baselineYear === "2024" && constituency.blocShares[bloc] > 0) return constituency.blocShares[bloc];

  const ratioSources: Array<{ localShare: number; nationalShare: number; weight: number }> = [];
  const baselineWeight = HISTORICAL_WESTMINSTER_WEIGHTS[data.baselineYear as WestminsterProjectionYear];
  if (baselineWeight && constituency.blocShares[bloc] > 0 && data.baselineBlocShares[bloc] > 0) {
    ratioSources.push({
      localShare: constituency.blocShares[bloc],
      nationalShare: data.baselineBlocShares[bloc],
      weight: baselineWeight,
    });
  }
  for (const [year, weight] of Object.entries(HISTORICAL_WESTMINSTER_WEIGHTS).filter(([year]) => Number(year) < Number(data.baselineYear))) {
    const cycle = year as WestminsterProjectionYear;
    const localShare = Object.entries(constituency.historicalPartyShares[cycle]).reduce(
      (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0), 0,
    );
    const hasLocalContest = Object.keys(constituency.historicalPartyShares[cycle]).some((party) => getProjectionBloc(party) === bloc);
    const nationalShare = Object.entries(data.historicalNationalShares[cycle]).reduce(
      (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0), 0,
    );
    if (nationalShare > 0 && hasLocalContest) ratioSources.push({ localShare, nationalShare, weight });
  }
  for (const [year, weight] of Object.entries(HISTORICAL_ASSEMBLY_WEIGHTS)) {
    const cycle = year as AssemblyProjectionYear;
    const localShare = Object.entries(constituency.assemblyPartyShares[cycle]).reduce(
      (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0), 0,
    );
    const hasLocalContest = Object.keys(constituency.assemblyPartyShares[cycle]).some((party) => getProjectionBloc(party) === bloc);
    const nationalShare = Object.entries(data.assemblyNationalShares[cycle]).reduce(
      (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0), 0,
    );
    if (nationalShare > 0 && hasLocalContest) ratioSources.push({ localShare, nationalShare, weight });
  }
  const totalWeight = ratioSources.reduce((sum, source) => sum + source.weight, 0);
  if (totalWeight > 0) {
    const localNationalRatio = ratioSources.reduce(
      (sum, source) => sum + (source.localShare / source.nationalShare) * source.weight, 0,
    ) / totalWeight;
    return Math.max(0, Math.min(100, data.baselineBlocShares[bloc] * localNationalRatio));
  }
  if (constituency.blocShares[bloc] > 0) return constituency.blocShares[bloc];
  return Math.max(0, Math.min(100, data.baselineBlocShares[bloc] + historicalBlocLocalOffset(constituency, bloc, data)));
}

function localWithinBlocRatio(
  partyCode: string,
  bloc: ProjectionBloc,
  constituency: BaselineConstituency,
  data: SeatProjectionBaseline,
) {
  const sources: Array<{ localShare: number; nationalShare: number; localBloc: number; nationalBloc: number; weight: number }> = [];
  const coverageWeight = (cycle: string, source: "westminster" | "assembly") => {
    const availableSeats = data.constituencies.filter((item) => {
      const shares = source === "westminster"
        ? item.historicalPartyShares[cycle as WestminsterProjectionYear]
        : item.assemblyPartyShares[cycle as AssemblyProjectionYear];
      return Object.hasOwn(shares, partyCode);
    }).length;
    const coverage = data.constituencies.length > 0 ? availableSeats / data.constituencies.length : 1;
    return Math.sqrt(coverage);
  };
  const baselineWeight = HISTORICAL_WESTMINSTER_WEIGHTS[data.baselineYear as WestminsterProjectionYear];
  const baselinePartyShare = data.parties.find((party) => party.code === partyCode)?.baselineShare;
  if (
    baselineWeight
    && Object.hasOwn(constituency.partyShares, partyCode)
    && baselinePartyShare !== undefined
  ) {
    sources.push({
      localShare: constituency.partyShares[partyCode],
      nationalShare: baselinePartyShare,
      localBloc: constituency.blocShares[bloc],
      nationalBloc: data.baselineBlocShares[bloc],
      weight: baselineWeight * coverageWeight(data.baselineYear, "westminster"),
    });
  }
  for (const [year, weight] of Object.entries(HISTORICAL_WESTMINSTER_WEIGHTS).filter(([year]) => Number(year) < Number(data.baselineYear))) {
    const cycle = year as WestminsterProjectionYear;
    const localShares = constituency.historicalPartyShares[cycle];
    const nationalShares = data.historicalNationalShares[cycle];
    if (localShares[partyCode] === undefined || nationalShares[partyCode] === undefined) continue;
    sources.push({
      localShare: localShares[partyCode],
      nationalShare: nationalShares[partyCode],
      localBloc: Object.entries(localShares).reduce(
        (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
        0,
      ),
      nationalBloc: Object.entries(nationalShares).reduce(
        (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
        0,
      ),
      weight: weight * coverageWeight(year, "westminster"),
    });
  }

  for (const [year, weight] of Object.entries(HISTORICAL_ASSEMBLY_WEIGHTS)) {
    const cycle = year as AssemblyProjectionYear;
    const localShares = constituency.assemblyPartyShares[cycle];
    const nationalShares = data.assemblyNationalShares[cycle];
    if (localShares[partyCode] === undefined || nationalShares[partyCode] === undefined) continue;
    sources.push({
      localShare: localShares[partyCode],
      nationalShare: nationalShares[partyCode],
      localBloc: Object.entries(localShares).reduce(
        (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
        0,
      ),
      nationalBloc: Object.entries(nationalShares).reduce(
        (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
        0,
      ),
      weight: weight * coverageWeight(year, "assembly"),
    });
  }

  const comparableSources = sources.filter((source) => source.localBloc > 0 && source.nationalBloc > 0 && source.nationalShare > 0);
  const totalWeight = comparableSources.reduce((sum, source) => sum + source.weight, 0);
  return totalWeight > 0
    ? comparableSources.reduce((sum, source) => sum + (
      (source.localShare / source.localBloc) / (source.nationalShare / source.nationalBloc)
    ) * source.weight, 0) / totalWeight
    : null;
}

function localPartyProfile(
  party: SeatProjectionParty,
  constituency: BaselineConstituency,
  data: SeatProjectionBaseline,
  previousWeight: number,
) {
  const latestShare = constituency.partyShares[party.code] ?? 0;
  const hasBaselineResult = Object.hasOwn(constituency.partyShares, party.code);
  const localBlocShare = constituency.blocShares[party.bloc];
  const nationalBlocShare = data.baselineBlocShares[party.bloc];
  const latestNationalRatio = nationalBlocShare > 0 ? (party.baselineShare / nationalBlocShare) * 100 : 0;
  const historicalWithinBlocRatio = localWithinBlocRatio(party.code, party.bloc, constituency, data);
  const observedLocalRatio = localBlocShare > 0 ? (latestShare / localBlocShare) * 100 : 0;
  const observedLocalNationalRatio = latestNationalRatio > 0 ? observedLocalRatio / latestNationalRatio : 1;
  // In current mode, keep a party's observed 2024 local strength as the starting point.
  // Historical ratios still inform swing sensitivity and fill in for parties absent from the baseline.
  const localPerformanceRatio = data.baselineYear === "2024" && hasBaselineResult
    ? observedLocalNationalRatio
    : historicalWithinBlocRatio ?? (hasBaselineResult ? observedLocalNationalRatio : 1);
  const latestLocalRatio = latestNationalRatio * localPerformanceRatio;
  const historicalSwingRatio = historicalWithinBlocRatio !== null && observedLocalNationalRatio > 0
    ? historicalWithinBlocRatio / observedLocalNationalRatio
    : 1;
  const withinBlocSensitivity = Math.min(
    1.75,
    Math.max(0.25, Math.pow(Math.max(0.01, historicalSwingRatio), previousWeight / 100)),
  );

  return {
    baselineLocalNationalRatio: observedLocalNationalRatio,
    hasBaselineResult,
    latestLocalRatio,
    latestNationalRatio,
    historicalWithinBlocRatio,
    withinBlocSensitivity,
  };
}

export default function SeatProjectionWorkspace({ data, supportPresets }: Props) {
  const [draftProjectionMode, setDraftProjectionMode] = useState<ProjectionMode>("current");
  const [appliedProjectionMode, setAppliedProjectionMode] = useState<ProjectionMode>("current");
  const [support, setSupport] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.parties.map((party) => [party.code, party.baselineShare.toFixed(1)])),
  );
  const [pollError, setPollError] = useState(2);
  const [localVariation, setLocalVariation] = useState(2);
  const [previousResultWeight, setPreviousResultWeight] = useState(0);
  const [partyPresence, setPartyPresence] = useState<Record<string, string[]>>(() => Object.fromEntries(
    data.constituencies.map((constituency) => [constituency.name, Object.keys(constituency.partyShares)]),
  ));
  const [selectedConstituency, setSelectedConstituency] = useState("all");
  const [tacticalVoting, setTacticalVoting] = useState<Record<ProjectionBloc, number>>({
    Nationalist: 0,
    Unionist: 0,
    "Non-aligned": 0,
  });
  const [interBlocTacticalVoting, setInterBlocTacticalVoting] = useState<InterBlocTacticalVoting>({
    nationalistToNonAligned: 0,
    nonAlignedToNationalist: 0,
    unionistToNonAligned: 0,
    nonAlignedToUnionist: 0,
  });
  const [appliedSettings, setAppliedSettings] = useState<ProjectionSettings>(() => ({
    support: Object.fromEntries(data.parties.map((party) => [party.code, party.baselineShare.toFixed(1)])),
    pollError: 2,
    localVariation: 2,
    previousResultWeight: 0,
    partyPresence: Object.fromEntries(data.constituencies.map((constituency) => [constituency.name, constituency.contestantCodes])),
    tacticalVoting: { Nationalist: 0, Unionist: 0, "Non-aligned": 0 },
    interBlocTacticalVoting: { nationalistToNonAligned: 0, nonAlignedToNationalist: 0, unionistToNonAligned: 0, nonAlignedToUnionist: 0 },
  }));
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [reportExportError, setReportExportError] = useState("");
  const [generatedReport, setGeneratedReport] = useState<{ url: string; filename: string } | null>(null);
  const [hasRunProjection, setHasRunProjection] = useState(false);
  useEffect(() => {
    if (!generatedReport) return;
    const timeout = window.setTimeout(() => setGeneratedReport(null), 10 * 60 * 1000);
    return () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(generatedReport.url);
    };
  }, [generatedReport]);
  const modelData = appliedProjectionMode === "backtest-2024" ? data.backtestBaseline : data;
  const totalSeats = modelData.constituencies.reduce((sum, constituency) => sum + constituency.seats, 0);
  const draftData = draftProjectionMode === "backtest-2024" ? data.backtestBaseline : data;
  const historicalWestminsterYears = (["2019", "2017", "2015"] as const)
    .filter((year) => Number(year) < Number(modelData.baselineYear));

  const draftSettings: ProjectionSettings = {
    support,
    pollError,
    localVariation,
    previousResultWeight,
    partyPresence,
    tacticalVoting,
    interBlocTacticalVoting,
  };
  const presetDefaults = createDefaultProjectionSettings(draftData, draftData);
  const withSupport = (supportValues: Record<string, number>) => ({
    projectionMode: draftProjectionMode,
    settings: {
      ...presetDefaults,
      support: Object.fromEntries(draftData.parties.map((party) => [party.code, String(supportValues[party.code] ?? 0)])),
    },
  });
  const scenarioPresets: ProjectionScenarioPreset[] = [
    { id: "last-election", label: `Last election result · ${draftData.baselineYear}`, settings: withSupport(Object.fromEntries(draftData.parties.map((party) => [party.code, party.baselineShare]))) },
    { id: "most-recent-poll", label: `Most recent NI poll · ${supportPresets.mostRecentPoll.date}`, settings: withSupport(supportPresets.mostRecentPoll.support) },
    { id: "polling-aggregate", label: `Ireland Votes polling aggregate · ${supportPresets.pollingAggregate.date}`, settings: withSupport(supportPresets.pollingAggregate.support) },
  ];
  const defaultSettings = createDefaultProjectionSettings(draftData, draftProjectionMode === "backtest-2024" ? data : draftData);
  const isDefaultSettings = JSON.stringify(draftSettings) === JSON.stringify(defaultSettings);
  const hasUnappliedChanges = draftProjectionMode !== appliedProjectionMode || JSON.stringify(draftSettings) !== JSON.stringify(appliedSettings);
  const draftSupportValues = Object.fromEntries(draftData.parties.map((party) => [
    party.code,
    Math.min(100, Math.max(0, Number(support[party.code]) || 0)),
  ]));
  const draftEnteredTotal = Object.values(draftSupportValues).reduce((sum, value) => sum + value, 0);
  const draftNormalizedSupport = Object.fromEntries(draftData.parties.map((party) => [
    party.code,
    draftEnteredTotal > 0 ? (draftSupportValues[party.code] / draftEnteredTotal) * 100 : party.baselineShare,
  ]));
  const draftInputBlocShares = normalizeBlocShares(
    Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
      bloc,
      draftData.parties.reduce((sum, party) => sum + (party.bloc === bloc ? draftNormalizedSupport[party.code] : 0), 0),
    ])) as Record<ProjectionBloc, number>,
    draftData.baselineBlocShares,
  );

  const projection = useMemo(() => {
    const {
      support: appliedSupport,
      pollError: appliedPollError,
      localVariation: appliedLocalVariation,
      previousResultWeight: appliedPreviousResultWeight,
      partyPresence: appliedPartyPresence,
      tacticalVoting: appliedTacticalVoting,
      interBlocTacticalVoting: appliedInterBlocTacticalVoting,
    } = appliedSettings;
    const supportValues = Object.fromEntries(
      modelData.parties.map((party) => [party.code, Math.min(100, Math.max(0, Number(appliedSupport[party.code]) || 0))]),
    );
    const enteredTotal = Object.values(supportValues).reduce((sum, value) => sum + value, 0);
    const normalizedSupport = Object.fromEntries(modelData.parties.map((party) => [
      party.code,
      enteredTotal > 0 ? (supportValues[party.code] / enteredTotal) * 100 : party.baselineShare,
    ]));
    const inputBlocShares = normalizeBlocShares(
      Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
        bloc,
        modelData.parties.reduce((sum, party) => sum + (party.bloc === bloc ? normalizedSupport[party.code] : 0), 0),
      ])) as Record<ProjectionBloc, number>,
      modelData.baselineBlocShares,
    );
    const tacticalCompetitivenessMargin = 2 * Math.hypot(appliedPollError, appliedLocalVariation);
    const pointEstimates = modelData.constituencies.map((constituency) => {
      const includedParties = modelData.parties.filter((party) => appliedPartyPresence[constituency.name]?.includes(party.code));
      const availableBlocs = new Set(includedParties.map((party) => party.bloc));
      const projectedBlocBaseline = (bloc: ProjectionBloc) => localBlocBaselineShare(constituency, bloc, modelData);
      const blocShares = normalizeBlocShares(
        Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
          bloc,
          availableBlocs.has(bloc)
            ? Math.max(0, projectedBlocBaseline(bloc)
              + (inputBlocShares[bloc] - modelData.baselineBlocShares[bloc])
                * localBlocSwingMultiplier(constituency, bloc, modelData, appliedPreviousResultWeight))
            : 0,
        ])) as Record<ProjectionBloc, number>,
        Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, availableBlocs.has(bloc) ? constituency.blocShares[bloc] : 0])) as Record<ProjectionBloc, number>,
      );
      const adjusted = includedParties.map((party) => {
        const profile = localPartyProfile(party, constituency, modelData, appliedPreviousResultWeight);
        const nationalBlocShare = inputBlocShares[party.bloc];
        const partyWithinBloc = nationalBlocShare > 0
          ? (normalizedSupport[party.code] / nationalBlocShare) * 100
          : modelData.baselineBlocShares[party.bloc] > 0
            ? (party.baselineShare / modelData.baselineBlocShares[party.bloc]) * 100
            : 0;
        const localStartingRatio = !profile.hasBaselineResult && profile.latestNationalRatio === 0
          ? partyWithinBloc * (profile.historicalWithinBlocRatio ?? 1)
          : profile.latestLocalRatio;
        const nationalMovementRatio = profile.latestNationalRatio > 0
          ? partyWithinBloc / profile.latestNationalRatio
          : partyWithinBloc > 0 ? 1 : 0;
        return {
          code: party.code,
          bloc: party.bloc,
          rawWithinBlocShare: Math.max(partyWithinBloc > 0 ? 0.1 : 0, localStartingRatio
            * Math.pow(Math.max(0, nationalMovementRatio), profile.withinBlocSensitivity)),
          baselineLocalNationalRatio: profile.baselineLocalNationalRatio,
          hasBaselineResult: profile.hasBaselineResult,
          historicalWithinBlocRatio: profile.historicalWithinBlocRatio,
        };
      });
      const projectedWithPartyShares = adjusted
        .map((party) => {
          const sameBloc = adjusted.filter((candidate) => candidate.bloc === party.bloc);
          const blocPartyTotal = sameBloc.reduce((sum, candidate) => sum + candidate.rawWithinBlocShare, 0);
          const baselinePartyShare = modelData.parties.find((item) => item.code === party.code)?.baselineShare ?? 0;
          const baselineBlocShare = modelData.baselineBlocShares[party.bloc];
          const fallbackWithinBlocShare = baselineBlocShare > 0 ? (baselinePartyShare / baselineBlocShare) * 100 : 0;
          const withinBlocShare = blocPartyTotal > 0
            ? party.rawWithinBlocShare / blocPartyTotal
            : fallbackWithinBlocShare / 100;
          return {
            code: party.code,
            bloc: party.bloc,
            share: blocShares[party.bloc] * withinBlocShare,
            withinBlocShare,
            baselineLocalNationalRatio: party.baselineLocalNationalRatio,
            hasBaselineResult: party.hasBaselineResult,
            historicalWithinBlocRatio: party.historicalWithinBlocRatio,
          };
        });
      const tacticallyConsolidatedParties = applyWithinBlocTacticalVoting(projectedWithPartyShares, blocShares, appliedTacticalVoting);
      const intraBlocProjected = tacticallyConsolidatedParties
        .map((party) => {
          return { ...party, share: blocShares[party.bloc] * party.withinBlocShare };
        });
      const interBlocAdjusted = applyInterBlocTacticalVoting(blocShares, intraBlocProjected, appliedInterBlocTacticalVoting, tacticalCompetitivenessMargin);
      const projected = intraBlocProjected
        .map((party) => ({ ...party, share: interBlocAdjusted.partyShares[party.code] ?? 0 }))
        .sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
      const winner = projected[0]?.code ?? "";
      const runnerUp = projected[1]?.code ?? "";
      const margin = (projected[0]?.share ?? 0) - (projected[1]?.share ?? 0);
      return { ...constituency, projected, projectedBlocShares: interBlocAdjusted.blocShares, winner, runnerUp, margin };
    });

    const pointEstimateByName = new Map(pointEstimates.map((constituency) => [constituency.name, constituency]));
    const winCounts: Record<string, Record<string, number>> = Object.fromEntries(
      modelData.constituencies.map((constituency) => [constituency.name, Object.fromEntries(modelData.parties.map(({ code }) => [code, 0]))]),
    );
    const partyShareSamples: Record<string, Record<string, number[]>> = Object.fromEntries(
      modelData.constituencies.map((constituency) => [
        constituency.name,
        Object.fromEntries(modelData.parties.map(({ code }) => [code, []])),
      ]),
    );
    const blocShareSums: Record<string, Record<ProjectionBloc, number>> = Object.fromEntries(
      modelData.constituencies.map((constituency) => [constituency.name, { Nationalist: 0, Unionist: 0, "Non-aligned": 0 }]),
    );
    const blocShareSamples: Record<string, Record<ProjectionBloc, number[]>> = Object.fromEntries(
      modelData.constituencies.map((constituency) => [constituency.name, { Nationalist: [], Unionist: [], "Non-aligned": [] }]),
    );
    const constituencyBlocSeatSamples: Record<string, Record<ProjectionBloc, number[]>> = Object.fromEntries(
      modelData.constituencies.map((constituency) => [constituency.name, { Nationalist: [], Unionist: [], "Non-aligned": [] }]),
    );
    const seatSamples: Record<string, number[]> = Object.fromEntries(modelData.parties.map(({ code }) => [code, []]));
    const largestPartyCounts: Record<string, number> = Object.fromEntries(modelData.parties.map(({ code }) => [code, 0]));
    const nationalPartyShareSamples: Record<string, number[]> = Object.fromEntries(modelData.parties.map(({ code }) => [code, []]));
    const nationalBlocShareSamples: Record<ProjectionBloc, number[]> = { Nationalist: [], Unionist: [], "Non-aligned": [] };
    const blocSeatSamples: Record<ProjectionBloc, number[]> = { Nationalist: [], Unionist: [], "Non-aligned": [] };
    const iterations = SIMULATION_ITERATIONS;
    const normal = createNormalGenerator(JSON.stringify(appliedSettings));
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const simulatedSeats: Record<string, number> = Object.fromEntries(modelData.parties.map(({ code }) => [code, 0]));
      const simulatedBlocSeats: Record<ProjectionBloc, number> = { Nationalist: 0, Unionist: 0, "Non-aligned": 0 };
      const simulatedPartyVotes: Record<string, number> = Object.fromEntries(modelData.parties.map(({ code }) => [code, 0]));
      const simulatedBlocVotes: Record<ProjectionBloc, number> = { Nationalist: 0, Unionist: 0, "Non-aligned": 0 };
      let simulatedValidVotes = 0;
      const noisyNationalist = Math.max(0, inputBlocShares.Nationalist + normal() * appliedPollError);
      const noisyUnionist = Math.max(0, inputBlocShares.Unionist + normal() * appliedPollError);
      const noisyBlocShares = normalizeBlocShares({
        Nationalist: noisyNationalist,
        Unionist: noisyUnionist,
        "Non-aligned": Math.max(0, 100 - noisyNationalist - noisyUnionist),
      }, inputBlocShares);

      for (const constituency of modelData.constituencies) {
        const point = pointEstimateByName.get(constituency.name);
        const availableBlocs = new Set(point?.projected.map((party) => party.bloc) ?? []);
        const projectedBlocBaseline = (bloc: ProjectionBloc) => localBlocBaselineShare(constituency, bloc, modelData)
          + (inputBlocShares[bloc] - modelData.baselineBlocShares[bloc])
            * localBlocSwingMultiplier(constituency, bloc, modelData, appliedPreviousResultWeight);
        const noisyLocalNationalist = availableBlocs.has("Nationalist")
          ? Math.max(0, projectedBlocBaseline("Nationalist")
            + (noisyBlocShares.Nationalist - inputBlocShares.Nationalist)
              * localBlocSwingMultiplier(constituency, "Nationalist", modelData, appliedPreviousResultWeight)
            + normal() * appliedLocalVariation)
          : 0;
        const noisyLocalUnionist = availableBlocs.has("Unionist")
          ? Math.max(0, projectedBlocBaseline("Unionist")
            + (noisyBlocShares.Unionist - inputBlocShares.Unionist)
              * localBlocSwingMultiplier(constituency, "Unionist", modelData, appliedPreviousResultWeight)
            + normal() * appliedLocalVariation)
          : 0;
        const noisyLocalBlocShares: Record<ProjectionBloc, number> = {
          Nationalist: noisyLocalNationalist,
          Unionist: noisyLocalUnionist,
          "Non-aligned": availableBlocs.has("Non-aligned")
            ? Math.max(0, 100 - noisyLocalNationalist - noisyLocalUnionist)
            : 0,
        };
        const localBlocShares = normalizeBlocShares(
          noisyLocalBlocShares,
          Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, availableBlocs.has(bloc) ? constituency.blocShares[bloc] : 0])) as Record<ProjectionBloc, number>,
        );
        const simulatedWithinBlocParties = perturbWithinBlocPartyShares(
          (point?.projected ?? []).map((party) => ({
            code: party.code,
            bloc: party.bloc,
            withinBlocShare: party.withinBlocShare,
          })),
          appliedLocalVariation,
          normal,
        );
        const tacticallyConsolidatedParties = applyWithinBlocTacticalVoting(simulatedWithinBlocParties, localBlocShares, appliedTacticalVoting);
        const interBlocAdjusted = applyInterBlocTacticalVoting(localBlocShares, tacticallyConsolidatedParties, appliedInterBlocTacticalVoting, tacticalCompetitivenessMargin);
        PROJECTION_BLOCS.forEach((bloc) => {
          blocShareSums[constituency.name][bloc] += interBlocAdjusted.blocShares[bloc];
          blocShareSamples[constituency.name][bloc].push(interBlocAdjusted.blocShares[bloc]);
          simulatedBlocVotes[bloc] += interBlocAdjusted.blocShares[bloc] * constituency.votes;
        });
        const localVotes = (point?.projected ?? []).map((party) => ({
          code: party.code,
          value: interBlocAdjusted.partyShares[party.code] ?? 0,
        }));
        localVotes.forEach((party) => {
          partyShareSamples[constituency.name][party.code].push(party.value);
          simulatedPartyVotes[party.code] += party.value * constituency.votes;
        });
        simulatedValidVotes += constituency.votes * 100;
        const localWinner = localVotes.sort((a, b) => b.value - a.value || a.code.localeCompare(b.code))[0]?.code;
        if (localWinner) {
          winCounts[constituency.name][localWinner] += 1;
          simulatedSeats[localWinner] += constituency.seats;
          const winningBloc = getProjectionBloc(localWinner);
          simulatedBlocSeats[winningBloc] += constituency.seats;
        }
        PROJECTION_BLOCS.forEach((bloc) => constituencyBlocSeatSamples[constituency.name][bloc].push(
          localWinner && getProjectionBloc(localWinner) === bloc ? constituency.seats : 0,
        ));
      }
      modelData.parties.forEach(({ code }) => seatSamples[code].push(simulatedSeats[code]));
      PROJECTION_BLOCS.forEach((bloc) => {
        blocSeatSamples[bloc].push(simulatedBlocSeats[bloc]);
        nationalBlocShareSamples[bloc].push(simulatedValidVotes > 0 ? simulatedBlocVotes[bloc] / simulatedValidVotes * 100 : 0);
      });
      modelData.parties.forEach(({ code }) => nationalPartyShareSamples[code].push(simulatedValidVotes > 0 ? simulatedPartyVotes[code] / simulatedValidVotes * 100 : 0));
      const highestSeatCount = Math.max(...Object.values(simulatedSeats));
      const leaders = Object.entries(simulatedSeats).filter(([, seats]) => seats === highestSeatCount);
      leaders.forEach(([code]) => { largestPartyCounts[code] += 1 / leaders.length; });
    }

    Object.values(seatSamples).forEach((samples) => samples.sort((a, b) => a - b));

    const simulationWinnerSeats: Record<string, number> = Object.fromEntries(modelData.parties.map(({ code }) => [code, 0]));
    const constituencies: ProjectedConstituency[] = pointEstimates.map((constituency) => {
      const simulationWinner = modelData.parties
        .map(({ code }) => code)
        .sort((a, b) => winCounts[constituency.name][b] - winCounts[constituency.name][a]
          || Number(b === constituency.winner) - Number(a === constituency.winner)
          || a.localeCompare(b))[0] ?? constituency.winner;
      const meanProjected = constituency.projected.map((party) => {
        const samples = partyShareSamples[constituency.name][party.code].sort((a, b) => a - b);
        const share = samples.length > 0
          ? samples.reduce((sum, value) => sum + value, 0) / samples.length
          : party.share;
        return {
          ...party,
          share,
          shareStandardDeviation: standardDeviation(samples),
          baselineShare: constituency.partyShares[party.code] ?? 0,
          shareChange: share - (constituency.partyShares[party.code] ?? 0),
          shareLow: quantile(samples, 0.1),
          shareHigh: quantile(samples, 0.9),
        };
      }).sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
      const simulationRunnerUp = meanProjected.find((party) => party.code !== simulationWinner);
      const simulationWinnerShare = meanProjected.find((party) => party.code === simulationWinner)?.share ?? 0;
      const meanBlocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
        bloc,
        blocShareSums[constituency.name][bloc] / iterations,
      ])) as Record<ProjectionBloc, number>;
      const blocOutcomes: ProjectionBlocSummary[] = PROJECTION_BLOCS.map((bloc) => {
        const samples = blocShareSamples[constituency.name][bloc];
        const share = blocShareSums[constituency.name][bloc] / iterations;
        const baselineShare = constituency.blocShares[bloc];
        const baselineSeats = constituency.seats * Number(getProjectionBloc(constituency.baselineWinner) === bloc);
        const seatSamplesForBloc = constituencyBlocSeatSamples[constituency.name][bloc];
        const expectedSeats = seatSamplesForBloc.reduce((sum, value) => sum + value, 0) / iterations;
        return {
          code: bloc,
          share,
          shareStandardDeviation: standardDeviation(samples),
          baselineShare,
          shareChange: share - baselineShare,
          expectedSeats,
          seatStandardDeviation: standardDeviation(seatSamplesForBloc),
          baselineSeats,
          seatCountProbabilities: outcomeProbabilities(seatSamplesForBloc, constituency.seats),
        };
      });
      simulationWinnerSeats[simulationWinner] = (simulationWinnerSeats[simulationWinner] ?? 0) + constituency.seats;
      return {
        ...constituency,
        projected: meanProjected,
        projectedBlocShares: meanBlocShares,
        winner: simulationWinner,
        runnerUp: simulationRunnerUp?.code ?? "",
        margin: simulationWinnerShare - (simulationRunnerUp?.share ?? 0),
        winProbability: Object.fromEntries(
          modelData.parties.map(({ code }) => [
            code,
            smoothedSimulationChance(winCounts[constituency.name][code], iterations, modelData.parties.length),
          ]),
        ),
        blocOutcomes,
      };
    });

    const standings = modelData.parties
      .map((party) => {
        const samples = seatSamples[party.code];
        const nationalShareSamples = nationalPartyShareSamples[party.code];
        const expectedSeats = samples.reduce((sum, value) => sum + value, 0) / iterations;
        const projectedShare = nationalShareSamples.reduce((sum, value) => sum + value, 0) / iterations;
        return {
        ...party,
        projectedShare,
        projectedShareStandardDeviation: standardDeviation(nationalShareSamples),
        shareChange: projectedShare - party.baselineShare,
        seats: simulationWinnerSeats[party.code] ?? 0,
        expectedSeats,
        seatStandardDeviation: standardDeviation(samples),
        seatCountProbabilities: outcomeProbabilities(samples, totalSeats),
        seatChange: expectedSeats - party.baselineSeats,
        change: (simulationWinnerSeats[party.code] ?? 0) - party.baselineSeats,
        medianSeats: quantile(samples, 0.5),
        lowSeats: quantile(samples, 0.1),
        highSeats: quantile(samples, 0.9),
        largestPartyProbability: smoothedSimulationChance(largestPartyCounts[party.code], iterations, modelData.parties.length),
      }; })
      .sort((a, b) => b.seats - a.seats || b.baselineSeats - a.baselineSeats || a.code.localeCompare(b.code));
    const blocStandings: ProjectionBlocSummary[] = PROJECTION_BLOCS.map((bloc) => {
      const shareSamples = nationalBlocShareSamples[bloc];
      const seatResults = blocSeatSamples[bloc];
      const share = shareSamples.reduce((sum, value) => sum + value, 0) / iterations;
      const baselineShare = modelData.baselineBlocShares[bloc];
      const baselineSeats = modelData.parties.filter((party) => party.bloc === bloc).reduce((sum, party) => sum + party.baselineSeats, 0);
      return {
        code: bloc,
        share,
        shareStandardDeviation: standardDeviation(shareSamples),
        baselineShare,
        shareChange: share - baselineShare,
        expectedSeats: seatResults.reduce((sum, value) => sum + value, 0) / iterations,
        seatStandardDeviation: standardDeviation(seatResults),
        baselineSeats,
        seatCountProbabilities: outcomeProbabilities(seatResults, totalSeats),
      };
    });
    return { constituencies, standings, blocStandings, enteredTotal, iterations, inputBlocShares };
  }, [modelData, appliedSettings]);

  const rangeAxisMaximum = Math.max(5, Math.ceil(Math.max(...projection.standings.flatMap((party) => [party.highSeats, party.baselineSeats])) * 1.12 / 5) * 5);
  const distributionScopes: DistributionScope[] = [{ key: "all", label: "NI-wide" }, ...modelData.constituencies.map((item) => ({ key: item.name, label: item.name }))];
  const partyDistributionSeries: DistributionSeries[] = modelData.parties.map((party) => {
    const standing = projection.standings.find((item) => item.code === party.code);
    const byScope: DistributionSeries["byScope"] = {
      all: { expected: standing?.expectedSeats ?? 0, standardDeviation: standing?.seatStandardDeviation ?? 0, baseline: party.baselineSeats, probabilities: standing?.seatCountProbabilities ?? [] },
    };
    projection.constituencies.forEach((area) => {
      const probability = area.winProbability[party.code] ?? 0;
      byScope[area.name] = {
        expected: probability / 100,
        standardDeviation: Math.sqrt((probability / 100) * (1 - probability / 100)),
        baseline: Number(area.baselineWinner === party.code),
        probabilities: [{ outcome: 0, probability: 100 - probability }, { outcome: 1, probability }],
      };
    });
    return { key: party.code, label: party.name, color: party.color, byScope };
  });
  const communityDistributionSeries: DistributionSeries[] = PROJECTION_BLOCS.map((bloc) => {
    const summary = projection.blocStandings.find((item) => item.code === bloc);
    const byScope: DistributionSeries["byScope"] = {
      all: { expected: summary?.expectedSeats ?? 0, standardDeviation: summary?.seatStandardDeviation ?? 0, baseline: summary?.baselineSeats ?? 0, probabilities: summary?.seatCountProbabilities ?? [] },
    };
    projection.constituencies.forEach((area) => {
      const outcome = area.blocOutcomes.find((item) => item.code === bloc);
      byScope[area.name] = { expected: outcome?.expectedSeats ?? 0, standardDeviation: outcome?.seatStandardDeviation ?? 0, baseline: outcome?.baselineSeats ?? 0, probabilities: outcome?.seatCountProbabilities ?? [] };
    });
    return { key: bloc, label: bloc, color: bloc === "Nationalist" ? "#14765f" : bloc === "Unionist" ? "#436fa8" : "#d49b22", byScope };
  });
  const heldOut2024Winners = new Map(data.heldOut2024.constituencies.map((constituency) => [constituency.name, constituency.winner]));
  const heldOut2024Seats = new Map(data.heldOut2024.parties.map((party) => [party.code, party.seats]));
  const backtestScoreParties = [...new Set([...projection.standings.map((party) => party.code), ...heldOut2024Seats.keys()])]
    .map((code) => ({
      code,
      color: projection.standings.find((party) => party.code === code)?.color ?? data.parties.find((party) => party.code === code)?.color ?? "#7a8589",
      forecastSeats: projection.standings.find((party) => party.code === code)?.seats ?? 0,
      actualSeats: heldOut2024Seats.get(code) ?? 0,
    }))
    .filter((party) => party.forecastSeats > 0 || party.actualSeats > 0);
  const backtestCorrectConstituencies = projection.constituencies.filter((constituency) => heldOut2024Winners.get(constituency.name) === constituency.winner).length;
  const isBacktestApplied = appliedProjectionMode === "backtest-2024" && hasRunProjection;
  const hasRunSelectedProjection = hasRunProjection && appliedProjectionMode === draftProjectionMode;
  const actual2024Constituencies = new Map(data.constituencies.map((constituency) => [constituency.name, constituency]));
  const backtestMarginErrors = isBacktestApplied ? projection.constituencies.map((constituency) => {
    const actual = actual2024Constituencies.get(constituency.name);
    const forecastWinner = constituency.projected.find((party) => party.code === constituency.winner);
    const forecastRunnerUp = constituency.projected
      .filter((party) => party.code !== constituency.winner)
      .sort((a, b) => b.share - a.share)[0];
    const forecastWinnerShare = forecastWinner?.share ?? 0;
    const forecastRunnerUpShare = forecastRunnerUp?.share ?? 0;
    const actualWinnerShare = actual?.partyShares[constituency.winner] ?? 0;
    const actualRunnerUpShare = Math.max(0, ...Object.entries(actual?.partyShares ?? {})
      .filter(([code]) => code !== constituency.winner)
      .map(([, share]) => share));
    const blocErrors = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
      bloc,
      (constituency.projectedBlocShares[bloc] ?? 0) - (actual?.blocShares[bloc] ?? 0),
    ])) as Record<ProjectionBloc, number>;
    return {
      constituency: constituency.name,
      winner: constituency.winner,
      winnerShare: forecastWinnerShare,
      runnerUp: forecastRunnerUp?.code ?? "",
      runnerUpShare: forecastRunnerUpShare,
      actualWinner: actual?.baselineWinner ?? "",
      actualWinnerShare,
      actualForecastRunnerUpShare: actual?.partyShares[forecastRunnerUp?.code ?? ""] ?? 0,
      forecastMargin: forecastWinnerShare - forecastRunnerUpShare,
      actualMargin: actualWinnerShare - actualRunnerUpShare,
      error: (forecastWinnerShare - forecastRunnerUpShare) - (actualWinnerShare - actualRunnerUpShare),
      blocErrors,
    };
  }) : [];
  const backtestPartyShareErrors = isBacktestApplied ? projection.constituencies.flatMap((constituency) => {
    const actual = actual2024Constituencies.get(constituency.name);
    const forecastShares = new Map(constituency.projected.map((party) => [party.code, party.share]));
    const codes = new Set([...Object.keys(actual?.partyShares ?? {}), ...forecastShares.keys()]);
    return [...codes].map((code) => (forecastShares.get(code) ?? 0) - (actual?.partyShares[code] ?? 0));
  }) : [];
  const meanAbsolutePartyShareError = backtestPartyShareErrors.length > 0
    ? backtestPartyShareErrors.reduce((sum, error) => sum + Math.abs(error), 0) / backtestPartyShareErrors.length
    : 0;
  const backtestBlocErrors = backtestMarginErrors.flatMap((result) => PROJECTION_BLOCS.map((bloc) => result.blocErrors[bloc]));
  const meanAbsoluteBlocShareError = backtestBlocErrors.length > 0
    ? backtestBlocErrors.reduce((sum, error) => sum + Math.abs(error), 0) / backtestBlocErrors.length
    : 0;
  const meanAbsoluteMarginError = backtestMarginErrors.length > 0
    ? backtestMarginErrors.reduce((sum, result) => sum + Math.abs(result.error), 0) / backtestMarginErrors.length
    : 0;
  const meanSignedMarginError = backtestMarginErrors.length > 0
    ? backtestMarginErrors.reduce((sum, result) => sum + result.error, 0) / backtestMarginErrors.length
    : 0;
  const backtestMarginErrorByConstituency = new Map(backtestMarginErrors.map((result) => [result.constituency, result]));
  const backtestSupportIs2024National = modelData.parties.every((party) =>
    appliedSettings.support[party.code] === (data.parties.find((currentParty) => currentParty.code === party.code)?.baselineShare ?? party.baselineShare).toFixed(1),
  );

  function changeProjectionMode(nextMode: ProjectionMode) {
    const nextData = nextMode === "backtest-2024" ? data.backtestBaseline : data;
    const defaults = createDefaultProjectionSettings(nextData, nextMode === "backtest-2024" ? data : nextData);
    setDraftProjectionMode(nextMode);
    setSupport(defaults.support);
    setPollError(defaults.pollError);
    setLocalVariation(defaults.localVariation);
    setPreviousResultWeight(defaults.previousResultWeight);
    setPartyPresence(defaults.partyPresence);
    setTacticalVoting(defaults.tacticalVoting);
    setInterBlocTacticalVoting(defaults.interBlocTacticalVoting);
  }

  function resetToBaseline() {
    const defaults = createDefaultProjectionSettings(draftData, draftProjectionMode === "backtest-2024" ? data : draftData);
    setSupport(defaults.support);
    setPollError(defaults.pollError);
    setLocalVariation(defaults.localVariation);
    setPreviousResultWeight(defaults.previousResultWeight);
    setPartyPresence(defaults.partyPresence);
    setTacticalVoting(defaults.tacticalVoting);
    setInterBlocTacticalVoting(defaults.interBlocTacticalVoting);
  }

  function applySavedScenario(saved: Record<string, unknown>) {
    const mode = saved.projectionMode === "backtest-2024" ? "backtest-2024" : "current";
    const settings = saved.settings as ProjectionSettings | undefined;
    if (!settings?.support || !settings.partyPresence) return;
    setDraftProjectionMode(mode);
    setSupport(settings.support);
    setPollError(settings.pollError);
    setLocalVariation(settings.localVariation);
    setPreviousResultWeight(settings.previousResultWeight);
    setPartyPresence(settings.partyPresence);
    setTacticalVoting(settings.tacticalVoting);
    setInterBlocTacticalVoting(settings.interBlocTacticalVoting);
  }

  function runProjection() {
    setAppliedProjectionMode(draftProjectionMode);
    setAppliedSettings({
      support: { ...support },
      pollError,
      localVariation,
      previousResultWeight,
      partyPresence: Object.fromEntries(Object.entries(partyPresence).map(([name, parties]) => [name, [...parties]])),
      tacticalVoting: { ...tacticalVoting },
      interBlocTacticalVoting: { ...interBlocTacticalVoting },
    });
    setHasRunProjection(true);
  }

  async function downloadProjectionReport() {
    setIsExportingReport(true);
    setReportExportError("");
    setGeneratedReport(null);
    try {
      const [{ pdf }, { default: SeatProjectionPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./SeatProjectionPdf"),
      ]);
      const reportDate = new Date().toLocaleDateString("en-IE", { dateStyle: "long" });
      const logoResponse = await fetch("/landscape.png");
      if (!logoResponse.ok) throw new Error("Could not load the Ireland Votes logo.");
      const logoBlob = await logoResponse.blob();
      const logoSrc = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the logo."));
        reader.onerror = () => reject(new Error("Could not read the logo."));
        reader.readAsDataURL(logoBlob);
      });
      const document = createElement(SeatProjectionPdf, {
        data: modelData,
        projection,
        support: appliedSettings.support,
        reportDate,
        logoSrc,
        pollError: appliedSettings.pollError,
        localVariation: appliedSettings.localVariation,
        previousResultWeight: appliedSettings.previousResultWeight,
        tacticalVoting: appliedSettings.tacticalVoting,
        interBlocTacticalVoting: appliedSettings.interBlocTacticalVoting,
      });
      const pdfBlob = await pdf(document as unknown as Parameters<typeof pdf>[0]).toBlob();
      const objectUrl = URL.createObjectURL(pdfBlob);
      const filename = `confidential-projection-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      setGeneratedReport({ url: objectUrl, filename });
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.position = "fixed";
      anchor.style.left = "-10000px";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      console.error("Projection PDF export failed", error);
      setReportExportError(`The PDF could not be generated${error instanceof Error ? `: ${error.message}` : ". Please try again."}`);
    } finally {
      setIsExportingReport(false);
    }
  }

  return (
    <main className="staff-home-content staff-projection-page">
      <section className="staff-projection-toolbar" aria-label="Projection dashboard toolbar">
        <div className="staff-projection-topbar">
        <div className="staff-projection-toolbar-tile staff-projection-toolbar-title">
          <p className="staff-eyebrow">ELECTORAL MODELLING</p>
          <h1>Seat projection</h1>
          <ProjectionModelSwitcher current="hoc" enabled={["hoc", "nia"]} />
        </div>

        <div className="staff-projection-toolbar-tile staff-projection-toolbar-constituencies">
          <span className="staff-projection-toolbar-label">Constituencies</span>
          <strong>{modelData.constituencies.length}</strong>
          <small>NI-wide</small>
        </div>
        <div className="staff-projection-toolbar-tile staff-projection-toolbar-seats">
          <span className="staff-projection-toolbar-label">Seats</span>
          <strong>{totalSeats}</strong>
          <small>Single-member</small>
        </div>
        <div className="staff-projection-toolbar-tile staff-projection-toolbar-detail">
          <label className="staff-projection-mode-picker">
            <span className="staff-projection-toolbar-label">Model baseline</span>
            <select aria-label="Choose model baseline" value={draftProjectionMode} onChange={(event) => changeProjectionMode(event.target.value as ProjectionMode)}>
              <option value="current">Current projection · 2024 baseline</option>
              <option value="backtest-2024">Backtest 2024 · 2019 baseline</option>
            </select>
          </label>
          <small>{draftProjectionMode === "backtest-2024" ? "2024 result held out" : "Northern Ireland"}</small>
        </div>
        <div className="staff-projection-toolbar-tile staff-projection-toolbar-detail">
          <span className="staff-projection-toolbar-label">Method</span>
          <strong>National swing</strong>
          <small>Local strength + simulation</small>
        </div>
        <div className="staff-projection-actions staff-projection-toolbar-actions">
          <button type="button" className="staff-projection-run-button staff-projection-toolbar-action-button" onClick={runProjection} disabled={!hasUnappliedChanges}>
            <span className="staff-projection-toolbar-label">Scenario</span>
            <svg className="staff-projection-action-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 0 1 10.2-4.2L16 7.5M16 4v3.5h-3.5M16 10a6 6 0 0 1-10.2 4.2L4 12.5M4 16v-3.5h3.5" /></svg>
            <span>{hasRunSelectedProjection && !isDefaultSettings ? "Update projection" : "Run projection"}</span>
            <small role="status" aria-live="polite">{hasUnappliedChanges ? (hasRunSelectedProjection ? "Scenario changed" : "Draft changed") : "Results up to date"}</small>
          </button>
          <button type="button" className="staff-projection-reset staff-projection-toolbar-action-button" onClick={resetToBaseline}>
            <span className="staff-projection-toolbar-label">Inputs</span>
            <svg className="staff-projection-action-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 7.5A6 6 0 1 1 4 11M4.5 3.8v3.8h3.8" /></svg>
            <span>Reset baseline</span>
            <small>Restore default settings</small>
          </button>
          <button type="button" className="staff-projection-report-button staff-projection-toolbar-action-button" onClick={downloadProjectionReport} disabled={isExportingReport || hasUnappliedChanges} title={hasUnappliedChanges ? "Run the projection before downloading its report." : undefined}>
            <span className="staff-projection-toolbar-label">Export</span>
            <svg className="staff-projection-action-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M6 2.8h5.2L15.5 7v10.2H6zM11 2.8V7h4.5M10.7 9.5v5m-2-2 2 2 2-2" /></svg>
            {isExportingReport ? "Preparing PDF…" : "Download full PDF report"}
            <small>{hasUnappliedChanges ? "Run draft before export" : "Full branded report"}</small>
          </button>
        </div>
        </div>
      </section>
      <ProjectionScenarioManager model="hoc" settings={{ projectionMode: draftProjectionMode, settings: draftSettings }} presets={scenarioPresets} onApply={applySavedScenario} />
      {reportExportError && <p className="staff-projection-export-error" role="alert">{reportExportError}</p>}
      {generatedReport && <p className="staff-projection-report-ready" role="status">Your PDF is ready. If the download did not start, <a href={generatedReport.url} download={generatedReport.filename}>download the report here</a>.</p>}

      <div className="staff-projection-layout">
        <section className="staff-projection-input-card" aria-labelledby="projection-input-heading">
          <div className="staff-projection-section-heading">
            <div>
              <p className="staff-eyebrow">SCENARIO INPUT</p>
              <h2 id="projection-input-heading">National party support</h2>
            </div>
          </div>
          <p className="staff-projection-help">
            {draftProjectionMode === "backtest-2024"
              ? "Defaults use actual 2024 NI-wide shares to isolate constituency allocation. This is an oracle diagnostic, not a blind backtest; 2024 constituency shares and winners remain held out. Replace these values with a pre-election poll to assess forecast accuracy."
              : `Values start at each party's ${draftData.baselineYear} NI-wide first-preference share. Edit the support or constituency field, then run the projection to update the results.`}
          </p>
          <div className="staff-projection-party-inputs">
            {draftData.parties.map((party) => (
              <label key={party.code} className="staff-projection-party-input">
                <span className="staff-projection-party-name"><i style={{ backgroundColor: party.color }} />{party.name}<small>{party.code} / {party.bloc}</small></span>
                <span className="staff-projection-number-wrap">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    inputMode="decimal"
                    aria-label={`${party.name} national support percentage`}
                    value={support[party.code] ?? "0"}
                    onChange={(event) => setSupport((current) => ({ ...current, [party.code]: event.target.value }))}
                  />
                  <span>%</span>
                </span>
              </label>
            ))}
          </div>
          <div className={`staff-projection-total${Math.abs(draftEnteredTotal - 100) > 0.15 ? " is-outside" : ""}`}>
            <span>Draft total</span><strong>{draftEnteredTotal.toFixed(1)}%</strong>
          </div>
          {Math.abs(draftEnteredTotal - 100) > 0.15 && (
            <p className="staff-projection-note">The entered values do not total 100%. The model rescales each constituency&apos;s projected party shares to 100%.</p>
          )}
          <div className="staff-projection-bloc-summary" aria-label="Current support by political bloc">
            <div className="staff-projection-bloc-summary-heading">
              <strong>Support by bloc</strong>
              <span>Draft scenario</span>
            </div>
            <div className="staff-projection-bloc-cards">
              {PROJECTION_BLOCS.map((bloc) => (
                <div key={bloc}>
                  <span>{bloc}</span>
                  <strong>{draftInputBlocShares[bloc].toFixed(1)}%</strong>
                </div>
              ))}
            </div>
            <p>Inter-bloc tactical transfers can run between Nationalist and Non-aligned, or Unionist and Non-aligned, but activate only in close cross-bloc contests. Direct Nationalist-Unionist transfers are excluded.</p>
          </div>
          <details className="staff-projection-advanced">
            <summary>
              <span><strong>Advanced model controls</strong><small>Tactical voting and simulation assumptions</small></span>
            </summary>
            <div className="staff-projection-advanced-content">
          <div className="staff-projection-tactical">
            <div className="staff-projection-bloc-summary-heading">
              <strong>Within-bloc tactical consolidation</strong>
              <span>Share consolidating behind the strongest included party within each bloc</span>
            </div>
            {PROJECTION_BLOCS.map((bloc) => (
              <label key={bloc}>
                <span>{bloc}<strong>{tacticalVoting[bloc]}%</strong></span>
                <input type="range" min="0" max="50" step="1" value={tacticalVoting[bloc]} onChange={(event) => setTacticalVoting((current) => ({ ...current, [bloc]: Number(event.target.value) }))} />
              </label>
            ))}
            <p>It activates only when the leading two parties are from different blocs. A contest between two parties in the same bloc receives no tactical adjustment.</p>
          </div>
          <div className="staff-projection-tactical staff-projection-inter-bloc-tactical">
            <div className="staff-projection-bloc-summary-heading">
              <strong>Inter-bloc tactical transfers</strong>
              <span>Only between Nationalist and Non-aligned, or Unionist and Non-aligned</span>
            </div>
            {([
              ["nationalistToNonAligned", "Nationalist → Non-aligned"],
              ["nonAlignedToNationalist", "Non-aligned → Nationalist"],
              ["unionistToNonAligned", "Unionist → Non-aligned"],
              ["nonAlignedToUnionist", "Non-aligned → Unionist"],
            ] as const).map(([key, label]) => (
              <label key={key}>
                <span>{label}<strong>{interBlocTacticalVoting[key]}%</strong></span>
                <input type="range" min="0" max="50" step="1" value={interBlocTacticalVoting[key]} onChange={(event) => setInterBlocTacticalVoting((current) => ({ ...current, [key]: Number(event.target.value) }))} />
              </label>
            ))}
            <p>Each percentage is the share of the originating bloc that could transfer to the strongest included party in the destination bloc. It applies only when that destination candidate is the close runner-up, within roughly two standard errors of the model uncertainty. No Nationalist-to-Unionist or Unionist-to-Nationalist transfer is available.</p>
          </div>
          <div className="staff-projection-uncertainty">
            <div className="staff-projection-uncertainty-heading">
              <strong>Model assumptions</strong>
              <span>Provisional</span>
            </div>
            <label>
              <span>Polling uncertainty <strong>{pollError.toFixed(1)} pts</strong></span>
              <input type="range" min="0" max="8" step="0.5" value={pollError} onChange={(event) => setPollError(Number(event.target.value))} />
            </label>
            <label>
              <span>Constituency variation <strong>{localVariation.toFixed(1)} pts</strong></span>
              <input type="range" min="0" max="8" step="0.5" value={localVariation} onChange={(event) => setLocalVariation(Number(event.target.value))} />
            </label>
            <label>
              <span>Historical influence on swing response <strong>{previousResultWeight}%</strong></span>
              <input type="range" min="0" max="100" step="5" value={previousResultWeight} onChange={(event) => setPreviousResultWeight(Number(event.target.value))} />
            </label>
            <p>Party local strength uses the full weighted local-to-national performance ratio within each bloc wherever comparable history exists, drawing on Westminster results from {historicalWestminsterYears.join(", ") || "no prior Westminster elections"} and NI Assembly first preferences from 2022 and 2017 as a separate signal. This rule applies whether or not a party contested the baseline constituency. If no local history exists, a recorded baseline result is used; otherwise the ratio defaults to 1. Where national baseline support is zero, the historical ratio is applied to the scenario support entered above. The history slider affects swing response only. A recorded zero-vote result remains a zero baseline. Assembly results are not treated as direct Westminster equivalents. Constituency bloc composition is modelled separately.</p>
            <p className="staff-projection-simulation-note">The 10,000 runs give about ±1 percentage point of Monte Carlo error at 95% confidence for a 50% estimate. More runs would have diminishing returns; they do not make the model assumptions more accurate. Win chances use light smoothing, avoid displaying 0% or 100%, and are not yet calibrated against historical forecasts.</p>
          </div>
            </div>
          </details>
        </section>

        <div className="staff-projection-results">
          {hasUnappliedChanges && <p className="staff-projection-pending-note" role="status">Showing the last run. Press <strong>{hasRunSelectedProjection && !isDefaultSettings ? "Update projection" : "Run projection"}</strong> to apply your draft settings.</p>}
          {isBacktestApplied && (
            <section className="staff-projection-backtest-card" aria-label="2024 held-out backtest score">
              <div className="staff-projection-backtest-heading">
                <div><p className="staff-eyebrow">HELD-OUT CHECK</p><h2>2024 backtest score</h2></div>
                <strong>{backtestCorrectConstituencies}/{data.heldOut2024.constituencies.length}<small> seats called correctly</small></strong>
              </div>
              <p>{backtestSupportIs2024National
                ? "This run uses actual 2024 national vote shares as an oracle input, so it diagnoses constituency allocation rather than forecasting. Only constituency winners and shares are held out for scoring. Replace national support with a pre-election poll snapshot for a leakage-free forecast check."
                : "2024 constituency results are held out from the model and used here only for scoring. The national support figures are manual inputs; use a poll snapshot available before election day to avoid leakage."}</p>
              <div className="staff-projection-backtest-margin-summary" aria-label="Backtest constituency margin accuracy">
                <div><small>Mean absolute margin error</small><strong>{meanAbsoluteMarginError.toFixed(1)} pts</strong></div>
                <div><small>Average signed margin error</small><strong>{meanSignedMarginError > 0 ? "+" : ""}{meanSignedMarginError.toFixed(1)} pts</strong></div>
                <div><small>Party-share MAE</small><strong>{meanAbsolutePartyShareError.toFixed(1)} pts</strong></div>
                <div><small>Bloc-share MAE</small><strong>{meanAbsoluteBlocShareError.toFixed(1)} pts</strong></div>
                <p>Party and bloc errors compare each 2024 constituency with the model. Margin is measured for the model-called winner against the strongest other candidate; positive signed error means its lead was overstated.</p>
              </div>
              <details className="staff-projection-backtest-details">
                <summary>Open constituency-by-constituency party, bloc and margin errors</summary>
                <div className="staff-projection-backtest-table-wrap">
                  <table>
                    <thead><tr><th>Constituency</th><th>Model call and shares</th><th>2024 actual</th><th>Bloc error · model minus actual</th><th>Margin · model / actual for call / error</th></tr></thead>
                    <tbody>{backtestMarginErrors.map((result) => (
                      <tr key={result.constituency}>
                        <th scope="row">{result.constituency}</th>
                        <td><strong>{result.winner}</strong> {result.winnerShare.toFixed(1)}% · {result.runnerUp} {result.runnerUpShare.toFixed(1)}%</td>
                        <td><strong>{result.actualWinner}</strong> {result.actualWinnerShare.toFixed(1)}% · {result.runnerUp} {result.actualForecastRunnerUpShare.toFixed(1)}%</td>
                        <td>N {formatSignedPoints(result.blocErrors.Nationalist)} · U {formatSignedPoints(result.blocErrors.Unionist)} · Non-aligned {formatSignedPoints(result.blocErrors["Non-aligned"])}</td>
                        <td>{formatSignedPoints(result.forecastMargin)} / {formatSignedPoints(result.actualMargin)} / {formatSignedPoints(result.error)} pts</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </details>
              <div className="staff-projection-backtest-party-list">
                {backtestScoreParties.map((party) => {
                  const difference = party.forecastSeats - party.actualSeats;
                  return <div key={party.code}><span><i style={{ backgroundColor: party.color }} />{party.code}</span><strong>{party.forecastSeats}</strong><small>forecast</small><b>{party.actualSeats}</b><small>2024 actual</small><em className={difference === 0 ? "is-neutral" : difference > 0 ? "is-gain" : "is-loss"}>{difference > 0 ? `+${difference}` : difference}</em></div>;
                })}
              </div>
            </section>
          )}
          <section className="staff-projection-result-card staff-projection-standings-card" aria-labelledby="projection-seats-heading">
            <div className="staff-projection-section-heading">
              <div><p className="staff-eyebrow">NI-WIDE RESULT</p><h2 id="projection-seats-heading">Estimated seat result</h2></div>
            </div>
            <div className="staff-projection-standings">
              {projection.standings.map((party) => (
                <div className="staff-projection-standing" key={party.code} style={{ backgroundColor: `color-mix(in srgb, ${party.color} 10%, white)`, borderLeftColor: party.color }}>
                  <div className="staff-projection-standing-label"><strong>{party.name}</strong></div>
                  <div className="staff-projection-standing-metrics">
                    <div className="staff-projection-standing-seatmetric"><strong style={{ backgroundColor: party.color, color: textColorForPartyColor(party.color) }}>{party.seats}</strong><small>Seats · Δ {party.seatChange >= 0 ? "+" : ""}{party.seatChange.toFixed(1)}</small></div>
                    <div className="staff-projection-standing-votemetric"><strong>{party.projectedShare.toFixed(1)}%</strong><small>FPV · Δ {party.shareChange >= 0 ? "+" : ""}{party.shareChange.toFixed(1)}pp</small></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="staff-projection-result-card staff-projection-bloc-outlook-card" aria-labelledby="projection-bloc-heading">
            <div className="staff-projection-section-heading"><div><p className="staff-eyebrow">BLOC BALANCE</p><h2 id="projection-bloc-heading">First-preference support</h2></div><span className="staff-projection-baseline-label">Change vs {modelData.baselineYear}</span></div>
            <div className="staff-projection-bloc-outlook">
              {projection.blocStandings.map((bloc) => <article key={bloc.code}>
                <header>{bloc.code}</header>
                <div><span>FPV <strong>{bloc.share.toFixed(1)}%</strong></span><span>Δ <strong className={`staff-projection-change${bloc.shareChange > 0.05 ? " is-gain" : bloc.shareChange < -0.05 ? " is-loss" : ""}`}>{bloc.shareChange >= 0 ? "+" : ""}{bloc.shareChange.toFixed(1)}pp</strong></span><span>Baseline <strong>{bloc.baselineShare.toFixed(1)}%</strong></span></div>
              </article>)}
            </div>
          </section>

          <ProjectionDistributionCharts partySeries={partyDistributionSeries} communitySeries={communityDistributionSeries} scopes={distributionScopes} />

          <section className="staff-projection-result-card staff-projection-map-card" aria-labelledby="projection-map-heading">
            <div className="staff-projection-section-heading">
              <div><p className="staff-eyebrow">GEOGRAPHIC VIEW</p><h2 id="projection-map-heading">Highest mean vote share by constituency</h2></div>
              <span className="staff-projection-baseline-label">Select a seat for details</span>
            </div>
            <ProjectionMap features={modelData.mapFeatures} constituencies={projection.constituencies} parties={modelData.parties} />
          </section>

          <section className="staff-projection-result-card staff-projection-range-card" aria-labelledby="projection-range-heading">
            <div className="staff-projection-section-heading">
              <div><p className="staff-eyebrow">SIMULATION</p><h2 id="projection-range-heading">Seat outcomes across {projection.iterations.toLocaleString()} runs</h2></div>
              <span className="staff-projection-baseline-label">Middle 80% range</span>
            </div>
            <div className="staff-projection-range-legend"><span><i className="is-range" />Middle 80% of runs</span><span><i className="is-median" />Median</span><span><i className="is-baseline" />{modelData.baselineYear} result</span></div>
            <div className="staff-projection-range-axis"><span>0 seats</span><span>{rangeAxisMaximum} seats</span></div>
            <div className="staff-projection-range-list">
              {projection.standings.map((party) => (
                <div
                  className="staff-projection-range-row"
                  key={party.code}
                  role="img"
                  aria-label={`${party.name}: median ${party.medianSeats} seats, middle 80 percent range ${party.lowSeats} to ${party.highSeats}, ${modelData.baselineYear} baseline ${party.baselineSeats}`}
                >
                  <span className="staff-projection-range-name"><i style={{ backgroundColor: party.color }} />{party.code}</span>
                  <span className="staff-projection-range-track">
                    <i className="staff-projection-range-baseline" style={{ left: `${(party.baselineSeats / rangeAxisMaximum) * 100}%` }} />
                    <i className="staff-projection-range-band" style={{ left: `${(party.lowSeats / rangeAxisMaximum) * 100}%`, width: `${((party.highSeats - party.lowSeats) / rangeAxisMaximum) * 100}%`, backgroundColor: party.color }} />
                    <i className="staff-projection-range-median" style={{ left: `${(party.medianSeats / rangeAxisMaximum) * 100}%`, borderColor: party.color }} />
                  </span>
                  <span className="staff-projection-range-value">{party.medianSeats} <small>({party.lowSeats}-{party.highSeats})</small><small>Δ {party.seatChange >= 0 ? "+" : ""}{party.seatChange.toFixed(1)}</small></span>
                  <span className="staff-projection-leader-chance" title="Smoothed estimate of having the most seats across simulations">{party.largestPartyProbability.toFixed(1)}% most seats</span>
                </div>
              ))}
            </div>
          </section>

          <section className="staff-projection-result-card staff-projection-constituency-card" aria-labelledby="projection-constituencies-heading">
            <div className="staff-projection-section-heading">
              <div><p className="staff-eyebrow">CONSTITUENCY DETAIL</p><h2 id="projection-constituencies-heading">Projected winners</h2></div>
              <label className="staff-projection-constituency-picker">
                <span>View</span>
                <select aria-label="Choose constituency view" value={selectedConstituency} onChange={(event) => setSelectedConstituency(event.target.value)}>
                  <option value="all">All constituencies</option>
                  {modelData.constituencies.map((constituency) => <option key={constituency.name} value={constituency.name}>{constituency.name}</option>)}
                </select>
              </label>
            </div>
            <div className={`staff-projection-constituency-list${selectedConstituency === "all" ? " is-all" : " is-single"}`}>
              {projection.constituencies.map((constituency) => {
                if (selectedConstituency !== "all" && selectedConstituency !== constituency.name) return null;
                const winner = modelData.parties.find((party) => party.code === constituency.winner);
                const runnerUp = modelData.parties.find((party) => party.code === constituency.runnerUp);
                const winnerProjection = constituency.projected.find((party) => party.code === constituency.winner);
                const actual2024Winner = heldOut2024Winners.get(constituency.name);
                const marginDiagnostic = backtestMarginErrorByConstituency.get(constituency.name);
                return (
                  <div className="staff-projection-constituency" key={constituency.name}>
                    <div className={`staff-projection-constituency-summary${isBacktestApplied ? " has-backtest" : ""}`}>
                      <span className="staff-projection-constituency-name"><strong>{constituency.name}</strong><small>{constituency.seats} seat</small></span>
                      <span className="staff-projection-winner">
                        <span><i style={{ backgroundColor: winner?.color ?? "#7a8589" }} />{winner?.code ?? "-"}</span>
                        <strong aria-label={`${winnerProjection?.share.toFixed(1) ?? "0.0"}% mean simulated vote share`}>{winnerProjection?.share.toFixed(1) ?? "0.0"}%<small>mean share</small></strong>
                      </span>
                      <span className="staff-projection-win-chance">{(constituency.winProbability[constituency.winner] ?? 0).toFixed(1)}% win chance</span>
                      {isBacktestApplied && <span className="staff-projection-backtest-actual">2024: {actual2024Winner ?? "No result"}</span>}
                    </div>
                    {selectedConstituency === constituency.name && (
                    <div className="staff-projection-constituency-detail">
                      <div className="staff-projection-runner">
                        <span>Margin over {runnerUp?.code ?? "runner-up"}: {Math.abs(constituency.margin).toFixed(1)} pts</span>
                        <span>{modelData.baselineYear}: {constituency.baselineWinner} → {constituency.winner}{constituency.winner === constituency.baselineWinner ? " · hold" : " · gain"}</span>
                        {isBacktestApplied && marginDiagnostic && <span>Margin error: {marginDiagnostic.error > 0 ? "+" : ""}{marginDiagnostic.error.toFixed(1)} pts</span>}
                      </div>
                      <details className="staff-projection-detail-disclosure">
                        <summary>Bloc and historical signals</summary>
                        <div className="staff-projection-bloc-breakdown">
                        <strong>Bloc support and historical context</strong>
                        {PROJECTION_BLOCS.map((bloc) => (
                          <div key={bloc}>
                            <span>{bloc}</span>
                            <b>{constituency.blocOutcomes.find((item) => item.code === bloc)?.share.toFixed(1) ?? "0.0"}%</b>
                            <small>Δ {constituency.blocOutcomes.find((item) => item.code === bloc)?.shareChange.toFixed(1) ?? "0.0"}pp · {modelData.baselineYear} Westminster {constituency.blocShares[bloc].toFixed(1)}%</small>
                            <small>Prior Westminster history: {historicalWestminsterYears.map((year) => `${year} ${blocShareFromParties(constituency.historicalPartyShares[year], bloc).toFixed(1)}%`).join(" / ") || "No prior Westminster results"}</small>
                            <small>NI Assembly first preferences: 2017 {blocShareFromParties(constituency.assemblyPartyShares["2017"], bloc).toFixed(1)}% / 2022 {blocShareFromParties(constituency.assemblyPartyShares["2022"], bloc).toFixed(1)}%</small>
                          </div>
                        ))}
                        </div>
                      </details>
                      <details className="staff-projection-detail-disclosure staff-projection-candidate-disclosure">
                        <summary>Party participation <span>{(partyPresence[constituency.name] ?? []).length} included</span></summary>
                        <div className="staff-projection-candidate-control">
                        <div className="staff-projection-candidate-heading">
                          <strong>Include parties contesting this seat</strong>
                          <button type="button" onClick={() => setPartyPresence((current) => ({
                            ...current,
                            [constituency.name]: constituency.contestantCodes.every((code) => current[constituency.name]?.includes(code))
                              && current[constituency.name]?.length === constituency.contestantCodes.length
                              ? modelData.parties.map((party) => party.code)
                              : [...constituency.contestantCodes],
                          }))} disabled={draftProjectionMode !== appliedProjectionMode}>
                            {constituency.contestantCodes.every((code) => partyPresence[constituency.name]?.includes(code))
                              && partyPresence[constituency.name]?.length === constituency.contestantCodes.length
                              ? "Include all"
                              : "Use 2024 candidate field"}
                          </button>
                        </div>
                        <p className="staff-projection-candidate-help">An included party with no {modelData.baselineYear} vote gets its national within-bloc share multiplied by its weighted local-to-national performance ratio. Westminster years: {historicalWestminsterYears.join(", ") || "none"}; NI Assembly history is a separate signal.</p>
                        <div className="staff-projection-candidate-list">
                          {modelData.parties.map((party) => {
                            const included = partyPresence[constituency.name]?.includes(party.code) ?? false;
                            const activeCount = partyPresence[constituency.name]?.length ?? 0;
                            return (
                              <label key={party.code}>
                                <input type="checkbox" checked={included} disabled={draftProjectionMode !== appliedProjectionMode || (included && activeCount <= 1)} onChange={() => setPartyPresence((current) => {
                                  const existing = current[constituency.name] ?? [];
                                  return { ...current, [constituency.name]: included ? existing.filter((code) => code !== party.code) : [...existing, party.code] };
                                })} />
                                <i style={{ backgroundColor: party.color }} />
                                <span>{party.code}<small>{constituency.partyShares[party.code] === undefined ? "Add to scenario" : `In ${modelData.baselineYear} result`}</small></span>
                              </label>
                            );
                          })}
                        </div>
                        </div>
                      </details>
                      <div className="staff-projection-party-breakdown">
                        <div className="staff-projection-party-breakdown-heading"><span>Party</span><span>Mean share</span><span>Win chance</span><span>History</span></div>
                        {constituency.projected.map((projectedParty) => {
                          const definition = modelData.parties.find((party) => party.code === projectedParty.code);
                          const winChance = constituency.winProbability[projectedParty.code] ?? 0;
                          return (
                            <div key={projectedParty.code}>
                              <span><i style={{ backgroundColor: definition?.color ?? "#7a8589" }} />{projectedParty.code}</span>
                              <strong className="staff-projection-simulated-share">{projectedParty.share.toFixed(1)}%<small>Δ {projectedParty.shareChange >= 0 ? "+" : ""}{projectedParty.shareChange.toFixed(1)}pp</small><small>80% range {projectedParty.shareLow.toFixed(1)}–{projectedParty.shareHigh.toFixed(1)}%</small></strong>
                              <span className="staff-projection-party-chance" aria-label={`${winChance.toFixed(1)} percent estimated chance of winning`}>
                                <i><b style={{ width: `${winChance}%`, backgroundColor: definition?.color ?? "#7a8589" }} /></i>
                                <strong>{winChance.toFixed(1)}% win</strong>
                              </span>
                              <details className="staff-projection-party-history">
                                <summary>View</summary>
                                <small>
                                {modelData.baselineYear}: {projectedParty.hasBaselineResult
                                  ? `${(constituency.partyShares[projectedParty.code] ?? 0).toFixed(1)}% · observed local/national ratio ${projectedParty.baselineLocalNationalRatio.toFixed(2)}×`
                                  : "not contested"}
                                {` / weighted historical local/national ratio: ${projectedParty.historicalWithinBlocRatio === null ? "no comparable history" : `${projectedParty.historicalWithinBlocRatio.toFixed(2)}×`}`}
                                {` / Westminster local: ${historicalWestminsterYears.map((year) => `${year} ${formatHistoricalShare(constituency.historicalPartyShares[year][projectedParty.code])}`).join(", ") || "No prior Westminster results"}`}
                                {` / NI Assembly first preferences: 2017 ${(constituency.assemblyPartyShares["2017"][projectedParty.code] ?? 0).toFixed(1)}%, 2022 ${(constituency.assemblyPartyShares["2022"][projectedParty.code] ?? 0).toFixed(1)}%`}
                                </small>
                              </details>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <aside className="staff-projection-method-note">
        <span className="staff-projection-info-mark" aria-hidden="true">i</span>
        <div>
          <strong>How this early model works</strong>
          <p>The scenario is anchored to {modelData.baselineYear} constituency results. Party local strength uses a weighted ratio: in each historic cycle, a party&apos;s share of its local bloc is divided by its share of the national bloc. Each source election&apos;s ratio is additionally weighted by the square root of the share of constituencies where that party contested, so a ratio from a limited slate has less influence. For the 2019 backtest, the 2019 Westminster local-to-national ratio is included at its configured weight when the party contested, alongside earlier Westminster and NI Assembly signals; this uses the 2019 party result as well as the 2019 bloc mix. In current 2024 mode, the observed local party result anchors parties that contested; history informs swing response and fills parties absent from that baseline. Historical backtests use weighted ratios as local starting strength. Constituency bloc composition uses a weighted local-to-national ratio across the baseline Westminster result and available earlier Westminster and NI Assembly results. In simulations, Nationalist and Unionist shares are projected separately and Non-aligned is the remaining local share; this is a known simplification that can affect Alliance projections. 2024 current mode retains its observed constituency bloc shares. If no local history exists, the ratio defaults to 1. If national baseline support is zero, the historical party ratio is applied to the scenario support entered. Scenario changes then move party support proportionally to national support. The historical influence setting affects swing response only. Westminster evidence used here covers {historicalWestminsterYears.join(", ") || "no earlier elections"}; NI Assembly first preferences from 2022 and 2017 are a separate signal because they use a different electoral system. Party inclusion is configured per constituency; when a bloc has no included candidate, its projected share is redistributed among blocs with included parties. Tactical transfers between blocs are limited to Nationalist–Non-aligned and Unionist–Non-aligned. No tactical adjustment, within or across blocs, is applied when the two leading candidates belong to the same bloc. Nationalist and Unionist support never transfer directly to one another. Tactical rates remain scenario assumptions. Belfast South history is used as a proxy for Belfast South and Mid Down because the boundaries changed. Simulations vary polling error at the bloc level and constituency uncertainty at both the bloc and party-within-bloc levels. These provisional win chances are not yet calibrated against historical forecasts. {isBacktestApplied ? "2024 constituency outcomes are held out for the scorecard; if national support uses actual 2024 shares, the run is a diagnostic rather than a blind backtest." : ""}</p>
        </div>
      </aside>


    </main>
  );
}
