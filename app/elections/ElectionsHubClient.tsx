"use client";

import { useState, useEffect } from "react";

const PARTY_COLORS: Record<string, string> = {
  FF: "#66bb6a",
  FG: "#5c6bc0",
  SF: "#124940",
  LAB: "#e53935",
  GP: "#43a047",
  SD: "#741d83",
  PBPS: "#da1498",
  AON: "#53660e",
  INDIRL: "#9be736",
  IND: "#7a7a7a",
  IPP: "#0e9775",

  SDLP: "#1a5c1d",
  PBP: "#da1498",
  INDN: "#0c4257",

  DUP: "#dd5454",
  UUP: "#3676c0",
  TUV: "#061730",
  INDU: "#d65f30",

  AP: "#fdd835",
  Yes: "#0a1f94",
  No: "#d4950d"
};

export default function ElectionsHubClient({
  rows
}: {
  rows: any[];
}) {

const [showFilters, setShowFilters] = useState(false);
const [showSubRegions, setShowSubRegions] = useState(false);
const [searchQuery, setSearchQuery] =
  useState("");

  const [expanded, setExpanded] =
    useState<string | null>(null);

  const [selectedYears, setSelectedYears] =
    useState<string[]>(["All Years"]);

  const [selectedAreas, setSelectedAreas] =
    useState<string[]>(["All Areas"]);

  const [
    selectedInstitutions,
    setSelectedInstitutions
  ] = useState<string[]>([
    "All Institutions"
  ]);

  const [selectedTypes, setSelectedTypes] =
    useState<string[]>(["All Types"]);

const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 900);
  check();
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);

useEffect(() => {
  const hasSubRegionSelected =
    selectedAreas.some((area) => {
      if (area === "All Areas") {
        return false;
      }

      return rows.some(
        (row) =>
          row.area === area &&
          !row.isOverall
      );
    });

  if (hasSubRegionSelected) {
    setShowSubRegions(true);
  }
}, [selectedAreas, rows]);

  const yearOptions = [
    "All Years",
    ...Array.from(
      new Set(rows.map((row) => row.date))
    ).sort((a, b) =>
      b.localeCompare(a)
    )
  ];

const groupedAreas = Object.entries(
  rows.reduce(
    (
      acc: Record<string, string[]>,
      row
    ) => {
      if (!row.areaType) {
        return acc;
      }

      if (!acc[row.areaType]) {
        acc[row.areaType] = [];
      }

      if (
        !acc[row.areaType].includes(
          row.area
        )
      ) {
        acc[row.areaType].push(
          row.area
        );
      }

      return acc;
    },
    {}
  )
).map(([label, values]) => ({
  label,
  values: values.sort()
}));

  const institutionOptions = [
    "All Institutions",
    ...Array.from(
      new Set(
        rows.map(
          (row) => row.institution
        )
      )
    )
  ];

  const typeOptions = [
    "All Types",
    ...Array.from(
      new Set(rows.map((row) => row.type))
    )
  ];

