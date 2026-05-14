// lib/buildElectionRows.ts

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

function parseCSVLine(line: string) {
  const records = parse(line, {
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true
  });

  return records[0] || [];
}

export type ElectionRow = {
  date: string;
  area: string;
  areaType: string | null;
  institution: string;
  type: string;
  href: string;
  isOverall: boolean;
  preview?: {
leaders: {
  name: string;
  party: string;
  percent: string;
  votes: number;
  isIndependent: boolean;
}[];
    seatLeaders: {
      name: string;
      value: number;
    }[];
  } | null;
};

type ElectionFolder = {
  country: string;
  category: string;
  slug: string;
};

/* ===================================
   HELPERS
=================================== */

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeReadDirs(folder: string) {
  if (!fs.existsSync(folder)) return [];

  return fs
    .readdirSync(folder, {
      withFileTypes: true
    })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);
}

function parseUniqueAreas(
  filePath: string
): string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(
    filePath,
    "utf8"
  );

  const lines = raw
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers =
    parseCSVLine(lines[0]);

  const constituencyIndex =
    headers.findIndex(
      (header) =>
        header
          .trim()
          .toLowerCase() ===
        "constituency"
    );

  if (constituencyIndex === -1) {
    return [];
  }

  const areas = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols =
      parseCSVLine(lines[i]);

    const area =
      cols[
        constituencyIndex
      ]?.trim();

    if (area) {
      areas.add(area);
    }
  }

  return Array.from(
    areas
  ).sort((a, b) =>
    a.localeCompare(b)
  );
}

function parseOverallByElectionArea(
  filePath: string
): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(
    filePath,
    "utf8"
  );

  const lines = raw
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const headers =
    parseCSVLine(lines[0]);

  const constituencyIndex =
    headers.findIndex(
      (header) =>
        header
          .trim()
          .toLowerCase() ===
        "constituency"
    );

  if (constituencyIndex === -1) {
    return null;
  }

  const firstRow =
    parseCSVLine(lines[1]);

  const area =
    firstRow[
      constituencyIndex
    ];

  if (!area) {
    return null;
  }

  return area.trim();
}

/* ===================================
   PREVIEW DATA
=================================== */

function buildPreview(
  filePath: string,
  area: string,
  type: string,
  options?: {
    excludeConstituencies?: string[];
  }
) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(
    filePath,
    "utf8"
  );

  const lines = raw
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const headers =
    parseCSVLine(lines[0]);

  const index = (
    name: string
  ) =>
    headers.findIndex(
      (h) =>
        h
          .trim()
          .toLowerCase() === name
    );

  const constituencyIndex =
    index("constituency");
  const countIndex =
    index("count");
  const partyIndex =
    index("party");
  const candidateIndex =
    index("candidate");
  const votesIndex =
    index("votes");
  const statusIndex =
    index("status");

  const data = lines
    .slice(1)
    .map((line) =>
      parseCSVLine(line)
    );

const excluded =
  options?.excludeConstituencies || [];

const filteredData =
  data.filter((row) => {

    const constituency =
      row[
        constituencyIndex
      ]?.trim();

    if (
      excluded.includes(
        constituency
      )
    ) {
      return false;
    }

    return true;
  });

const relevant =
  area === "National"
    ? filteredData
    : filteredData.filter(
        (row) =>
          row[
            constituencyIndex
          ]?.trim() === area
      );

  if (!relevant.length) {
    return null;
  }

  /* -------------------
     Vote Share
  ------------------- */

  const firstCount =
    countIndex === -1
      ? relevant
      : relevant.filter(
          (row) =>
            row[countIndex] === "1"
        );

const totals: Record<
  string,
  {
    votes: number;
    party: string;
    candidate: string;
    isIndependent: boolean;
  }
> = {};

firstCount.forEach((row) => {
  const party =
    row[
      partyIndex
    ]?.trim() || "Other";

  const candidate =
    row[
      candidateIndex
    ]?.trim() || "Unknown";
    
const votes = Number(
  String(row[votesIndex] || "0")
    .replace(/,/g, "")
);

  const isIndependent =
    party === "IND" ||
    party === "INDN" ||
    party === "INDU";

// independents remain grouped
const key = party;

  if (!totals[key]) {
    totals[key] = {
      votes: 0,
      party,
      candidate,
      isIndependent
    };
  }

  totals[key].votes += votes;
});

