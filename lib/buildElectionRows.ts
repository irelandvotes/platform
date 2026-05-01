// lib/buildElectionRows.ts

import fs from "fs";
import path from "path";

function parseCSVLine(line: string) {
  const matches =
    line.match(
      /(".*?"|[^",]+)(?=\s*,|\s*$)/g
    ) || [];

  return matches.map((value) =>
    value
      .replace(/^"|"$/g, "")
      .replace(/,/g, "")
      .trim()
  );
}

export type ElectionRow = {
  date: string;
  area: string;
  institution: string;
  type: string;
  href: string;
  preview?: {
    leaders: {
      name: string;
      percent: string;
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

/* ===================================
   PREVIEW DATA
=================================== */

function buildPreview(
  filePath: string,
  area: string
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

  const relevant =
    area === "National"
      ? data
      : data.filter(
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
    number
  > = {};

  firstCount.forEach((row) => {
    const party =
      row[
        partyIndex
      ]?.trim();

    const candidate =
      row[
        candidateIndex
      ]?.trim();

    const fallback =
      row.find(
        (cell) =>
          cell?.trim() &&
          cell.trim() !== "1"
      ) || "Other";

    const key =
      party ||
      candidate ||
      fallback;

    const votes = Number(
      row[votesIndex] || 0
    );

    totals[key] =
      (totals[key] || 0) +
      votes;
  });

  const totalVotes =
    Object.values(totals).reduce(
      (a, b) => a + b,
      0
    );

  const leaders = Object.entries(
    totals
  )
    .map(
      ([name, votes]) => ({
        name,
        percent:
          totalVotes > 0
            ? (
                (votes /
                  totalVotes) *
                100
              ).toFixed(1)
            : "0.0"
      })
    )
    .sort(
      (a, b) =>
        Number(b.percent) -
        Number(a.percent)
    );

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
    seatLeaders
  };
}

/* ===================================
   DISPLAY LOGIC
=================================== */

function getDate(slug: string) {
  if (/^\d{4}$/.test(slug)) {
    return slug;
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
    return `${slug} Amendment`;
  }

  if (
    country ===
      "northern-ireland" &&
    category ===
      "assembly"
  ) {
    return "NI Assembly";
  }

  return category;
}

function getType(
  category: string
) {
  if (category === "dail") {
    return "General Election";
  }

  if (
    category ===
    "president"
  ) {
    return "Presidential Election";
  }

  if (
    category ===
    "referendums"
  ) {
    return "Referendum";
  }

  if (
    category ===
    "assembly"
  ) {
    return "Assembly Election";
  }

  return category;
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

          slugs.forEach(
            (slug) => {
              rows.push({
                country,
                category,
                slug
              });
            }
          );
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

      const type =
        getType(category);

      rows.push({
        date,
        area: "National",
        institution,
        type,
        href: hrefBase,
        preview:
          buildPreview(
            filePath,
            "National"
          )
      });

      areas.forEach((area) => {
        rows.push({
          date,
          area,
          institution,
          type,
          href:
            `${hrefBase}?c=${slugify(
              area
            )}`,
          preview:
            buildPreview(
              filePath,
              area
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