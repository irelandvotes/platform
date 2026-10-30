import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { loadNiAssemblyProjectionData } from "./niAssemblyProjectionData";
import { PARTY_BY_CODE } from "./pollingGraphicCatalog";
import { loadNiWestminsterProjectionData } from "./seatProjectionData";

export type CompositionParty = { code: string; name: string; seats: number; color: string };
export type CompositionTemplate = {
  id: "hoc" | "assembly" | "dail" | "seanad";
  label: string;
  title: string;
  date: string;
  totalSeats: number;
  mode: "map" | "hemicycle";
  sourceLabel: string;
  parties: CompositionParty[];
  constituencies?: Array<{ name: string; winner: string }>;
  mapFeatures?: Array<{ name: string; path: string }>;
};

function party(code: string, seats: number): CompositionParty {
  const definition = PARTY_BY_CODE[code];
  return { code, name: definition?.graphicName ?? definition?.name ?? code, seats, color: definition?.color ?? "#788589" };
}

function loadDail2024Seats() {
  const filePath = path.join(process.cwd(), "public", "data", "elections", "ireland", "dail", "2024", "election_data.csv");
  const rows = parse(fs.readFileSync(filePath, "utf8"), { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true, bom: true }) as Array<Record<string, string>>;
  const candidates = new Map<string, { party: string; status: string }>();
  for (const row of rows) {
    const id = String(row.candidate_id ?? row.candidate ?? "").trim().toLowerCase();
    const code = String(row.party ?? "IND").trim().toUpperCase();
    const constituency = String(row.constituency ?? "").trim().toLowerCase();
    if (id) candidates.set(`${constituency}:${code}:${id}`, { party: code, status: String(row.status ?? "").trim().toLowerCase() });
  }
  const seats: Record<string, number> = {};
  for (const candidate of candidates.values()) {
    if (candidate.status === "elected") seats[candidate.party] = (seats[candidate.party] ?? 0) + 1;
  }
  return Object.entries(seats).map(([code, count]) => party(code, count)).sort((a, b) => b.seats - a.seats || a.code.localeCompare(b.code));
}

export function loadCompositionTemplates(): CompositionTemplate[] {
  const westminster = loadNiWestminsterProjectionData();
  const assembly = loadNiAssemblyProjectionData();
  return [
    {
      id: "hoc", label: "House of Commons", title: "House of Commons composition", date: "2024-07-04", totalSeats: 18, mode: "map", sourceLabel: "2024 General Election baseline",
      parties: westminster.parties.filter((item) => item.baselineSeats > 0).map((item) => party(item.code, item.baselineSeats)).sort((a, b) => b.seats - a.seats || a.code.localeCompare(b.code)),
      constituencies: westminster.constituencies.map((item) => ({ name: item.name, winner: item.baselineWinner })),
      mapFeatures: westminster.mapFeatures,
    },
    {
      id: "assembly", label: "NI Assembly", title: "NI Assembly composition", date: "2022-05-05", totalSeats: 90, mode: "hemicycle", sourceLabel: "2022 Assembly election baseline",
      parties: assembly.parties.filter((item) => item.baselineSeats > 0).map((item) => party(item.code, item.baselineSeats)).sort((a, b) => b.seats - a.seats || a.code.localeCompare(b.code)),
    },
    {
      id: "dail", label: "Dáil Éireann", title: "Dáil Éireann composition", date: "2024-11-29", totalSeats: 174, mode: "hemicycle", sourceLabel: "2024 General Election baseline",
      parties: loadDail2024Seats(),
    },
    {
      id: "seanad", label: "Seanad Éireann", title: "Seanad Éireann composition", date: "2025-02-07", totalSeats: 60, mode: "hemicycle", sourceLabel: "27th Seanad opening composition",
      parties: [party("FF", 19), party("FG", 18), party("SF", 6), party("LAB", 2), party("SD", 1), party("GP", 1), party("AON", 1), party("IND", 12)].sort((a, b) => b.seats - a.seats || a.code.localeCompare(b.code)),
    },
  ];
}
