import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { ElectionArchiveArea, ElectionArchiveCandidate, ElectionArchiveEntry, ElectionComparison, LatestPollSnapshot, PollingGraphicOptions } from "./pollingGraphicCatalog";

const PARTY_ELECTION_CATEGORIES: Record<string, string> = {
  dail: "Dáil Éireann",
  european: "European Parliament",
  assembly: "NI Assembly",
  "house-of-commons": "House of Commons",
};

const ARCHIVE_ELECTION_CATEGORIES = new Set(["dail", "european", "assembly", "house-of-commons"]);
const ELECTION_DATES: Record<string, string> = {
  "ireland/dail/2024": "2024-11-29",
  "ireland/dail/2020": "2020-02-08",
  "ireland/dail/2016": "2016-02-26",
  "ireland/european/2024": "2024-06-07",
  "ireland/european/2019": "2019-05-24",
  "ireland/european/2014": "2014-05-23",
  "northern-ireland/assembly/2022": "2022-05-05",
  "northern-ireland/assembly/2017": "2017-03-02",
  "northern-ireland/house-of-commons/2024": "2024-07-04",
  "northern-ireland/house-of-commons/2019": "2019-12-12",
  "northern-ireland/house-of-commons/2017": "2017-06-08",
  "northern-ireland/house-of-commons/2015": "2015-05-07",
};

function electionCategoryLabel(category: string) {
  return PARTY_ELECTION_CATEGORIES[category] ?? category.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readElectionArchive(): ElectionArchiveEntry[] {
  const root = path.join(process.cwd(), "public", "data", "elections");
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const collect = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const itemPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(itemPath);
      else if (entry.name === "election_data.csv") files.push(itemPath);
    }
  };
  collect(root);

  return files.flatMap((filePath) => {
    const parts = path.relative(root, filePath).split(path.sep);
    const [country, category, year, ...rest] = parts;
    if (!country || !category || !year || !ARCHIVE_ELECTION_CATEGORIES.has(category) || !/^\d{4}$/.test(year)) return [];
    const scope = rest[0] && rest[0] !== "election_data.csv" ? rest[0] : "";
    const id = [country, category, year, scope].filter(Boolean).join("/");
    const records = parse(fs.readFileSync(filePath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
      bom: true,
    }) as Array<Record<string, string>>;
    const grouped = new Map<string, Array<Record<string, string>>>();
    for (const row of records) {
      if (row.count && row.count.trim() !== "1") continue;
      const area = row.constituency?.trim() || "National";
      const votes = Number(String(row.votes ?? "").replace(/,/g, ""));
      const party = row.party?.trim().toUpperCase();
      if (!party || !Number.isFinite(votes) || votes < 0) continue;
      grouped.set(area, [...(grouped.get(area) ?? []), row]);
    }
    const areas: ElectionArchiveArea[] = [...grouped.entries()].map(([name, rows]) => {
      const totalVotes = rows.reduce((sum, row) => sum + (Number(String(row.votes ?? "").replace(/,/g, "")) || 0), 0);
      const candidates: ElectionArchiveCandidate[] = rows.map((row) => {
        const votes = Number(String(row.votes ?? "").replace(/,/g, "")) || 0;
        return { name: row.candidate?.trim() || row.party?.trim() || "Candidate", party: row.party.trim().toUpperCase(), votes, share: totalVotes ? votes / totalVotes * 100 : 0, status: row.status?.trim().toLowerCase() ?? "" };
      }).sort((a, b) => b.votes - a.votes);
      const partyTotals = new Map<string, { votes: number; elected: number }>();
      candidates.forEach((candidate) => {
        const current = partyTotals.get(candidate.party) ?? { votes: 0, elected: 0 };
        current.votes += candidate.votes;
        if (candidate.status === "elected") current.elected += 1;
        partyTotals.set(candidate.party, current);
      });
      const parties = [...partyTotals.entries()].map(([code, value]) => ({ code, votes: value.votes, share: totalVotes ? value.votes / totalVotes * 100 : 0, elected: value.elected })).sort((a, b) => b.votes - a.votes);
      const seats = Number(String(rows[0]?.seats ?? "").replace(/,/g, ""));
      const turnout = Number(String(rows[0]?.turnout ?? "").replace(/,/g, ""));
      return { name, seats: Number.isFinite(seats) && seats > 0 ? seats : null, turnout: Number.isFinite(turnout) && turnout > 0 ? turnout : null, candidates, parties };
    }).sort((a, b) => a.name.localeCompare(b.name));
    if (!areas.length) return [];
    const electionName = electionCategoryLabel(category);
    const geographicLabel = country === "ireland" ? "Ireland" : "Northern Ireland";
    const areaLabel = scope ? scope.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
    const label = [electionName, geographicLabel, year, areaLabel].filter(Boolean).join(" · ");
    return [{ id, label, date: ELECTION_DATES[[country, category, year].join("/")] ?? null, areas }];
  }).sort((a, b) => b.id.localeCompare(a.id));
}

function uniqueValues(values: Array<string | undefined>) {
  const byLowerCase = new Map<string, string>();
  values.forEach((value) => {
    const clean = value?.trim();
    if (clean) byLowerCase.set(clean.toLocaleLowerCase(), clean);
  });
  return [...byLowerCase.values()].sort((a, b) => a.localeCompare(b));
}

