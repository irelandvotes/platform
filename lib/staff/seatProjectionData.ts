import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { PARTY_BY_CODE } from "./pollingGraphicCatalog";
import { getProjectionBloc, PROJECTION_BLOCS, type ProjectionBloc } from "./projectionBlocs";

export const WESTMINSTER_PROJECTION_YEARS = ["2015", "2017", "2019"] as const;
export type WestminsterProjectionYear = typeof WESTMINSTER_PROJECTION_YEARS[number];
export const ASSEMBLY_PROJECTION_YEARS = ["2017", "2022"] as const;
export type AssemblyProjectionYear = typeof ASSEMBLY_PROJECTION_YEARS[number];

export type SeatProjectionParty = {
  code: string;
  name: string;
  color: string;
  baselineShare: number;
  baselineSeats: number;
  bloc: ProjectionBloc;
};

export type SeatProjectionConstituency = {
  name: string;
  seats: number;
  votes: number;
  contestantCodes: string[];
  partyShares: Record<string, number>;
  previousPartyShares: Record<string, number>;
  historicalPartyShares: Record<WestminsterProjectionYear, Record<string, number>>;
  assemblyPartyShares: Record<AssemblyProjectionYear, Record<string, number>>;
  blocShares: Record<ProjectionBloc, number>;
  previousBlocShares: Record<ProjectionBloc, number>;
  baselineWinner: string;
};

export type SeatProjectionMapFeature = { name: string; path: string };

export type SeatProjectionBaseline = {
  baselineYear: "2019" | "2024";
  electionLabel: string;
  previousElectionLabel: string;
  previousNationalShares: Record<string, number>;
  historicalNationalShares: Record<WestminsterProjectionYear, Record<string, number>>;
  assemblyNationalShares: Record<AssemblyProjectionYear, Record<string, number>>;
  baselineBlocShares: Record<ProjectionBloc, number>;
  previousNationalBlocShares: Record<ProjectionBloc, number>;
  constituencies: SeatProjectionConstituency[];
  parties: SeatProjectionParty[];
  mapFeatures: SeatProjectionMapFeature[];
};

export type SeatProjectionData = SeatProjectionBaseline & {
  backtestBaseline: SeatProjectionBaseline;
  heldOut2024: {
    constituencies: Array<{ name: string; seats: number; winner: string }>;
    parties: Array<{ code: string; seats: number }>;
  };
};