const totalVotes =
  Object.values(totals).reduce(
    (a, b) => a + b.votes,
    0
  );

const leaders = Object.values(
  totals
)
  .map((item) => ({
name: item.party,
    party: item.party,
    votes: item.votes,
    isIndependent:
      item.isIndependent,
    percent:
      totalVotes > 0
        ? (
            (item.votes /
              totalVotes) *
            100
          ).toFixed(1)
        : "0.0"
  }))
  .sort((a, b) => {
    // independents always last
    if (
      a.isIndependent &&
      !b.isIndependent
    ) {
      return 1;
    }

    if (
      !a.isIndependent &&
      b.isIndependent
    ) {
      return -1;
    }

    return b.votes - a.votes;
  });

const largestNonIndependent =
  leaders.find(
    (leader) =>
      !leader.isIndependent
  );

const largestIndependent =
  leaders.find(
    (leader) =>
      leader.isIndependent
  );

let dominantParty =
  largestNonIndependent
    ?.party || "IND";

// if the grouped independent bloc
// genuinely exceeds the top party,
// use IND colouring
if (
  (largestIndependent?.votes ||
    0) >
  (largestNonIndependent
    ?.votes || 0)
) {
  dominantParty = "IND";
}

// by-elections and presidential elections
// should use actual winner colouring
const isSingleWinnerElection =
  type === "By-Election" ||
  type ===
    "Presidential Election";

if (
  isSingleWinnerElection &&
  area === "National" &&
  statusIndex !== -1
) {
  const winnerRow =
    relevant.find(
      (row) =>
        row[statusIndex] ===
        "elected"
    );

  if (winnerRow) {
    dominantParty =
      winnerRow[
        partyIndex
      ] || dominantParty;
  }
}

  /* -------------------
     Seats by Party
  ------------------- */

  const seatMap: Record<
    string,
    number
  > = {};

  const electedSeen =
    new Set<string>();

  relevant.forEach((row) => {
    if (
      statusIndex === -1 ||
      row[
        statusIndex
      ] !== "elected"
    ) {
      return;
    }

    const candidate =
      row[
        candidateIndex
      ] || "";

    const party =
      row[
        partyIndex
      ] || "Other";

    const key =
      candidate +
      "|" +
      party;

    if (
      electedSeen.has(key)
    ) {
      return;
    }

    electedSeen.add(key);

    seatMap[party] =
      (seatMap[party] || 0) +
      1;
  });

  const seatLeaders =
    Object.entries(
      seatMap
    )
      .map(
        ([name, value]) => ({
          name,
          value
        })
      )
      .sort(
        (a, b) =>
          b.value -
          a.value
      );

  return {
    leaders,
    seatLeaders,
    dominantParty
  };
}

/* ===================================
   DISPLAY LOGIC
=================================== */

function getDate(slug: string) {
  const year = slug.split("/")[0];

  if (/^\d{4}$/.test(year)) {
    return year;
  }

  const knownDates: Record<
    string,
    string
  > = {
    "32nd": "2013",
    "33rd": "2013",
    "34th": "2015",
    "35th": "2015",
    "36th": "2018",
    "37th": "2018",
    "38th": "2019",
    "39th": "2024",
    "40th": "2024"
  };

  return knownDates[slug] || "";
}

function getInstitution(
  country: string,
  category: string,
  slug: string
) {
  if (
    country === "ireland" &&
    category === "dail"
  ) {
    return "Dáil Éireann";
  }

    if (
    country === "ireland" &&
    category === "by-election"
  ) {
    return "Dáil Éireann";
  }

      if (
    country === "ireland" &&
    category === "mayor"
  ) {
    return "Mayor";
  }

  if (
    country === "ireland" &&
    category ===
      "president"
  ) {
    return "President of Ireland";
  }

  if (
    country === "ireland" &&
    category ===
      "referendums"
  ) {
    return "Constitutional Amendment";
  }

    if (
    country === "ireland" &&
    category ===
      "european"
  ) {
    return "European Parliament";
  }

  if (
    country ===
      "northern-ireland" &&
    category ===
      "assembly"
  ) {
    return "NI Assembly";
  }

    if (
    country ===
      "northern-ireland" &&
    category ===
      "house-of-commons"
  ) {
    return "House of Commons";
  }

  return category;
}