function readPollingSources(): Pick<PollingGraphicOptions, "pollsters" | "commissioners"> {
  const paths = [
    path.join(process.cwd(), "public", "data", "polling", "ireland", "dail", "polls.csv"),
    path.join(process.cwd(), "public", "data", "polling", "northern-ireland", "assembly", "polls.csv"),
  ];
  const records = paths.flatMap((filePath) => {
    if (!fs.existsSync(filePath)) return [];
    return parse(fs.readFileSync(filePath, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
      bom: true,
    }) as Array<Record<string, string>>;
  });

  return {
    pollsters: uniqueValues(records.map((row) => row.pollster)),
    commissioners: uniqueValues(records.map((row) => row.commissioner)),
  };
}

function readLatestPoll(relativePath: string): LatestPollSnapshot | null {
  const filePath = path.join(process.cwd(), "public", "data", "polling", ...relativePath.split("/"));
  if (!fs.existsSync(filePath)) return null;

  const records = parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    bom: true,
  }) as Array<Record<string, string>>;
  const datedRecords = records
    .map((record) => ({ record, time: Date.parse(record.date ?? "") }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time);
  const latest = datedRecords[0];
  if (!latest) return null;
  const metadata = new Set(["date", "commissioner", "pollster", "sample", "moe"]);
  const readPartyShares = (record: Record<string, string>) => {
    const shares: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(record)) {
      if (metadata.has(key.toLowerCase())) continue;
      const value = Number(String(rawValue ?? "").replace(/,/g, ""));
      if (Number.isFinite(value) && value >= 0 && rawValue !== "") {
        shares[key.trim().toUpperCase()] = value;
      }
    }
    return shares;
  };
  const sample = Number(String(latest.record.sample ?? "").replace(/,/g, ""));
  const history = datedRecords.map(({ record, time }) => ({
    date: new Date(time).toISOString().slice(0, 10),
    pollster: record.pollster?.trim() ?? "",
    commissioner: record.commissioner?.trim() ?? "",
    partyShares: readPartyShares(record),
  }));

  return {
    date: new Date(latest.time).toISOString().slice(0, 10),
    sample: Number.isFinite(sample) && sample > 0 ? sample : null,
    pollster: latest.record.pollster?.trim() ?? "",
    commissioner: latest.record.commissioner?.trim() ?? "",
    partyShares: readPartyShares(latest.record),
    history,
  };
}

function readElectionComparison(
  country: string,
  category: string,
  year: string,
  label: string,
  filePath: string,
): ElectionComparison | null {
  const records = parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    bom: true,
  }) as Array<Record<string, string>>;

  const totals: Record<string, number> = {};
  let totalVotes = 0;

  for (const row of records) {
    if ("count" in row && String(row.count).trim() && String(row.count).trim() !== "1") {
      continue;
    }

    const party = String(row.party ?? "").trim().toUpperCase();
    const votes = Number(String(row.votes ?? "0").replace(/,/g, ""));
    if (!party || !Number.isFinite(votes) || votes <= 0) continue;

    totals[party] = (totals[party] ?? 0) + votes;
    totalVotes += votes;
  }

  if (!totalVotes) return null;

  const partyShares = Object.fromEntries(
    Object.entries(totals).map(([party, votes]) => [party, Math.round((votes / totalVotes) * 1000) / 10]),
  );

  return {
    id: `${country}/${category}/${year}`,
    label,
    partyShares,
  };
}

function readElectionComparisons(): ElectionComparison[] {
  const root = path.join(process.cwd(), "public", "data", "elections");
  if (!fs.existsSync(root)) return [];

  const comparisons: ElectionComparison[] = [];
  const countries = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  for (const countryEntry of countries) {
    const country = countryEntry.name;
    const countryPath = path.join(root, country);
    const categories = fs.readdirSync(countryPath, { withFileTypes: true }).filter((entry) => entry.isDirectory());

    for (const categoryEntry of categories) {
      const category = categoryEntry.name;
      const categoryLabel = PARTY_ELECTION_CATEGORIES[category];
      if (!categoryLabel) continue;

      const categoryPath = path.join(countryPath, category);
      const years = fs.readdirSync(categoryPath, { withFileTypes: true }).filter((entry) => entry.isDirectory());

      for (const yearEntry of years) {
        const year = yearEntry.name;
        if (!/^\d{4}$/.test(year)) continue;

        const folderPath = path.join(categoryPath, year);
        const filePath = path.join(folderPath, "election_data.csv");
        if (!fs.existsSync(filePath)) continue;

        const countryLabel = country === "ireland" ? "Ireland" : "NI";
        const label = category === "dail"
          ? `${categoryLabel} ${year}`
          : `${categoryLabel} · ${countryLabel} · ${year}`;
        const displayLabel = categoryLabel.includes("NI") ? `${categoryLabel} · ${year}` : label;
        const comparison = readElectionComparison(country, category, year, displayLabel, filePath);
        if (comparison) comparisons.push(comparison);
      }
    }
  }

  return comparisons.sort((a, b) => b.id.localeCompare(a.id));
}

export function loadPollingGraphicOptions(includeElectionArchive = false): PollingGraphicOptions {
  return {
    ...readPollingSources(),
    elections: readElectionComparisons(),
    electionArchive: includeElectionArchive ? readElectionArchive() : [],
    latestPolls: {
      dail: readLatestPoll("ireland/dail/polls.csv"),
      niAssembly: readLatestPoll("northern-ireland/assembly/polls.csv"),
    },
  };
}
