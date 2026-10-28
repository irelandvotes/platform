import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { buildPollingAverage } from "@/lib/pollingAggregate";

export type ProjectionSupportPresets = {
  mostRecentPoll: { date: string; support: Record<string, number> };
  pollingAggregate: { date: string; support: Record<string, number> };
};

export function loadNiProjectionSupportPresets(partyCodes: string[]): ProjectionSupportPresets {
  const filePath = path.join(process.cwd(), "public", "data", "polling", "northern-ireland", "assembly", "polls.csv");
  const rows = parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    bom: true,
  }) as Array<Record<string, string>>;
  const dated = rows.map((row) => ({ row, date: new Date(row.date ?? "") }))
    .filter((item) => Number.isFinite(item.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const latest = dated.at(-1);
  const latestSupport = Object.fromEntries(partyCodes.map((code) => {
    const raw = latest?.row[code];
    const value = raw === undefined || raw.trim() === "" ? 0 : Number(raw.replace(/,/g, ""));
    return [code, Number.isFinite(value) ? Math.max(0, value) : 0];
  }));
  const polls = dated.map(({ row, date }) => ({
    ...row,
    date,
    ...Object.fromEntries(Object.entries(row).filter(([key]) => key.toLowerCase() !== "date").map(([key, raw]) => {
      const value = raw.trim() === "" ? null : Number(raw.replace(/,/g, ""));
      return [key, value !== null && Number.isFinite(value) ? value : null];
    })),
  }));
  const aggregateRows = buildPollingAverage(polls, "ni") as Array<Record<string, number | Date | null>>;
  const aggregate = aggregateRows.at(-1);
  const aggregateSupport = Object.fromEntries(partyCodes.map((code) => {
    const value = aggregate?.[code];
    return [code, typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : latestSupport[code] ?? 0];
  }));
  const toDate = (date: Date | undefined) => date ? date.toISOString().slice(0, 10) : "";
  return {
    mostRecentPoll: { date: toDate(latest?.date), support: latestSupport },
    pollingAggregate: { date: toDate(aggregate?.date instanceof Date ? aggregate.date : undefined), support: aggregateSupport },
  };
}