const filteredRows = rows.filter((row) => {

  // ✅ NEW: hide sub-regions unless enabled
  if (!showSubRegions && !row.isOverall) {
    return false;
  }

  const yearMatch =
    selectedYears.includes("All Years") ||
    selectedYears.includes(row.date);

  const areaMatch =
    selectedAreas.includes("All Areas") ||
    selectedAreas.includes(row.area);

  const institutionMatch =
    selectedInstitutions.includes("All Institutions") ||
    selectedInstitutions.includes(row.institution);

const typeMatch =
  selectedTypes.includes("All Types") ||
  selectedTypes.includes(row.type);

const search = searchQuery
  .trim()
  .toLowerCase();

const searchMatch =
  search === "" ||
  row.area
    .toLowerCase()
    .includes(search) ||
  row.institution
    .toLowerCase()
    .includes(search) ||
  row.type
    .toLowerCase()
    .includes(search) ||
  row.date
    .toLowerCase()
    .includes(search);

return (
  yearMatch &&
  areaMatch &&
  institutionMatch &&
  typeMatch &&
  searchMatch
);
});

  function toggleRow(id: string) {
    setExpanded(
      expanded === id ? null : id
    );
  }

  return (
<div
  style={{
    display: "flex",
    height: "100%",
    width: "100%"
  }}
>
{/* SIDEBAR / DRAWER */}
{isMobile ? (
  <>
    {/* OVERLAY */}
    {showFilters && (
      <div
        onClick={() => setShowFilters(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 50
        }}
      />
    )}

    {/* DRAWER PANEL */}
    <div
      style={{
        position: "fixed",
        top: "60px",
        left: showFilters ? 0 : "-280px",
        height: "calc(100% - 60px)",
        width: "260px",
        background: "var(--panel)",
        borderRight: "1px solid var(--border)",
        padding: "12px",
        overflowY: "auto",
        zIndex: 60,
        transition: "left 0.25s ease"
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          padding: "0 4px"
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700
          }}
        >
          Filters
        </div>

        <button
          onClick={() => setShowFilters(false)}
          style={{
            fontSize: "14px",
            background: "transparent",
            border: "none",
            cursor: "pointer"
          }}
        >
          ✕
        </button>
      </div>

      {/* RESET BUTTON */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "12px"
        }}
      >
        <button
          onClick={() => {
            setSelectedYears(["All Years"]);
            setSelectedAreas(["All Areas"]);
            setSelectedInstitutions(["All Institutions"]);
            setSelectedTypes(["All Types"]);
          }}
          style={{
            fontSize: "11px",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "transparent",
            cursor: "pointer",
            opacity: 0.7
          }}
        >
          Reset
        </button>
      </div>

      {/* FILTERS */}
      <FilterMultiSelect
        title="Year (When?)"
        values={selectedYears}
        options={yearOptions}
        onChange={setSelectedYears}
      />

        <AreaFilterMultiSelect
          title="Area (Where?)"
          values={selectedAreas}
          groupedAreas={groupedAreas}
          onChange={setSelectedAreas}
        />

      <FilterMultiSelect
        title="Institution (What?)"
        values={selectedInstitutions}
        options={institutionOptions}
        onChange={setSelectedInstitutions}
      />

      <FilterMultiSelect
        title="Type (How?)"
        values={selectedTypes}
        options={typeOptions}
        onChange={setSelectedTypes}
      />
    </div>
  </>
) : (
  /* DESKTOP SIDEBAR (original behaviour) */
  <div
    style={{
      width: "260px",
      flexShrink: 0,
      borderRight: "1px solid var(--border)",
      background: "var(--panel)",
      padding: "12px",
      overflowY: "auto"
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
        padding: "0 4px"
      }}
    >
      <div
        style={{
          fontSize: "16px",
          fontWeight: 700
        }}
      >
        Filters
      </div>

      <button
        onClick={() => {
          setSelectedYears(["All Years"]);
          setSelectedAreas(["All Areas"]);
          setSelectedInstitutions(["All Institutions"]);
          setSelectedTypes(["All Types"]);
        }}
        style={{
          fontSize: "11px",
          fontWeight: 600,
          padding: "4px 8px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: "transparent",
          cursor: "pointer",
          opacity: 0.7
        }}
      >
        Reset
      </button>
    </div>

    <FilterMultiSelect
      title="Year (When?)"
      values={selectedYears}
      options={yearOptions}
      onChange={setSelectedYears}
    />

<AreaFilterMultiSelect
  title="Area (Where?)"
  values={selectedAreas}
  groupedAreas={groupedAreas}
  onChange={setSelectedAreas}
/>

    <FilterMultiSelect
      title="Institution (What?)"
      values={selectedInstitutions}
      options={institutionOptions}
      onChange={setSelectedInstitutions}
    />

    <FilterMultiSelect
      title="Type (How?)"
      values={selectedTypes}
      options={typeOptions}
      onChange={setSelectedTypes}
    />
  </div>
)}

{/* TABLE */}
<div
  style={{
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 0
  }}
>
  <div
    style={{
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      height: "100%"
    }}
  >

  {/* HEADER TEXT (NOT SCROLLING) */}
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px"
  }}
>
  <div
    style={{
      fontSize: "28px",
      fontWeight: 700
    }}
  >
    Election Centre
  </div>

  {isMobile && (
    <button
      onClick={() => setShowFilters(true)}
      style={{
        padding: "6px 10px",
        fontSize: "12px",
        fontWeight: 600,
        borderRadius: "8px",
        border: "1px solid var(--border)",
        background: "var(--panel)",
        cursor: "pointer"
      }}
    >
      Filters
    </button>
  )}
