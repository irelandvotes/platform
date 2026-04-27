"use client";

import { useState } from "react";

export default function ElectionsHubClient({
  rows
}: {
  rows: any[];
}) {
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

  const areaOptions = [
    "All Areas",
    ...Array.from(
      new Set(rows.map((row) => row.area))
    )
  ];

  const institutionOptions = [
    "All Institutions",
    ...Array.from(
      new Set(
        rows.map((row) => row.institution)
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
    const yearMatch =
      selectedYears.includes("All Years") ||
      selectedYears.includes(row.date);

    const areaMatch =
      selectedAreas.includes("All Areas") ||
      selectedAreas.includes(row.area);

    const institutionMatch =
      selectedInstitutions.includes(
        "All Institutions"
      ) ||
      selectedInstitutions.includes(
        row.institution
      );

    const typeMatch =
      selectedTypes.includes("All Types") ||
      selectedTypes.includes(row.type);

    return (
      yearMatch &&
      areaMatch &&
      institutionMatch &&
      typeMatch
    );
  });

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%"
      }}
    >
      {/* FILTER SIDEBAR */}
      <div
        style={{
          width: "260px",
          flexShrink: 0,
          borderRight:
            "1px solid var(--border)",
          background: "var(--panel)",
          padding: "12px",
          overflowY: "auto"
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: "700",
            marginBottom: "12px",
            opacity: 0.9,
            marginLeft: "5px"
          }}
        >
          Filters
        </div>

        <FilterMultiSelect
          title="Year"
          values={selectedYears}
          options={[
            "All Years",
            "2025",
            "2024",
            "2020",
            "2018"
          ]}
          onChange={setSelectedYears}
        />

        <FilterMultiSelect
          title="Area"
          values={selectedAreas}
          options={areaOptions}
          onChange={setSelectedAreas}
        />

        <FilterMultiSelect
          title="Institution"
          values={selectedInstitutions}
          options={institutionOptions}
          onChange={
            setSelectedInstitutions
          }
        />

        <FilterMultiSelect
          title="Type"
          values={selectedTypes}
          options={typeOptions}
          onChange={setSelectedTypes}
        />
      </div>

      {/* TABLE AREA */}
      <div
        style={{
          flex: 1,
          padding: "20px",
          overflow: "auto"
        }}
      >
        <div
          style={{
            fontSize: "28px",
            fontWeight: "700",
            marginBottom: "8px"
          }}
        >
          Election Centre
        </div>

        <div
          style={{
            fontSize: "14px",
            opacity: 0.7,
            marginBottom: "6px"
          }}
        >
          Browse all votes.
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
          {filteredRows.length === 1
            ? ""
            : "s"}
        </div>

        <div
          style={{
            border:
              "1px solid var(--border)",
            borderRadius: "12px",
            overflow: "hidden",
            background: "var(--panel)"
          }}
        >
          {/* HEADER */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "140px 1.3fr 1.2fr 1fr 70px",
              padding: "12px 14px",
              fontSize: "11px",
              fontWeight: "700",
              letterSpacing: "0.5px",
              opacity: 0.65,
              borderBottom:
                "1px solid var(--border)"
            }}
          >
            <div>Date</div>
            <div>Area</div>
            <div>Institution</div>
            <div>Type</div>
            <div>Share</div>
          </div>

          {/* ROWS */}
          {filteredRows.length === 0 ? (
            <div
              style={{
                padding: "18px",
                fontSize: "14px",
                opacity: 0.65
              }}
            >
              No votes match current
              filters.
            </div>
          ) : (
            filteredRows.map((row) => (
              <a
                key={row.href}
                href={row.href}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "140px 1.3fr 1.2fr 1fr 70px",
                  padding: "14px",
                  borderBottom:
                    "1px solid var(--border)",
                  textDecoration: "none",
                  color: "inherit",
                  fontSize: "13px",
                  transition: "0.15s",
                  cursor: "pointer"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "var(--panel-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "transparent";
                }}
              >
                <div>{row.date}</div>
                <div>{row.area}</div>
                <div>
                  {row.institution}
                </div>
                <div>{row.type}</div>
                <div>🔗</div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

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
    useState(true);

  function toggle(option: string) {
    const allOption = options.find(
      (item) =>
        item.startsWith("All ")
    );

    if (!allOption) return;

    if (option === allOption) {
      onChange([allOption]);
      return;
    }

    let next = values.filter(
      (v) => v !== allOption
    );

    if (next.includes(option)) {
      next = next.filter(
        (v) => v !== option
      );
    } else {
      next.push(option);
    }

    if (next.length === 0) {
      next = [allOption];
    }

    onChange(next);
  }

  return (
    <div
      style={{
        marginBottom: "8px",
        borderRadius: "10px",
        background:
          "var(--panel-2)",
        border:
          "1px solid var(--border)",
        overflow: "hidden"
      }}
    >
      {/* HEADER */}
      <div
        onClick={() =>
          setOpen(!open)
        }
        style={{
          padding: "10px 12px",
          cursor: "pointer",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center"
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: "700",
            opacity: 0.65
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: "11px",
            opacity: 0.6
          }}
        >
          {open ? "−" : "+"}
        </div>
      </div>

      {/* OPTIONS */}
      {open && (
        <div
          style={{
            padding: "0 8px 8px"
          }}
        >
          {options.map((option) => {
            const active =
              values.includes(option);

            return (
              <div
                key={option}
                onClick={() =>
                  toggle(option)
                }
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: "8px",
                  padding:
                    "6px 8px",
                  borderRadius:
                    "8px",
                  cursor:
                    "pointer",
                  fontSize: "13px"
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius:
                      "4px",
                    border:
                      "1px solid var(--border)",
                    background:
                      active
                        ? "var(--text)"
                        : "transparent",
                    flexShrink: 0
                  }}
                />

                <div
                  style={{
                    fontWeight:
                      active
                        ? 600
                        : 500
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
  );
}