type GeoFeature = {
  properties: { ENG_NAME_VALUE?: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};

const mapFeatureCache = new Map<string, SeatProjectionMapFeature[]>();

export function projectBoundaryFeatures(filePath: string): SeatProjectionMapFeature[] {
  const cached = mapFeatureCache.get(filePath);
  if (cached) return cached;
  const collection = JSON.parse(fs.readFileSync(filePath, "utf8")) as { features: GeoFeature[] };
  const rings = collection.features.map((feature) => {
    const polygons = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as number[][][]]
      : feature.geometry.coordinates as number[][][][];
    return {
      name: feature.properties.ENG_NAME_VALUE ?? "",
      rings: polygons.flatMap((polygon) => polygon),
    };
  });
  const positions = rings.flatMap((feature) => feature.rings.flatMap((ring) => ring));
  const bounds = positions.reduce((current, [longitude, latitude]) => ({
    minLongitude: Math.min(current.minLongitude, longitude),
    maxLongitude: Math.max(current.maxLongitude, longitude),
    minLatitude: Math.min(current.minLatitude, latitude),
    maxLatitude: Math.max(current.maxLatitude, latitude),
  }), {
    minLongitude: Infinity,
    maxLongitude: -Infinity,
    minLatitude: Infinity,
    maxLatitude: -Infinity,
  });
  const midLatitude = ((bounds.minLatitude + bounds.maxLatitude) / 2) * Math.PI / 180;
  const project = ([longitude, latitude]: number[]) => [longitude * Math.cos(midLatitude), -latitude] as const;
  const projected = rings.map((feature) => ({
    ...feature,
    rings: feature.rings.map((ring) => ring.map(project)),
  }));
  const allProjected = projected.flatMap((feature) => feature.rings.flatMap((ring) => ring));
  const projectedBounds = allProjected.reduce((current, [x, y]) => ({
    minX: Math.min(current.minX, x),
    maxX: Math.max(current.maxX, x),
    minY: Math.min(current.minY, y),
    maxY: Math.max(current.maxY, y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const { minX, maxX, minY, maxY } = projectedBounds;
  const width = 420;
  const height = 520;
  const padding = 10;
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const features = projected.map((feature) => ({
    name: feature.name,
    path: feature.rings.map((ring) => {
      const points = ring.map(([x, y]) => [
        offsetX + (x - minX) * scale,
        offsetY + (y - minY) * scale,
      ] as const);
      // Drop sub-pixel boundary noise while preserving the constituency outline.
      const simplified = points.length < 3 ? points : [
        points[0],
        ...points.slice(1, -1).reduce((kept, point) => {
          const previous = kept[kept.length - 1];
          if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) >= 0.55) kept.push(point);
          return kept;
        }, [points[0]] as Array<(typeof points)[number]>),
        points[points.length - 1],
      ];
      return simplified.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";
    }).join(" "),
  }));
  mapFeatureCache.set(filePath, features);
  return features;
}

type ConstituencyAccumulator = {
  seats: number;
  votesByParty: Record<string, number>;
};

function toNumber(value: string | undefined) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function loadNiWestminsterProjectionData(): SeatProjectionData {
  const electionDirectory = path.join(
    process.cwd(),
    "public",
    "data",
    "elections",
    "northern-ireland",
    "house-of-commons",
    "2024",
  );
  const records = parse(fs.readFileSync(path.join(electionDirectory, "election_data.csv"), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    bom: true,
  }) as Array<Record<string, string>>;
  const historicalFiles: Record<WestminsterProjectionYear, { filePath: string; firstPreferencesOnly: boolean }> = {
    "2019": { filePath: path.join(electionDirectory, "previous_results.csv"), firstPreferencesOnly: false },
    "2017": {
      filePath: path.join(process.cwd(), "public", "data", "elections", "northern-ireland", "house-of-commons", "2017", "election_data.csv"),
      firstPreferencesOnly: true,
    },
    "2015": {
      filePath: path.join(process.cwd(), "public", "data", "elections", "northern-ireland", "house-of-commons", "2015", "election_data.csv"),
      firstPreferencesOnly: true,
    },
  };
  const historicalVotes: Record<WestminsterProjectionYear, Record<string, Record<string, number>>> = {
    "2015": {},
    "2017": {},
    "2019": {},
  };
  const historicalPartyTotals: Record<WestminsterProjectionYear, Record<string, number>> = {
    "2015": {},
    "2017": {},
    "2019": {},
  };
  const historicalTotalVotes: Record<WestminsterProjectionYear, number> = {
    "2015": 0,
    "2017": 0,
    "2019": 0,
  };
  for (const year of WESTMINSTER_PROJECTION_YEARS) {
    const { filePath, firstPreferencesOnly } = historicalFiles[year];
    const historicalRecords = parse(fs.readFileSync(filePath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
      bom: true,
    }) as Array<Record<string, string>>;
    for (const row of historicalRecords) {
      if (firstPreferencesOnly && String(row.count).trim() !== "1") continue;
      const sourceConstituency = String(row.constituency ?? "").trim();
      const constituency = sourceConstituency === "Belfast South" ? "Belfast South and Mid Down" : sourceConstituency;
      const party = String(row.party ?? "").trim().toUpperCase();
      const votes = toNumber(row.votes);
      if (!constituency || !party || votes < 0) continue;
      const constituencyTotals = historicalVotes[year][constituency] ??= {};
      constituencyTotals[party] = (constituencyTotals[party] ?? 0) + votes;
      historicalPartyTotals[year][party] = (historicalPartyTotals[year][party] ?? 0) + votes;
      historicalTotalVotes[year] += votes;
    }
  }
  const grouped = new Map<string, ConstituencyAccumulator>();
  const assemblyVotes: Record<AssemblyProjectionYear, Record<string, Record<string, number>>> = {
    "2017": {},
    "2022": {},
  };
  const assemblyPartyTotals: Record<AssemblyProjectionYear, Record<string, number>> = {
    "2017": {},
    "2022": {},
  };
  const assemblyTotalVotes: Record<AssemblyProjectionYear, number> = { "2017": 0, "2022": 0 };
  for (const year of ASSEMBLY_PROJECTION_YEARS) {
    const assemblyPath = path.join(
      process.cwd(),
      "public",
      "data",
      "elections",
      "northern-ireland",
      "assembly",
      year,
      "election_data.csv",
    );
    const assemblyRecords = parse(fs.readFileSync(assemblyPath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
      bom: true,
    }) as Array<Record<string, string>>;
    for (const row of assemblyRecords) {
      if (String(row.count).trim() !== "1") continue;
      const sourceConstituency = String(row.constituency ?? "").trim();
      const constituency = sourceConstituency === "Belfast South" ? "Belfast South and Mid Down" : sourceConstituency;
      const party = String(row.party ?? "").trim().toUpperCase();
      const votes = toNumber(row.votes);
      if (!constituency || !party || votes < 0) continue;
      const constituencyTotals = assemblyVotes[year][constituency] ??= {};
      constituencyTotals[party] = (constituencyTotals[party] ?? 0) + votes;
      assemblyPartyTotals[year][party] = (assemblyPartyTotals[year][party] ?? 0) + votes;
      assemblyTotalVotes[year] += votes;
    }
  }
  for (const row of records) {
    if (String(row.count).trim() !== "1") continue;
    const constituency = String(row.constituency ?? "").trim();
    const party = String(row.party ?? "").trim().toUpperCase();
    const votes = toNumber(row.votes);
    if (!constituency || !party || votes < 0) continue;

    const current = grouped.get(constituency) ?? {
      seats: toNumber(row.seats) || 1,
      votesByParty: {},
    };
    current.votesByParty[party] = (current.votesByParty[party] ?? 0) + votes;
    grouped.set(constituency, current);
  }

  const partyTotals: Record<string, number> = {};
  let totalVotes = 0;
  const constituencies = [...grouped.entries()]
    .map(([name, result]) => {
      const votes = Object.values(result.votesByParty).reduce((sum, value) => sum + value, 0);
      const partyShares = Object.fromEntries(
        Object.entries(result.votesByParty).map(([party, partyVotes]) => {
          partyTotals[party] = (partyTotals[party] ?? 0) + partyVotes;
          return [party, votes > 0 ? (partyVotes / votes) * 100 : 0];
        }),
      );
      totalVotes += votes;
      const baselineWinner = Object.entries(result.votesByParty)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
      const historicalPartyShares = Object.fromEntries(WESTMINSTER_PROJECTION_YEARS.map((year) => {
        const historicalResults = historicalVotes[year][name] ?? {};
        const historicalTotal = Object.values(historicalResults).reduce((sum, value) => sum + value, 0);
        return [year, Object.fromEntries(Object.entries(historicalResults).map(([party, partyVotes]) => [
          party,
          historicalTotal > 0 ? (partyVotes / historicalTotal) * 100 : 0,
        ]))];
      })) as Record<WestminsterProjectionYear, Record<string, number>>;
      const previousPartyShares = historicalPartyShares["2019"];
      const assemblyPartyShares = Object.fromEntries(ASSEMBLY_PROJECTION_YEARS.map((year) => {
        const assemblyResults = assemblyVotes[year][name] ?? {};
        const assemblyTotal = Object.values(assemblyResults).reduce((sum, value) => sum + value, 0);
        return [year, Object.fromEntries(Object.entries(assemblyResults).map(([party, partyVotes]) => [
          party,
          assemblyTotal > 0 ? (partyVotes / assemblyTotal) * 100 : 0,
        ]))];
      })) as Record<AssemblyProjectionYear, Record<string, number>>;
      const blocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
        bloc,
        Object.entries(partyShares).reduce((sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0), 0),
      ])) as Record<ProjectionBloc, number>;
      const previousBlocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
        bloc,
        Object.entries(previousPartyShares).reduce((sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0), 0),
      ])) as Record<ProjectionBloc, number>;
      return {
        name,
        seats: result.seats,
        votes,
        contestantCodes: Object.keys(partyShares),
        partyShares,
        previousPartyShares,
        historicalPartyShares,
        assemblyPartyShares,
        blocShares,
        previousBlocShares,
        baselineWinner,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const baselineSeats: Record<string, number> = {};
  constituencies.forEach(({ baselineWinner, seats }) => {
    baselineSeats[baselineWinner] = (baselineSeats[baselineWinner] ?? 0) + seats;
  });

  const parties = Object.entries(partyTotals)
    .map(([code, votes]) => ({
      code,
      name: PARTY_BY_CODE[code]?.name ?? code,
      color: PARTY_BY_CODE[code]?.color ?? "#7a8589",
      baselineShare: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
      baselineSeats: baselineSeats[code] ?? 0,
      bloc: getProjectionBloc(code),
    }))
    .sort((a, b) => b.baselineShare - a.baselineShare || a.code.localeCompare(b.code));

  if (constituencies.length === 0 || parties.length === 0) {
    throw new Error("Northern Ireland 2024 constituency results could not be loaded.");
  }

  const baselineBlocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
    bloc,
    parties.reduce((sum, party) => sum + (party.bloc === bloc ? party.baselineShare : 0), 0),
  ])) as Record<ProjectionBloc, number>;
  const historicalNationalShares = Object.fromEntries(WESTMINSTER_PROJECTION_YEARS.map((year) => [
    year,
    Object.fromEntries(Object.entries(historicalPartyTotals[year]).map(([code, votes]) => [
      code,
      historicalTotalVotes[year] > 0 ? (votes / historicalTotalVotes[year]) * 100 : 0,
    ])),
  ])) as Record<WestminsterProjectionYear, Record<string, number>>;
  const previousNationalShares = historicalNationalShares["2019"];
  const assemblyNationalShares = Object.fromEntries(ASSEMBLY_PROJECTION_YEARS.map((year) => [
    year,
    Object.fromEntries(Object.entries(assemblyPartyTotals[year]).map(([code, votes]) => [
      code,
      assemblyTotalVotes[year] > 0 ? (votes / assemblyTotalVotes[year]) * 100 : 0,
    ])),
  ])) as Record<AssemblyProjectionYear, Record<string, number>>;
  const previousNationalBlocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
    bloc,
    Object.entries(previousNationalShares).reduce((sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0), 0),
  ])) as Record<ProjectionBloc, number>;
  const mapFeatures = projectBoundaryFeatures(path.join(electionDirectory, "boundaries.geojson"));
  const currentBaseline: SeatProjectionBaseline = {
    baselineYear: "2024",
    electionLabel: "Northern Ireland House of Commons 2024",
    previousElectionLabel: "2019 result reallocated to 2024 boundaries",
    previousNationalShares,
    historicalNationalShares,
    assemblyNationalShares,
    baselineBlocShares,
    previousNationalBlocShares,
    constituencies,
    parties,
    mapFeatures,
  };
  const backtestConstituencies: SeatProjectionConstituency[] = constituencies.map((constituency) => {
    const partyShares = constituency.historicalPartyShares["2019"];
    const baselineWinner = Object.entries(partyShares).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
    const blocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
      bloc,
      Object.entries(partyShares).reduce((sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0), 0),
    ])) as Record<ProjectionBloc, number>;
    return {
      ...constituency,
      votes: 100,
      partyShares,
      previousPartyShares: constituency.historicalPartyShares["2017"],
      blocShares,
      previousBlocShares: Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
        bloc,
        Object.entries(constituency.historicalPartyShares["2017"]).reduce(
          (sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0),
          0,
        ),
      ])) as Record<ProjectionBloc, number>,
      baselineWinner,
    };
  });
  const backtestBaselineSeats: Record<string, number> = {};
  backtestConstituencies.forEach(({ baselineWinner, seats }) => {
    backtestBaselineSeats[baselineWinner] = (backtestBaselineSeats[baselineWinner] ?? 0) + seats;
  });
  const backtestNationalShares = historicalNationalShares["2019"];
  const backtestPartyCodes = new Set([
    ...Object.keys(backtestNationalShares),
    ...constituencies.flatMap((constituency) => constituency.contestantCodes),
    ...backtestConstituencies.flatMap((constituency) => [...Object.keys(constituency.partyShares), constituency.baselineWinner]),
  ]);
  const backtestParties = [...backtestPartyCodes]
    .map((code) => ({
      code,
      name: PARTY_BY_CODE[code]?.name ?? code,
      color: PARTY_BY_CODE[code]?.color ?? "#7a8589",
      baselineShare: backtestNationalShares[code] ?? 0,
      baselineSeats: backtestBaselineSeats[code] ?? 0,
      bloc: getProjectionBloc(code),
    }))
    .sort((a, b) => b.baselineShare - a.baselineShare || a.code.localeCompare(b.code));
  const backtestBaselineBlocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
    bloc,
    backtestParties.reduce((sum, party) => sum + (party.bloc === bloc ? party.baselineShare : 0), 0),
  ])) as Record<ProjectionBloc, number>;
  const backtestPreviousNationalShares = historicalNationalShares["2017"];
  const backtestPreviousNationalBlocShares = Object.fromEntries(PROJECTION_BLOCS.map((bloc) => [
    bloc,
    Object.entries(backtestPreviousNationalShares).reduce((sum, [party, share]) => sum + (getProjectionBloc(party) === bloc ? share : 0), 0),
  ])) as Record<ProjectionBloc, number>;
  const backtestBaseline: SeatProjectionBaseline = {
    ...currentBaseline,
    baselineYear: "2019",
    electionLabel: "Northern Ireland House of Commons 2019 (reallocated to 2024 constituencies)",
    previousElectionLabel: "2017 result",
    previousNationalShares: backtestPreviousNationalShares,
    baselineBlocShares: backtestBaselineBlocShares,
    previousNationalBlocShares: backtestPreviousNationalBlocShares,
    constituencies: backtestConstituencies,
    parties: backtestParties,
  };

  return {
    ...currentBaseline,
    backtestBaseline,
    heldOut2024: {
      constituencies: constituencies.map(({ name, seats, baselineWinner }) => ({ name, seats, winner: baselineWinner })),
      parties: parties.map(({ code, baselineSeats }) => ({ code, seats: baselineSeats })),
    },
  };
}
