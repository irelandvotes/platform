import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { ElectionComparison, LatestPollSnapshot, PollingGraphicOptions } from "./pollingGraphicCatalog";

const PARTY_ELECTION_CATEGORIES: Record<string, string> = {
  dail: "Dáil Éireann",
  european: "European Parliament",
  assembly: "NI Assembly",
  "house-of-commons": "House of Commons",
};

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

export function loadPollingGraphicOptions(): PollingGraphicOptions {
  return {
    ...readPollingSources(),
    elections: readElectionComparisons(),
    latestPolls: {
      dail: readLatestPoll("ireland/dail/polls.csv"),
      niAssembly: readLatestPoll("northern-ireland/assembly/polls.csv"),
    },
  };
}