</div>

  <div
    style={{
      fontSize: "14px",
      opacity: 0.7,
      marginBottom: "6px"
    }}
  >
    Browse all. Filter by when, where, what, and how.
  </div>

  <div
    style={{
      fontSize: "12px",
      opacity: 0.55,
      marginBottom: "20px",
      fontWeight: 600
    }}
  >
    Showing {filteredRows.length} vote
    {filteredRows.length === 1 ? "" : "s"}
  </div>

<input
  type="text"
  placeholder="Search by year, election type, constituencies, institutions..."
  value={searchQuery}
  onChange={(e) =>
    setSearchQuery(
      e.target.value
    )
  }
  style={{
    width: "100%",
    padding: "10px 12px",
    marginBottom: "16px",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    background: "var(--panel-2)",
    color: "var(--text)",
    fontSize: "10px",
    outline: "none"
  }}
/>

<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "14px"
  }}
>

  <span
    style={{
      fontSize: "12px",
      opacity: 0.7
    }}
  >
    Show sub-regions (e.g. constituencies, electoral districts, etc.)
  </span>

  <button
    onClick={() => setShowSubRegions(!showSubRegions)}
    style={{
      width: "42px",
      height: "22px",
      borderRadius: "20px",
      border: "1px solid var(--border)",
      background: showSubRegions ? "#00dfef" : "var(--panel-2)",
      position: "relative",
      transition: "all 0.2s ease",
      cursor: "pointer"
    }}
  >
<div
  style={{
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    left: showSubRegions ? "22px" : "2px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "var(--text)",
    transition:
      "left 0.2s ease, background 0.2s ease",
    boxShadow:
      "0 1px 3px rgba(0,0,0,0.25)"
  }}
/>
  </button>

</div>


  {/* TABLE BOX (fills remaining height) */}
  <div
    style={{
      border: "1px solid var(--border)",
      borderRadius: "12px",
      background: "var(--panel)",
      flex: 1,                 // 👈 fills remaining space
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minHeight: 0             // 👈 CRITICAL for scroll to work
    }}
  >
    {/* SCROLL AREA */}
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        minHeight: 0
      }}
    >
{/* HEADER */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: isMobile
      ? "5px 1fr 50px"
      : "5px 140px minmax(180px, 1.4fr) minmax(160px, 1.2fr) minmax(140px, 1fr) 70px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    opacity: 0.9,
    borderBottom: "1px solid var(--border)",
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "var(--panel)"
  }}
>
  {isMobile ? (
    <>
      <div style={{ padding: "12px 14px" }} />

      <div style={{ padding: "12px 14px" }}>
        Elections
      </div>

      <div style={{ padding: "12px 14px" }}>
        
      </div>
    </>
  ) : (
    <>
      <div style={{ padding: "12px 14px" }} />

      <div style={{ padding: "12px 14px" }}>
        Date (When?)
      </div>

      <div style={{ padding: "12px 14px" }}>
        Area (Where?)
      </div>

      <div style={{ padding: "12px 14px" }}>
        Institution (What?)
      </div>

      <div style={{ padding: "12px 14px" }}>
        Type (How?)
      </div>

      <div style={{ padding: "12px 14px" }}>
        Expand
      </div>
    </>
  )}
