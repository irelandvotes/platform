// lib/buildElectionRows.ts

import fs from "fs";
import path from "path";

export type ElectionRow = {
  date: string;
  area: string;
  institution: string;
  type: string;
  href: string;
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
    return ["National"];
  }

  const raw = fs.readFileSync(
    filePath,
    "utf8"
  );

  const lines = raw
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) {
    return ["National"];
  }

  const headers =
    lines[0].split(",");

  const constituencyIndex =
    headers.findIndex(
      (header) =>
        header
          .trim()
          .toLowerCase() ===
        "constituency"
    );

  if (constituencyIndex === -1) {
    return ["National"];
  }

  const areas = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols =
      lines[i].split(",");

    const area =
      cols[
        constituencyIndex
      ]?.trim();

    if (area) {
      areas.add(area);
    }
  }

  const list = Array.from(
    areas
  ).sort((a, b) =>
    a.localeCompare(b)
  );

  return list.length
    ? list
    : ["National"];
}

/* ===================================
   DISPLAY LOGIC
=================================== */

function getDate(slug: string) {
  if (/^\d{4}$/.test(slug)) {
    return slug;
  }

  const knownDates: Record<string, string> = {
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
  if (country === "ireland" && category === "dail") {
    return "Dáil Éireann";
  }

  if (country === "ireland" && category === "president") {
    return "President of Ireland";
  }

  if (country === "ireland" && category === "referendums") {
    return `${slug} Amendment`;
  }

  if (country === "northern-ireland" && category === "assembly") {
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

  if (category === "president") {
    return "Presidential Election";
  }

  if (category === "referendums") {
    return "Referendum";
  }

  if (category === "assembly") {
    return "Assembly Election";
  }

  return category;
}

/* ===================================
   AUTO DISCOVER ELECTIONS
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

  const rows: ElectionFolder[] = [];

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

  const rows: ElectionRow[] = [];

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

const institution = getInstitution(
  country,
  category,
  slug
);

const type = getType(
  category
);

      // National row
      rows.push({
        date,
        area: "National",
        institution,
        type,
        href: hrefBase
      });

      // Constituency rows
      areas
        .filter(
          (area) =>
            area !==
            "National"
        )
        .forEach(
          (area) => {
            rows.push({
              date,
              area,
              institution,
              type,
              href:
                `${hrefBase}?c=${slugify(
                  area
                )}`
            });
          }
        );
    }
  );

  return rows.sort((a, b) =>
    b.date.localeCompare(
      a.date
    )
  );
}