function getType(category: string, slug: string) {

  /*
    Nested slugs
    are by-elections
  */

  const isByElection =
    (
      category === "dail" ||
      category === "house-of-commons"
    ) &&
    slug.includes("/");

  if (isByElection) {
    return "By-Election";
  }

  if (category === "dail") {
    return "General Election";
  }

  if (category === "mayor") {
    return "Mayoral Election";
  }

  if (category === "house-of-commons") {
    return "General Election";
  }

  if (category === "president") {
    return "Presidential Election";
  }

  if (category === "referendums") {
    return "Referendum";
  }

  if (category === "assembly") {
    return "Devolved Election";
  }

  if (category === "european") {
    return "European Election";
  }

  return category;

}

function getAreaType(
  category: string,
  isOverall: boolean,
  slug: string
) {
  if (isOverall) {
    return null;
  }

  const isByElection =
    slug.includes("/");

  if (isByElection) {
    return "Electoral Districts";
  }

  if (
    category === "dail" ||
    category === "house-of-commons" ||
    category === "assembly" ||
    category === "president" ||
    category === "referendums"
  ) {
    return "Constituencies";
  }

  return "Areas";
}

/* ===================================
   DISCOVER
=================================== */

function discoverElections(): ElectionFolder[] {
  const root = path.join(
    process.cwd(),
    "public",
    "data",
    "elections"
  );

  const countries =
    safeReadDirs(root);

  const rows: ElectionFolder[] =
    [];

  countries.forEach(
    (country) => {
      const countryPath =
        path.join(
          root,
          country
        );

      const categories =
        safeReadDirs(
          countryPath
        );

      categories.forEach(
        (category) => {
          const categoryPath =
            path.join(
              countryPath,
              category
            );

          const slugs =
            safeReadDirs(
              categoryPath
            );

slugs.forEach((slug) => {
  const slugPath = path.join(categoryPath, slug);

  const nested = safeReadDirs(slugPath);

  if (nested.length === 0) {
    // normal election (e.g. 2024)
    rows.push({
      country,
      category,
      slug
    });
  } else {
    // nested elections (e.g. by-elections inside a year)
    nested.forEach((subSlug) => {
      rows.push({
        country,
        category,
        slug: `${slug}/${subSlug}` // 👈 KEY CHANGE
      });
    });
  }
});
        }
      );
    }
  );

  return rows;
}

/* ===================================
   MAIN BUILDER
=================================== */

export function buildElectionRows(): ElectionRow[] {
  const elections =
    discoverElections();

  const rows: ElectionRow[] =
    [];

  elections.forEach(
    ({
      country,
      category,
      slug
    }) => {
      const folderPath =
        path.join(
          process.cwd(),
          "public",
          "data",
          "elections",
          country,
          category,
          slug
        );

const filePath =
  path.join(
    folderPath,
    "election_data.csv"
  );

const countFilePath =
  path.join(
    folderPath,
    "count_data.csv"
  );

      const areas =
        parseUniqueAreas(
          filePath
        );

      const hrefBase =
        `/elections/${country}/${category}/${slug}`;

      const date =
        getDate(slug);

      const institution =
        getInstitution(
          country,
          category,
          slug
        );

const type = getType(category, slug);

const isEuropean =
  category === "european";

const electionYear =
  Number(slug.split("/")[0]);

const excludeNI =
  isEuropean &&
  electionYear <= 2020;

const isByElection =
  slug.includes("/");

const previewFilePath =
  isByElection
    ? countFilePath
    : filePath;

const displayArea =
  isByElection
    ? parseOverallByElectionArea(
        countFilePath
      ) || "Unknown"
    : "National";

rows.push({
  date,
  area: displayArea,
  areaType: getAreaType(
    category,
    true,
    slug
  ),
  institution,
  type,
  href: hrefBase,
  isOverall: true,
preview:
buildPreview(
  previewFilePath,
  "National",
  type,
  excludeNI
    ? {
        excludeConstituencies: [
          "Northern Ireland"
        ]
      }
    : undefined
)
});
areas.forEach((area) => {
  rows.push({
          date,
          area,
          areaType: getAreaType(
            category,
            false,
            slug
          ),
          institution,
          type,
          isOverall: false,
          href:
            `${hrefBase}?c=${slugify(
              area
            )}`,
          preview:
buildPreview(
  filePath,
  area,
  type
)
        });
      });
    }
  );

  return rows.sort((a, b) =>
    b.date.localeCompare(
      a.date
    )
  );
}