</div>

      {filteredRows.length === 0 ? (
        <div style={{ padding: "18px" }}>
          This ballot box is empty. Try adjusting your filter selections.
        </div>
      ) : (
        filteredRows.map((row) => {
          const isOpen = expanded === row.href;

          const leaders = row.preview?.leaders || [];
          const seats = row.preview?.seatLeaders || [];

          const showSeats =
            row.type === "General Election" ||
            row.type === "Assembly Election";

          return (
            <div
              key={row.href}
              style={{
                borderBottom: "1px solid var(--border)"
              }}
            >
{/* MAIN ROW */}
<div
  onClick={() => toggleRow(row.href)}
  onMouseEnter={(e) => {
    e.currentTarget.style.background =
      "rgba(255,255,255,0.05)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background =
      "transparent";
  }}
  style={{
    display: "grid",
    gridTemplateColumns: isMobile
      ? "5px 1fr 50px"
      : "5px 140px minmax(180px, 1.4fr) minmax(160px, 1.2fr) minmax(140px, 1fr) 70px",
    cursor: "pointer",
    fontSize: "13px",
    alignItems: "stretch",
    transition: "background 0.18s ease"
  }}
>
  <div
    style={{
      background:
PARTY_COLORS[
  row.preview?.dominantParty
]
        || "#444"
    }}
  />

  {isMobile ? (
    <>
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "4px"
        }}
      >
        <a
          href={row.href}
          onClick={(e) =>
            e.stopPropagation()
          }
          style={{
            fontWeight: 700,
            color: "inherit",
            textDecoration: "none"
          }}
        >
          {row.area}
        </a>

        <div
          style={{
            fontSize: "12px",
            opacity: 0.7
          }}
        >
          {row.institution}
        </div>

        <div
          style={{
            fontSize: "11px",
            opacity: 0.55
          }}
        >
          {row.date} • {row.type}
        </div>
      </div>

      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {isOpen ? "−" : "+"}
      </div>
    </>
  ) : (
    <>
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center"
        }}
      >
        {row.date}
      </div>

      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center"
        }}
      >
        <a
          href={row.href}
          onClick={(e) =>
            e.stopPropagation()
          }
          style={{
            position: "relative",
            fontWeight: 600,
            color: "inherit",
            textDecoration: "none"
          }}
          onMouseEnter={(e) => {
            const t =
              e.currentTarget;

            const line =
              t.querySelector(
                "span"
              ) as HTMLElement;

            if (line)
              line.style.width =
                "100%";

            t.style.color =
              "#00dfef";
          }}
          onMouseLeave={(e) => {
            const t =
              e.currentTarget;

            const line =
              t.querySelector(
                "span"
              ) as HTMLElement;

            if (line)
              line.style.width =
                "0";

            t.style.color =
              "inherit";
          }}
        >
          {row.area}

          <span
            style={{
              position: "absolute",
              left: 0,
              bottom: "-2px",
              height: "2px",
              width: "0",
              background: "#00dfef",
              transition:
                "width 0.25s ease"
            }}
          />
        </a>
      </div>

      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center"
        }}
      >
        {row.institution}
      </div>

      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center"
        }}
      >
        {row.type}
      </div>

      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center"
        }}
      >
        {isOpen ? "−" : "+"}
      </div>
    </>
  )}
