"use client";

import { useState } from "react";

const PARTY_COLORS: Record<string, string> = {
  FF: "#66bb6a",
  FG: "#5c6bc0",
  SF: "#124940",
  LAB: "#e53935",
  GP: "#43a047",
  SD: "#741d83",
  PBPS: "#da1498",
  AON: "#53660e",
  IFP: "#0b5a1c",
  INDIRL: "#9be736",
  IND: "#7a7a7a",
  IPP: "#0e9775",
  Yes: "#0a1f94",
  No: "#d4950d"
};

export default function ElectionsHubClient({
  rows
}: {
  rows: any[];
}) {
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

  const yearOptions = [
    "All Years",
    ...Array.from(
      new Set(rows.map((row) => row.date))
    ).sort((a, b) =>
      b.localeCompare(a)
    )
  ];

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

  const filteredRows = rows.filter(
    (row) => {
      const yearMatch =
        selectedYears.includes(
          "All Years"
        ) ||
        selectedYears.includes(
          row.date
        );

      const areaMatch =
        selectedAreas.includes(
          "All Areas"
        ) ||
        selectedAreas.includes(
          row.area
        );

      const institutionMatch =
        selectedInstitutions.includes(
          "All Institutions"
        ) ||
        selectedInstitutions.includes(
          row.institution
        );

      const typeMatch =
        selectedTypes.includes(
          "All Types"
        ) ||
        selectedTypes.includes(
          row.type
        );

      return (
        yearMatch &&
        areaMatch &&
        institutionMatch &&
        typeMatch
      );
    }
  );

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
      {/* SIDEBAR */}
      <div
        style={{
          width: "260px",
          flexShrink: 0,
          borderRight:
            "1px solid var(--border)",
          background:
            "var(--panel)",
          padding: "12px",
          overflowY: "auto"
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700,
            marginBottom: "12px",
            marginLeft: "5px"
          }}
        >
          Filters
        </div>

        <FilterMultiSelect
          title="Year"
          values={selectedYears}
          options={yearOptions}
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

      {/* TABLE */}
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
            fontWeight: 700,
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
            background:
              "var(--panel)"
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
              fontWeight: 700,
              letterSpacing:
                "0.5px",
              opacity: 0.65,
              borderBottom:
                "1px solid var(--border)"
            }}
          >
            <div>Date</div>
            <div>Area</div>
            <div>Institution</div>
            <div>Type</div>
            <div>Expand</div>
          </div>

          {filteredRows.length ===
          0 ? (
            <div
              style={{
                padding: "18px"
              }}
            >
              No votes match
              filters.
            </div>
          ) : (
            filteredRows.map(
              (row) => {
                const isOpen =
                  expanded ===
                  row.href;

                const leaders =
                  row.preview
                    ?.leaders || [];

                const seats =
                  row.preview
                    ?.seatLeaders ||
                  [];

                const showSeats =
                  row.type ===
                    "General Election" ||
                  row.type ===
                    "Assembly Election";

                return (
                  <div
                    key={row.href}
                    style={{
                      borderBottom:
                        "1px solid var(--border)"
                    }}
                  >
                    {/* MAIN ROW */}
                    <div
                      onClick={() =>
                        toggleRow(
                          row.href
                        )
                      }
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "140px 1.3fr 1.2fr 1fr 70px",
                        padding:
                          "14px",
                        cursor:
                          "pointer",
                        fontSize:
                          "13px",
                        alignItems:
                          "center"
                      }}
                    >
                      <div>
                        {row.date}
                      </div>

                      <a
                        href={row.href}
                        onClick={(
                          e
                        ) =>
                          e.stopPropagation()
                        }
                        style={{
                          color:
                            "inherit",
                          textDecoration:
                            "none",
                          fontWeight: 600,
                          position:
                            "relative",
                          width:
                            "fit-content"
                        }}
                        onMouseEnter={(
                          e
                        ) => {
                          const t =
                            e.currentTarget;

                          t.style.color =
                            "#00dfef";

                          const line =
                            t.querySelector(
                              "span"
                            ) as HTMLElement;

                          if (
                            line
                          ) {
                            line.style.width =
                              "100%";
                          }
                        }}
                        onMouseLeave={(
                          e
                        ) => {
                          const t =
                            e.currentTarget;

                          t.style.color =
                            "inherit";

                          const line =
                            t.querySelector(
                              "span"
                            ) as HTMLElement;

                          if (
                            line
                          ) {
                            line.style.width =
                              "0";
                          }
                        }}
                      >
                        {row.area}

                        <span
                          style={{
                            position:
                              "absolute",
                            left: 0,
                            bottom:
                              "-2px",
                            height:
                              "2px",
                            width: "0",
                            background:
                              "#00dfef",
                            transition:
                              "width 0.25s ease"
                          }}
                        />
                      </a>

                      <div>
                        {
                          row.institution
                        }
                      </div>

                      <div>
                        {row.type}
                      </div>

                      <div>
                        {isOpen
                          ? "−"
                          : "+"}
                      </div>
                    </div>

{/* EXPANDED */}
<div
  style={{
    display: "grid",
    gridTemplateRows: isOpen
      ? "1fr"
      : "0fr",
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
  <div
    style={{
      overflow: "hidden"
    }}
  >
  <div
    style={{
      padding: isOpen
        ? "16px"
        : "0 16px",
      display: "flex",
      alignItems: "flex-start",
      justifyContent:
        "space-between",
      gap: "22px"
    }}
  >
    {/* LEFT */}
    <div
      style={{
        flex: 1,
        minWidth: 0
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.7px",
          opacity: 0.5,
          marginBottom: "14px"
        }}
      >
        RESULT PREVIEW
      </div>

      {/* VOTE SHARE */}
      <div
        style={{
          fontSize: "10px",
          fontWeight: 700,
          opacity: 0.45,
          marginBottom: "8px",
          letterSpacing: "0.6px"
        }}
      >
        VOTE SHARE
      </div>

      <div
        style={{
          display: "grid",
          gap: "7px",
          marginBottom:
            showSeats &&
            seats.length > 0
              ? "18px"
              : "0"
        }}
      >
        {leaders.map(
          (item: any) => {
            const color =
              PARTY_COLORS[
                item.name
              ] || "#666";

            return (
              <div
                key={item.name}
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: "10px",
                  fontSize: "12px"
                }}
              >
                <div
                  style={{
                    width: "3px",
                    height: "18px",
                    borderRadius:
                      "999px",
                    background:
                      color,
                    flexShrink: 0
                  }}
                />

                <div
                  style={{
                    width: "90px",
                    fontWeight: 700
                  }}
                >
                  {item.name}
                </div>

                <div
                  style={{
                    opacity: 0.75,
                    fontWeight: 600
                  }}
                >
                  {item.percent}%
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* SEATS */}
      {showSeats &&
        seats.length >
          0 && (
          <>
            <div
              style={{
                fontSize:
                  "10px",
                fontWeight: 700,
                opacity: 0.45,
                marginBottom:
                  "8px",
                letterSpacing:
                  "0.6px"
              }}
            >
              SEATS WON
            </div>

            <div
              style={{
                display:
                  "grid",
                gap: "7px"
              }}
            >
              {seats.map(
                (
                  item: any
                ) => {
                  const color =
                    PARTY_COLORS[
                      item.name
                    ] ||
                    "#666";

                  return (
                    <div
                      key={
                        item.name
                      }
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "10px",
                        fontSize:
                          "12px"
                      }}
                    >
                      <div
                        style={{
                          width:
                            "3px",
                          height:
                            "18px",
                          borderRadius:
                            "999px",
                          background:
                            color,
                          flexShrink: 0
                        }}
                      />

                      <div
                        style={{
                          width:
                            "90px",
                          fontWeight: 700
                        }}
                      >
                        {
                          item.name
                        }
                      </div>

                      <div
                        style={{
                          opacity: 0.75,
                          fontWeight: 600
                        }}
                      >
                        {
                          item.value
                        }
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </>
        )}
    </div>

    {/* CTA */}
    <a
      href={row.href}
      style={{
        flexShrink: 0,
        padding:
          "10px 14px",
        borderRadius:
          "999px",
        border:
          "1px solid var(--border)",
        background:
          "rgba(255,255,255,0.03)",
        color:
          "var(--text)",
        textDecoration:
          "none",
        fontSize:
          "12px",
        fontWeight: 700
      }}
    >
      Go to full result →
    </a>
  </div>
</div>
</div>
                  </div>
                );
              }
            )
          )}
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
    useState(true);

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
      <div
        onClick={() =>
          setOpen(!open)
        }
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
            fontWeight: 700,
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

      {open && (
        <div
          style={{
            padding:
              "0 8px 8px"
          }}
        >
          {options.map(
            (option) => {
              const active =
                values.includes(
                  option
                );

              return (
                <div
                  key={option}
                  onClick={() =>
                    toggle(
                      option
                    )
                  }
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: "8px",
                    padding:
                      "6px 8px",
                    cursor:
                      "pointer",
                    fontSize:
                      "13px"
                  }}
                >
                  <div
                    style={{
                      width:
                        "14px",
                      height:
                        "14px",
                      borderRadius:
                        "4px",
                      border:
                        "1px solid var(--border)",
                      background:
                        active
                          ? "var(--text)"
                          : "transparent"
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
            }
          )}
        </div>
      )}
    </div>
  );
}