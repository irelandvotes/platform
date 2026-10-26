"use client";

import { createElement, useMemo, useState } from "react";
import { getProjectionBloc, PROJECTION_BLOCS, type ProjectionBloc } from "@/lib/staff/projectionBlocs";
import ProjectionMap from "./ProjectionMap";
import type {
  SeatProjectionData,
  SeatProjectionParty,
  SeatProjectionConstituency as BaselineConstituency,
  AssemblyProjectionYear,
  WestminsterProjectionYear,
} from "@/lib/staff/seatProjectionData";

type Props = { data: SeatProjectionData };

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

type ProjectedConstituency = SeatProjectionData["constituencies"][number] & {
  projected: Array<{
    code: string;
    bloc: ProjectionBloc;
    share: number;
    withinBlocShare: number;
    latestRelativeStrength: number;
    previousRelativeStrength: number | null;
    previousShare: number | null;
  }>;
  winner: string;
  runnerUp: string;
  margin: number;
  winProbability: Record<string, number>;
  projectedBlocShares: Record<ProjectionBloc, number>;
};

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

function formatPoints(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} pts`;
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
  for (const route of routes) {
    if (route.rate <= 0 || !parties.some((party) => party.bloc === route.from)) continue;
    const targetParties = parties.filter((party) => party.bloc === route.to);
    if (targetParties.length === 0) continue;
    const target = [...targetParties].sort((a, b) => b.withinBlocShare - a.withinBlocShare || a.code.localeCompare(b.code))[0];
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

function localBlocSwingMultiplier(
  constituency: BaselineConstituency,
  bloc: ProjectionBloc,
  data: SeatProjectionData,
  previousWeight: number,
) {
  const latest = constituency.blocShares[bloc] - data.baselineBlocShares[bloc];
  const historicalSources = [
    ...Object.entries(HISTORICAL_WESTMINSTER_WEIGHTS).map(([year, weight]) => {
      const cycle = year as WestminsterProjectionYear;
      return {
        localShare: Object.entries(constituency.historicalPartyShares[cycle]).reduce(
          (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
          0,
        ),
        nationalShare: Object.entries(data.historicalNationalShares[cycle]).reduce(
          (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
          0,
        ),
        weight,
      };
    }),
    ...Object.entries(HISTORICAL_ASSEMBLY_WEIGHTS).map(([year, weight]) => {
      const cycle = year as AssemblyProjectionYear;
      return {
        localShare: Object.entries(constituency.assemblyPartyShares[cycle]).reduce(
          (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
          0,
        ),
        nationalShare: Object.entries(data.assemblyNationalShares[cycle]).reduce(
          (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
          0,
        ),
        weight,
      };
    }),
  ];
  const availableSources = historicalSources.filter((source) => source.nationalShare > 0);
  const historical = availableSources.length > 0
    ? availableSources.reduce((sum, source) => sum + (source.localShare - source.nationalShare) * source.weight, 0)
      / availableSources.reduce((sum, source) => sum + source.weight, 0)
    : 0;
  const historicalAdjustment = (historical - latest) * (previousWeight / 100);
  return Math.min(1.75, Math.max(0.25, 1 + historicalAdjustment / 100));
}

function localWithinBlocStrength(
  partyCode: string,
  bloc: ProjectionBloc,
  constituency: BaselineConstituency,
  data: SeatProjectionData,
) {
  const sources: Array<{ localShare: number; nationalShare: number; localBloc: number; nationalBloc: number; weight: number }> = [];
  for (const [year, weight] of Object.entries(HISTORICAL_WESTMINSTER_WEIGHTS)) {
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
      weight,
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
      weight,
    });
  }

  const comparableSources = sources.filter((source) => source.localBloc > 0 && source.nationalBloc > 0);
  const totalWeight = comparableSources.reduce((sum, source) => sum + source.weight, 0);
  return totalWeight > 0
    ? comparableSources.reduce((sum, source) => sum + (
      source.localShare / source.localBloc * 100 - source.nationalShare / source.nationalBloc * 100
    ) * source.weight, 0) / totalWeight
    : 0;
}

function localPartyProfile(
  party: SeatProjectionParty,
  constituency: BaselineConstituency,
  data: SeatProjectionData,
  previousWeight: number,
) {
  const latestShare = constituency.partyShares[party.code] ?? 0;
  const latestRelativeStrength = latestShare - party.baselineShare;
  const previousShare = constituency.previousPartyShares[party.code];
  const previousNationalShare = data.previousNationalShares[party.code];
  const previousRelativeStrength = previousShare !== undefined && previousNationalShare !== undefined
    ? previousShare - previousNationalShare
    : null;

  const localBlocShare = constituency.blocShares[party.bloc];
  const nationalBlocShare = data.baselineBlocShares[party.bloc];
  const latestLocalRatio = localBlocShare > 0 ? (latestShare / localBlocShare) * 100 : 0;
  const latestNationalRatio = nationalBlocShare > 0 ? (party.baselineShare / nationalBlocShare) * 100 : 0;
  const latestWithinBlocStrength = latestLocalRatio - latestNationalRatio;
  const historicalWithinBlocStrength = localWithinBlocStrength(party.code, party.bloc, constituency, data);
  const historicalShareWeight = previousWeight / 100;
  const withinBlocSensitivity = Math.min(
    1.75,
    Math.max(0.25, 1 + ((historicalWithinBlocStrength - latestWithinBlocStrength) / 100) * (previousWeight / 100)),
  );

  return {
    latestRelativeStrength,
    previousRelativeStrength,
    previousShare: previousShare ?? null,
    latestLocalRatio,
    latestNationalRatio,
    latestWithinBlocStrength,
    historicalWithinBlocStrength,
    historicalShareWeight,
    withinBlocSensitivity,
  };
}

export default function SeatProjectionWorkspace({ data }: Props) {
  const [support, setSupport] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.parties.map((party) => [party.code, party.baselineShare.toFixed(1)])),
  );
  const [pollError, setPollError] = useState(2);
  const [localVariation, setLocalVariation] = useState(2);
  const [previousResultWeight, setPreviousResultWeight] = useState(30);
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
    previousResultWeight: 30,
    partyPresence: Object.fromEntries(data.constituencies.map((constituency) => [constituency.name, Object.keys(constituency.partyShares)])),
    tacticalVoting: { Nationalist: 0, Unionist: 0, "Non-aligned": 0 },
    interBlocTacticalVoting: { nationalistToNonAligned: 0, nonAlignedToNationalist: 0, unionistToNonAligned: 0, nonAlignedToUnionist: 0 },
  }));
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [reportExportError, setReportExportError] = useState("");
  const [hasRunProjection, setHasRunProjection] = useState(false);

  const draftSettings: ProjectionSettings = {
    support,
    pollError,
    localVariation,
    previousResultWeight,
    partyPresence,
    tacticalVoting,
    interBlocTacticalVoting,
  };
  const defaultSettings: ProjectionSettings = {
    support: Object.fromEntries(data.parties.map((party) => [party.code, party.baselineShare.toFixed(1)])),
    pollError: 2,
    localVariation: 2,
    previousResultWeight: 30,
    partyPresence: Object.fromEntries(data.constituencies.map((constituency) => [constituency.name, Object.keys(constituency.partyShares)])),
    tacticalVoting: { Nationalist: 0, Unionist: 0, "Non-aligned": 0 },
    interBlocTacticalVoting: { nationalistToNonAligned: 0, nonAlignedToNationalist: 0, unionistToNonAligned: 0, nonAlignedToUnionist: 0 },
  };
  const isDefaultSettings = JSON.stringify(draftSettings) === JSON.stringify(defaultSettings);
  const hasUnappliedChanges = JSON.stringify(draftSettings) !== JSON.stringify(appliedSettings);
  const draftSupportValues = Object.fromEntries(data.parties.map((party) => [
    party.code,
    Math.min(100, Math.max(0, Number(support[party.code]) || 0)),
  ]));
  const draftEnteredTotal = Object.values(draftSupportValues).reduce((sum, value) => sum + value, 0);
  const draftNormalizedSupport = Object.fromEntries(data.parties.map((party) => [
    party.code,
    draftEnteredTotal > 0 ? (draftSupportValues[party.code] / draftEnteredTotal) * 100 : party.baselineShare,
  ]));
  const draftInputBlocShares = normalizeBlocShares(
    Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
      bloc,
      data.parties.reduce((sum, party) => sum + (party.bloc === bloc ? draftNormalizedSupport[party.code] : 0), 0),
    ])) as Record<ProjectionBloc, number>,
    data.baselineBlocShares,
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
      data.parties.map((party) => [party.code, Math.min(100, Math.max(0, Number(appliedSupport[party.code]) || 0))]),
    );
    const enteredTotal = Object.values(supportValues).reduce((sum, value) => sum + value, 0);
    const normalizedSupport = Object.fromEntries(data.parties.map((party) => [
      party.code,
      enteredTotal > 0 ? (supportValues[party.code] / enteredTotal) * 100 : party.baselineShare,
    ]));
    const inputBlocShares = normalizeBlocShares(
      Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
        bloc,
        data.parties.reduce((sum, party) => sum + (party.bloc === bloc ? normalizedSupport[party.code] : 0), 0),
      ])) as Record<ProjectionBloc, number>,
      data.baselineBlocShares,
    );
    const projectedSeats: Record<string, number> = Object.fromEntries(data.parties.map(({ code }) => [code, 0]));
    const pointEstimates = data.constituencies.map((constituency) => {
      const includedParties = data.parties.filter((party) => appliedPartyPresence[constituency.name]?.includes(party.code));
      const availableBlocs = new Set(includedParties.map((party) => party.bloc));
      const projectedBlocBaseline = (bloc: ProjectionBloc) => {
        if (constituency.blocShares[bloc] > 0) return constituency.blocShares[bloc];
        return data.baselineBlocShares[bloc] * localBlocSwingMultiplier(constituency, bloc, data, appliedPreviousResultWeight);
      };
      const blocShares = normalizeBlocShares(
        Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
          bloc,
          availableBlocs.has(bloc)
            ? Math.max(0, projectedBlocBaseline(bloc)
              + (inputBlocShares[bloc] - data.baselineBlocShares[bloc])
                * localBlocSwingMultiplier(constituency, bloc, data, appliedPreviousResultWeight))
            : 0,
        ])) as Record<ProjectionBloc, number>,
        Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, availableBlocs.has(bloc) ? constituency.blocShares[bloc] : 0])) as Record<ProjectionBloc, number>,
      );
      const adjusted = includedParties.map((party) => {
        const profile = localPartyProfile(party, constituency, data, appliedPreviousResultWeight);
        const nationalBlocShare = inputBlocShares[party.bloc];
        const partyWithinBloc = nationalBlocShare > 0
          ? (normalizedSupport[party.code] / nationalBlocShare) * 100
          : data.baselineBlocShares[party.bloc] > 0
            ? (party.baselineShare / data.baselineBlocShares[party.bloc]) * 100
            : 0;
        const historicalStartingRatio = profile.latestNationalRatio + profile.historicalWithinBlocStrength;
        const localStartingRatio = profile.latestLocalRatio > 0
          ? profile.latestLocalRatio
          : profile.latestNationalRatio * (1 - profile.historicalShareWeight)
            + historicalStartingRatio * profile.historicalShareWeight;
        return {
          code: party.code,
          bloc: party.bloc,
          rawWithinBlocShare: Math.max(partyWithinBloc > 0 ? 0.1 : 0, localStartingRatio
            + (partyWithinBloc - profile.latestNationalRatio) * profile.withinBlocSensitivity),
          latestRelativeStrength: profile.latestRelativeStrength,
          previousRelativeStrength: profile.previousRelativeStrength,
          previousShare: profile.previousShare,
        };
      });
      const projectedWithPartyShares = adjusted
        .map((party) => {
          const sameBloc = adjusted.filter((candidate) => candidate.bloc === party.bloc);
          const blocPartyTotal = sameBloc.reduce((sum, candidate) => sum + candidate.rawWithinBlocShare, 0);
          const baselinePartyShare = data.parties.find((item) => item.code === party.code)?.baselineShare ?? 0;
          const baselineBlocShare = data.baselineBlocShares[party.bloc];
          const fallbackWithinBlocShare = baselineBlocShare > 0 ? (baselinePartyShare / baselineBlocShare) * 100 : 0;
          const withinBlocShare = blocPartyTotal > 0
            ? party.rawWithinBlocShare / blocPartyTotal
            : fallbackWithinBlocShare / 100;
          return {
            code: party.code,
            bloc: party.bloc,
            share: blocShares[party.bloc] * withinBlocShare,
            withinBlocShare,
            latestRelativeStrength: party.latestRelativeStrength,
            previousRelativeStrength: party.previousRelativeStrength,
            previousShare: party.previousShare,
          };
        });
      const tacticalWithinBlocShares = new Map(projectedWithPartyShares.map((party) => [party.code, party.withinBlocShare]));
      for (const bloc of PROJECTION_BLOCS) {
        const blocParties = projectedWithPartyShares.filter((party) => party.bloc === bloc);
        const tacticalLeader = [...blocParties].sort((a, b) => b.share - a.share || a.code.localeCompare(b.code))[0];
        if (!tacticalLeader || appliedTacticalVoting[bloc] <= 0) continue;
        const transfer = blocParties
          .filter((party) => party.code !== tacticalLeader.code)
          .reduce((sum, party) => sum + party.withinBlocShare * appliedTacticalVoting[bloc] / 100, 0);
        blocParties.forEach((party) => {
          tacticalWithinBlocShares.set(
            party.code,
            party.code === tacticalLeader.code
              ? party.withinBlocShare + transfer
              : party.withinBlocShare * (1 - appliedTacticalVoting[bloc] / 100),
          );
        });
      }
      const intraBlocProjected = projectedWithPartyShares
        .map((party) => {
          const withinBlocShare = tacticalWithinBlocShares.get(party.code) ?? party.withinBlocShare;
          return { ...party, withinBlocShare, share: blocShares[party.bloc] * withinBlocShare };
        });
      const interBlocAdjusted = applyInterBlocTacticalVoting(blocShares, intraBlocProjected, appliedInterBlocTacticalVoting);
      const projected = intraBlocProjected
        .map((party) => ({ ...party, share: interBlocAdjusted.partyShares[party.code] ?? 0 }))
        .sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
      const winner = projected[0]?.code ?? "";
      const runnerUp = projected[1]?.code ?? "";
      const margin = (projected[0]?.share ?? 0) - (projected[1]?.share ?? 0);
      if (winner) projectedSeats[winner] = (projectedSeats[winner] ?? 0) + constituency.seats;
      return { ...constituency, projected, projectedBlocShares: interBlocAdjusted.blocShares, winner, runnerUp, margin };
    });

    const pointEstimateByName = new Map(pointEstimates.map((constituency) => [constituency.name, constituency]));
    const winCounts: Record<string, Record<string, number>> = Object.fromEntries(
      data.constituencies.map((constituency) => [constituency.name, Object.fromEntries(data.parties.map(({ code }) => [code, 0]))]),
    );
    const seatSamples: Record<string, number[]> = Object.fromEntries(data.parties.map(({ code }) => [code, []]));
    const largestPartyCounts: Record<string, number> = Object.fromEntries(data.parties.map(({ code }) => [code, 0]));
    const iterations = SIMULATION_ITERATIONS;
    const normal = createNormalGenerator(JSON.stringify(appliedSettings));
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const simulatedSeats: Record<string, number> = Object.fromEntries(data.parties.map(({ code }) => [code, 0]));
      const noisyNationalist = Math.max(0, inputBlocShares.Nationalist + normal() * appliedPollError);
      const noisyUnionist = Math.max(0, inputBlocShares.Unionist + normal() * appliedPollError);
      const noisyBlocShares = normalizeBlocShares({
        Nationalist: noisyNationalist,
        Unionist: noisyUnionist,
        "Non-aligned": Math.max(0, 100 - noisyNationalist - noisyUnionist),
      }, inputBlocShares);

      for (const constituency of data.constituencies) {
        const point = pointEstimateByName.get(constituency.name);
        const availableBlocs = new Set(point?.projected.map((party) => party.bloc) ?? []);
        const projectedBlocBaseline = (bloc: ProjectionBloc) => constituency.blocShares[bloc] > 0
          ? constituency.blocShares[bloc]
          : inputBlocShares[bloc] * localBlocSwingMultiplier(constituency, bloc, data, appliedPreviousResultWeight);
        const noisyLocalNationalist = availableBlocs.has("Nationalist") ? Math.max(0,
          projectedBlocBaseline("Nationalist")
          + (noisyBlocShares.Nationalist - inputBlocShares.Nationalist)
            * localBlocSwingMultiplier(constituency, "Nationalist", data, appliedPreviousResultWeight)
          + normal() * appliedLocalVariation) : 0;
        const noisyLocalUnionist = availableBlocs.has("Unionist") ? Math.max(0,
          projectedBlocBaseline("Unionist")
          + (noisyBlocShares.Unionist - inputBlocShares.Unionist)
            * localBlocSwingMultiplier(constituency, "Unionist", data, appliedPreviousResultWeight)
          + normal() * appliedLocalVariation) : 0;
        const localBlocShares = normalizeBlocShares({
          Nationalist: noisyLocalNationalist,
          Unionist: noisyLocalUnionist,
          "Non-aligned": availableBlocs.has("Non-aligned") ? Math.max(0, 100 - noisyLocalNationalist - noisyLocalUnionist) : 0,
        }, Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [bloc, availableBlocs.has(bloc) ? constituency.blocShares[bloc] : 0])) as Record<ProjectionBloc, number>);
        const simulatedWithinBlocParties = perturbWithinBlocPartyShares(
          (point?.projected ?? []).map((party) => ({
            code: party.code,
            bloc: party.bloc,
            withinBlocShare: party.withinBlocShare,
          })),
          appliedLocalVariation,
          normal,
        );
        const interBlocAdjusted = applyInterBlocTacticalVoting(localBlocShares, simulatedWithinBlocParties, appliedInterBlocTacticalVoting);
        const localVotes = (point?.projected ?? []).map((party) => ({
          code: party.code,
          value: interBlocAdjusted.partyShares[party.code] ?? 0,
        }));
        const localWinner = localVotes.sort((a, b) => b.value - a.value || a.code.localeCompare(b.code))[0]?.code;
        if (localWinner) {
          winCounts[constituency.name][localWinner] += 1;
          simulatedSeats[localWinner] += constituency.seats;
        }
      }
      data.parties.forEach(({ code }) => seatSamples[code].push(simulatedSeats[code]));
      const highestSeatCount = Math.max(...Object.values(simulatedSeats));
      const leaders = Object.entries(simulatedSeats).filter(([, seats]) => seats === highestSeatCount);
      leaders.forEach(([code]) => { largestPartyCounts[code] += 1 / leaders.length; });
    }

    Object.values(seatSamples).forEach((samples) => samples.sort((a, b) => a - b));

    const constituencies: ProjectedConstituency[] = pointEstimates.map((constituency) => ({
      ...constituency,
      winProbability: Object.fromEntries(
        data.parties.map(({ code }) => [
          code,
          smoothedSimulationChance(winCounts[constituency.name][code], iterations, data.parties.length),
        ]),
      ),
    }));

    const standings = data.parties
      .map((party) => ({
        ...party,
        projectedShare: enteredTotalShare(supportValues, party.code),
        seats: projectedSeats[party.code] ?? 0,
        change: (projectedSeats[party.code] ?? 0) - party.baselineSeats,
        medianSeats: quantile(seatSamples[party.code], 0.5),
        lowSeats: quantile(seatSamples[party.code], 0.1),
        highSeats: quantile(seatSamples[party.code], 0.9),
        largestPartyProbability: smoothedSimulationChance(largestPartyCounts[party.code], iterations, data.parties.length),
      }))
      .sort((a, b) => b.seats - a.seats || b.baselineSeats - a.baselineSeats || a.code.localeCompare(b.code));
    return { constituencies, standings, enteredTotal, iterations, inputBlocShares };
  }, [data, appliedSettings]);

  const totalSeats = data.constituencies.reduce((sum, constituency) => sum + constituency.seats, 0);

  function resetToBaseline() {
    setSupport(Object.fromEntries(data.parties.map((party) => [party.code, party.baselineShare.toFixed(1)])));
    setPollError(2);
    setLocalVariation(2);
    setPreviousResultWeight(30);
    setPartyPresence(Object.fromEntries(data.constituencies.map((constituency) => [constituency.name, Object.keys(constituency.partyShares)])));
    setTacticalVoting({ Nationalist: 0, Unionist: 0, "Non-aligned": 0 });
    setInterBlocTacticalVoting({ nationalistToNonAligned: 0, nonAlignedToNationalist: 0, unionistToNonAligned: 0, nonAlignedToUnionist: 0 });
  }

  function runProjection() {
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
    try {
      const [{ pdf }, { default: SeatProjectionPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./SeatProjectionPdf"),
      ]);
      const reportDate = new Date().toLocaleString("en-IE", { dateStyle: "long", timeStyle: "short" });
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
        data,
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
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `ireland-votes-ni-seat-projection-${new Date().toISOString().slice(0, 10)}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error("Projection PDF export failed", error);
      setReportExportError("The PDF could not be generated. Please try again.");
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
          <small>NI House of Commons · FPTP</small>
        </div>

        <div className="staff-projection-toolbar-tile staff-projection-toolbar-constituencies">
          <span className="staff-projection-toolbar-label">Constituencies</span>
          <strong>{data.constituencies.length}</strong>
          <small>NI-wide</small>
        </div>
        <div className="staff-projection-toolbar-tile staff-projection-toolbar-seats">
          <span className="staff-projection-toolbar-label">Seats</span>
          <strong>{totalSeats}</strong>
          <small>Single-member</small>
        </div>
        <div className="staff-projection-toolbar-tile staff-projection-toolbar-detail">
          <span className="staff-projection-toolbar-label">Baseline</span>
          <strong>Westminster 2024</strong>
          <small>Northern Ireland</small>
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
            <span>{hasRunProjection && !isDefaultSettings ? "Update projection" : "Run projection"}</span>
            <small role="status" aria-live="polite">{hasUnappliedChanges ? (hasRunProjection ? "Scenario changed" : "Draft changed") : "Results up to date"}</small>
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
      {reportExportError && <p className="staff-projection-export-error" role="alert">{reportExportError}</p>}

      <div className="staff-projection-layout">
        <section className="staff-projection-input-card" aria-labelledby="projection-input-heading">
          <div className="staff-projection-section-heading">
            <div>
              <p className="staff-eyebrow">SCENARIO INPUT</p>
              <h2 id="projection-input-heading">National party support</h2>
            </div>
          </div>
          <p className="staff-projection-help">
            Values start at each party&apos;s 2024 NI-wide first-preference share. Edit the support or constituency field, then run the projection to update the results.
          </p>
          <div className="staff-projection-party-inputs">
            {data.parties.map((party) => (
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
            <p>Inter-bloc tactical transfers can run between Nationalist and Non-aligned, or Unionist and Non-aligned. Direct Nationalist-Unionist transfers are excluded.</p>
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
            <p>This transfers support only among parties in the same bloc.</p>
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
            <p>Each percentage is the share of the originating bloc that transfers. It goes to the strongest included party in the destination bloc. No Nationalist-to-Unionist or Unionist-to-Nationalist transfer is available.</p>
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
              <span>Historical influence on local strength <strong>{previousResultWeight}%</strong></span>
              <input type="range" min="0" max="100" step="5" value={previousResultWeight} onChange={(event) => setPreviousResultWeight(Number(event.target.value))} />
            </label>
            <p>Local party strength uses Westminster constituency-versus-national results from 2019, 2017 and 2015, with NI Assembly first preferences from 2022 and 2017 as a separate signal. If an included party has no 2024 constituency vote, its history seeds a starting share; existing 2024 local shares remain the anchor. Assembly results are not treated as direct Westminster equivalents.</p>
            <p className="staff-projection-simulation-note">The 10,000 runs give about ±1 percentage point of Monte Carlo error at 95% confidence for a 50% estimate. More runs would have diminishing returns; they do not make the model assumptions more accurate. Win chances use light smoothing, avoid displaying 0% or 100%, and are not yet calibrated against historical forecasts.</p>
          </div>
            </div>
          </details>
        </section>

        <div className="staff-projection-results">
          {hasUnappliedChanges && <p className="staff-projection-pending-note" role="status">Showing the last run. Press <strong>{hasRunProjection && !isDefaultSettings ? "Update projection" : "Run projection"}</strong> to apply your draft settings.</p>}
          <section className="staff-projection-result-card staff-projection-standings-card" aria-labelledby="projection-seats-heading">
            <div className="staff-projection-section-heading">
              <div><p className="staff-eyebrow">NI-WIDE RESULT</p><h2 id="projection-seats-heading">Estimated seat result</h2></div>
              <span className="staff-projection-baseline-label">Compared with 2024</span>
            </div>
            <div className="staff-projection-standings">
              {projection.standings.map((party) => (
                <div className="staff-projection-standing" key={party.code}>
                  <div className="staff-projection-standing-label">
                    <i style={{ backgroundColor: party.color }} />
                    <strong>{party.code}</strong>
                    <span>{party.name}</span>
                    <span className={`staff-projection-change${party.change === 0 ? " is-neutral" : party.change > 0 ? " is-gain" : " is-loss"}`}>
                      {party.change > 0 ? `+${party.change}` : party.change}
                    </span>
                  </div>
                  <div className="staff-projection-standing-metrics">
                    <div className="staff-projection-standing-seatmetric"><strong style={{ backgroundColor: party.color, color: textColorForPartyColor(party.color) }}>{party.seats}</strong><small>Seats</small></div>
                    <div className="staff-projection-standing-votemetric"><strong>{party.projectedShare.toFixed(1)}%</strong><small>Vote share</small></div>
                  </div>
                  <div className="staff-projection-seat-track"><span style={{ width: `${(party.seats / totalSeats) * 100}%`, backgroundColor: party.color }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="staff-projection-result-card staff-projection-map-card" aria-labelledby="projection-map-heading">
            <div className="staff-projection-section-heading">
              <div><p className="staff-eyebrow">GEOGRAPHIC VIEW</p><h2 id="projection-map-heading">Projected winners by constituency</h2></div>
              <span className="staff-projection-baseline-label">Select a seat for details</span>
            </div>
            <ProjectionMap features={data.mapFeatures} constituencies={projection.constituencies} parties={data.parties} />
          </section>

          <section className="staff-projection-result-card staff-projection-range-card" aria-labelledby="projection-range-heading">
            <div className="staff-projection-section-heading">
              <div><p className="staff-eyebrow">SIMULATION</p><h2 id="projection-range-heading">Seat outcomes across {projection.iterations.toLocaleString()} runs</h2></div>
              <span className="staff-projection-baseline-label">Middle 80% range</span>
            </div>
            <div className="staff-projection-range-legend"><span><i className="is-range" />Middle 80% of runs</span><span><i className="is-median" />Median</span><span><i className="is-baseline" />2024 result</span></div>
            <div className="staff-projection-range-list">
              {projection.standings.map((party) => (
                <div
                  className="staff-projection-range-row"
                  key={party.code}
                  role="img"
                  aria-label={`${party.name}: median ${party.medianSeats} seats, middle 80 percent range ${party.lowSeats} to ${party.highSeats}, 2024 baseline ${party.baselineSeats}`}
                >
                  <span className="staff-projection-range-name"><i style={{ backgroundColor: party.color }} />{party.code}</span>
                  <span className="staff-projection-range-track">
                    <i className="staff-projection-range-baseline" style={{ left: `${(party.baselineSeats / totalSeats) * 100}%` }} />
                    <i className="staff-projection-range-band" style={{ left: `${(party.lowSeats / totalSeats) * 100}%`, width: `${((party.highSeats - party.lowSeats) / totalSeats) * 100}%`, backgroundColor: party.color }} />
                    <i className="staff-projection-range-median" style={{ left: `${(party.medianSeats / totalSeats) * 100}%`, borderColor: party.color }} />
                  </span>
                  <span className="staff-projection-range-value">{party.medianSeats} <small>({party.lowSeats}-{party.highSeats})</small></span>
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
                  {data.constituencies.map((constituency) => <option key={constituency.name} value={constituency.name}>{constituency.name}</option>)}
                </select>
              </label>
            </div>
            <div className={`staff-projection-constituency-list${selectedConstituency === "all" ? " is-all" : " is-single"}`}>
              {projection.constituencies.map((constituency) => {
                if (selectedConstituency !== "all" && selectedConstituency !== constituency.name) return null;
                const winner = data.parties.find((party) => party.code === constituency.winner);
                const runnerUp = data.parties.find((party) => party.code === constituency.runnerUp);
                return (
                  <div className="staff-projection-constituency" key={constituency.name}>
                    <div className="staff-projection-constituency-summary">
                      <span className="staff-projection-constituency-name"><strong>{constituency.name}</strong><small>{constituency.seats} seat</small></span>
                      <span className="staff-projection-winner">
                        <span><i style={{ backgroundColor: winner?.color ?? "#7a8589" }} />{winner?.code ?? "-"}</span>
                        <strong>{constituency.projected[0]?.share.toFixed(1) ?? "0.0"}%</strong>
                      </span>
                      <span className="staff-projection-win-chance">{(constituency.winProbability[constituency.winner] ?? 0).toFixed(1)}% estimated win</span>
                      <span className="staff-projection-win-bar" role="img" aria-label={`Estimated win chances: ${data.parties.map((party) => `${party.code} ${(constituency.winProbability[party.code] ?? 0).toFixed(1)} percent`).join(", ")}`}>
                        {data.parties.map((party) => {
                          const probability = constituency.winProbability[party.code] ?? 0;
                          return probability > 0 ? <i key={party.code} title={`${party.code}: ${probability.toFixed(1)}%`} style={{ width: `${probability}%`, backgroundColor: party.color }} /> : null;
                        })}
                      </span>
                    </div>
                    {selectedConstituency === constituency.name && (
                    <div className="staff-projection-constituency-detail">
                      <div className="staff-projection-runner">
                        <span>Next: {runnerUp?.code ?? "-"} ({constituency.projected[1]?.share.toFixed(1) ?? "0.0"}%)</span>
                        <span>Lead {constituency.margin.toFixed(1)} pts</span>
                      </div>
                      <div className="staff-projection-bloc-breakdown">
                        <strong>Bloc support</strong>
                        {PROJECTION_BLOCS.map((bloc) => (
                          <div key={bloc}>
                            <span>{bloc}</span>
                            <b>{constituency.projectedBlocShares[bloc].toFixed(1)}%</b>
                            <small>2024 Westminster {constituency.blocShares[bloc].toFixed(1)}%</small>
                            <small>Westminster history: 2019 {blocShareFromParties(constituency.historicalPartyShares["2019"], bloc).toFixed(1)}% / 2017 {blocShareFromParties(constituency.historicalPartyShares["2017"], bloc).toFixed(1)}% / 2015 {blocShareFromParties(constituency.historicalPartyShares["2015"], bloc).toFixed(1)}%</small>
                            <small>NI Assembly first preferences: 2017 {blocShareFromParties(constituency.assemblyPartyShares["2017"], bloc).toFixed(1)}% / 2022 {blocShareFromParties(constituency.assemblyPartyShares["2022"], bloc).toFixed(1)}%</small>
                          </div>
                        ))}
                      </div>
                      <div className="staff-projection-candidate-control">
                        <div className="staff-projection-candidate-heading">
                          <strong>Include parties contesting this seat</strong>
                          <button type="button" onClick={() => setPartyPresence((current) => ({
                            ...current,
                            [constituency.name]: current[constituency.name]?.length === data.parties.length
                              ? Object.keys(constituency.partyShares)
                              : data.parties.map((party) => party.code),
                          }))}>{partyPresence[constituency.name]?.length === data.parties.length ? "Use 2024 field" : "Include all"}</button>
                        </div>
                        <p className="staff-projection-candidate-help">An included party with no 2024 vote gets a starting share from national support and its local-versus-national record across Westminster 2019, 2017 and 2015. NI Assembly history provides a separate signal.</p>
                        <div className="staff-projection-candidate-list">
                          {data.parties.map((party) => {
                            const included = partyPresence[constituency.name]?.includes(party.code) ?? false;
                            const activeCount = partyPresence[constituency.name]?.length ?? 0;
                            return (
                              <label key={party.code}>
                                <input type="checkbox" checked={included} disabled={included && activeCount <= 1} onChange={() => setPartyPresence((current) => {
                                  const existing = current[constituency.name] ?? [];
                                  return { ...current, [constituency.name]: included ? existing.filter((code) => code !== party.code) : [...existing, party.code] };
                                })} />
                                <i style={{ backgroundColor: party.color }} />
                                <span>{party.code}<small>{constituency.partyShares[party.code] === undefined ? "Add to scenario" : "In 2024 result"}</small></span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="staff-projection-party-breakdown">
                        {constituency.projected.map((projectedParty) => {
                          const definition = data.parties.find((party) => party.code === projectedParty.code);
                          const winChance = constituency.winProbability[projectedParty.code] ?? 0;
                          return (
                            <div key={projectedParty.code}>
                              <span><i style={{ backgroundColor: definition?.color ?? "#7a8589" }} />{projectedParty.code}</span>
                              <strong>{projectedParty.share.toFixed(1)}%</strong>
                              <span className="staff-projection-party-chance" aria-label={`${winChance.toFixed(1)} percent estimated chance of winning`}>
                                <i><b style={{ width: `${winChance}%`, backgroundColor: definition?.color ?? "#7a8589" }} /></i>
                                <strong>{winChance.toFixed(1)}% win</strong>
                              </span>
                              <small>
                                2024: {(constituency.partyShares[projectedParty.code] ?? 0).toFixed(1)}% ({formatPoints(projectedParty.latestRelativeStrength)} vs NI)
                                {` / Westminster local: 2019 ${formatHistoricalShare(constituency.historicalPartyShares["2019"][projectedParty.code])}, 2017 ${formatHistoricalShare(constituency.historicalPartyShares["2017"][projectedParty.code])}, 2015 ${formatHistoricalShare(constituency.historicalPartyShares["2015"][projectedParty.code])}`}
                                {` / NI Assembly first preferences: 2017 ${(constituency.assemblyPartyShares["2017"][projectedParty.code] ?? 0).toFixed(1)}%, 2022 ${(constituency.assemblyPartyShares["2022"][projectedParty.code] ?? 0).toFixed(1)}%`}
                              </small>
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
          <p>The unchanged scenario is anchored to 2024 constituency results. National support changes are applied to that baseline, with Westminster and Assembly history adjusting each constituency&apos;s swing sensitivity. The model groups parties as Nationalist, Unionist or Non-aligned and allocates each bloc&apos;s projected share among included parties using current support and constituency history. For an included party with no 2024 local vote, its starting share is seeded from national support and its historical local-versus-national strength where available. Westminster evidence covers 2019, 2017 and 2015; NI Assembly first preferences from 2022 and 2017 remain a separate signal because they use a different electoral system. Party inclusion is configured per constituency; when a bloc has no included candidate, its projected share is redistributed among blocs with included parties. Tactical transfers can move support between Nationalist and Non-aligned, or Unionist and Non-aligned. Nationalist and Unionist support never transfer directly to one another. Within-bloc and inter-bloc tactical rates are scenario assumptions. Belfast South history is used as a proxy for Belfast South and Mid Down because the boundaries changed. Simulations vary polling error at the bloc level and constituency uncertainty at both the bloc and party-within-bloc levels. These provisional win chances are not yet calibrated against historical forecasts.</p>
        </div>
      </aside>


    </main>
  );
}