</div>

              {/* EXPANDED (UNCHANGED) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isOpen ? "1fr" : "0fr",
                  opacity: isOpen ? 1 : 0,
                  transition:
                    "grid-template-rows 0.34s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease",
                  borderTop: isOpen
                    ? "1px solid var(--border)"
                    : "0px solid transparent",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.03), var(--panel-2))"
                }}
              >
                <div style={{ overflow: "hidden" }}>
                  <div
                    style={{
                      padding: isOpen ? "16px" : "0 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "22px"
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          opacity: 0.45,
                          marginBottom: "8px"
                        }}
                      >
                        VOTE SHARE
                      </div>

                      {leaders.map((item: any) => {
                        const color =
                          PARTY_COLORS[item.name] || "#666";

                        return (
                          <div
                            key={item.name}
                            style={{
                              display: "flex",
                              gap: "10px",
                              fontSize: "12px"
                            }}
                          >
                            <div
                              style={{
                                width: "3px",
                                height: "18px",
                                background: color
                              }}
                            />
                            <div style={{ fontWeight: 700 }}>
                              {item.name}
                            </div>
                            <div>{item.percent}%</div>
                          </div>
                        );
                      })}
                    </div>

                    <a
                      href={row.href}
                      style={{
                        padding: "10px 14px",
                        fontSize: "12px",
                        fontWeight: 700,
                        textDecoration: "none"
                      }}
                    >
                      Go to full result →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
</div>
    </div>
    </div>
  );
}

/* FILTER */

function FilterMultiSelect({
  title,
  values,
  options,
  onChange
}: {
  title: string;
  values: string[];
  options: string[];
  onChange: (
    values: string[]
  ) => void;
}) {
  const [open, setOpen] =
    useState(false);

  function toggle(option: string) {
    const allOption =
      options.find((item) =>
        item.startsWith("All ")
      );

    if (!allOption) return;

    if (option === allOption) {
      onChange([allOption]);
      return;
    }

    let next =
      values.filter(
        (v) => v !== allOption
      );

    if (
      next.includes(option)
    ) {
      next = next.filter(
        (v) => v !== option
      );
    } else {
      next.push(option);
    }

    if (
      next.length === 0
    ) {
      next = [allOption];
    }

    onChange(next);
  }
  
return (
  <div style={{ marginBottom: "10px" }}>

    {/* TITLE (NOT clickable) */}
    <div
      style={{
        fontSize: "11px",
        fontWeight: 700,
        opacity: 0.6,
        margin: "0 0 6px 4px",
        letterSpacing: "0.4px",
        color: "var(--text)"
      }}
    >
      {title}
    </div>

    {/* BOX */}
    <div
      style={{
        borderRadius: "10px",
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        overflow: "hidden"
      }}
    >

      {/* CLICKABLE HEADER */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "10px 12px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between"
        }}
      >
        <div
          style={{
            fontSize: "11px",
            opacity: 0.6
          }}
        >
          {open ? "−" : "+"}
        </div>

        <div
          style={{
            fontSize: "11px",
            opacity: 0.6,
            maxWidth: "120px",
            textAlign: "right",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {values.includes(options[0])
            ? options[0]
            : values.length === 1
            ? values[0]
            : `${values.length} selected`}
        </div>
      </div>

      {/* OPTIONS */}
      {open && (
        <div style={{ padding: "0 8px 8px" }}>
          {options.map((option) => {
            const active = values.includes(option);

            return (
              <div
                key={option}
                onClick={() => toggle(option)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    background: active
                      ? "var(--text)"
                      : "transparent"
                  }}
                />

                <div
                  style={{
                    fontWeight: active ? 600 : 500
                  }}
                >
                  {option}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);
}

function AreaFilterMultiSelect({
  title,
  values,
  groupedAreas,
  onChange
}: {
  title: string;
  values: string[];
  groupedAreas: {
    label: string;
    values: string[];
  }[];
  onChange: (
    values: string[]
  ) => void;
}) {
  const [open, setOpen] =
    useState(false);

  function toggle(option: string) {
    if (option === "All Areas") {
      onChange(["All Areas"]);
      return;
    }

    let next =
      values.filter(
        (v) => v !== "All Areas"
      );

    if (
      next.includes(option)
    ) {
      next = next.filter(
        (v) => v !== option
      );
    } else {
      next.push(option);
    }

    if (next.length === 0) {
      next = ["All Areas"];
    }

    onChange(next);
  }

  function renderOption(
    option: string
  ) {
    const active =
      values.includes(option);

    return (
      <div
        key={option}
        onClick={() => toggle(option)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 8px",
          cursor: "pointer",
          fontSize: "13px"
        }}
      >
        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "4px",
            border:
              "1px solid var(--border)",
            background: active
              ? "var(--text)"
              : "transparent"
          }}
        />

        <div
          style={{
            fontWeight: active
              ? 600
              : 500
          }}
        >
          {option}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "10px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          opacity: 0.6,
          margin: "0 0 6px 4px",
          letterSpacing: "0.4px",
          color: "var(--text)"
        }}
      >
        {title}
      </div>

      <div
        style={{
          borderRadius: "10px",
          background: "var(--panel-2)",
          border:
            "1px solid var(--border)",
          overflow: "hidden"
        }}
      >
        <div
          onClick={() => setOpen(!open)}
          style={{
            padding: "10px 12px",
            cursor: "pointer",
            display: "flex",
            justifyContent:
              "space-between"
          }}
        >
          <div
            style={{
              fontSize: "11px",
              opacity: 0.6
            }}
          >
            {open ? "−" : "+"}
          </div>

          <div
            style={{
              fontSize: "11px",
              opacity: 0.6,
              maxWidth: "120px",
              textAlign: "right",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {values.includes(
              "All Areas"
            )
              ? "All Areas"
              : values.length === 1
              ? values[0]
              : `${values.length} selected`}
          </div>
        </div>

        {open && (
          <div
            style={{
              padding: "0 8px 8px"
            }}
          >
            {renderOption(
              "All Areas"
            )}

            {groupedAreas.map(
              (group) => (
                <div
                  key={group.label}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      opacity: 0.45,
                      padding:
                        "10px 8px 4px",
                      letterSpacing:
                        "0.4px"
                    }}
                  >
                    {group.label.toUpperCase()}
                  </div>

                  {group.values.map(
                    renderOption
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}