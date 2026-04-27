import React from "react";

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

type Candidate = {
  name: string;
  party: string;
  votes: number;
  incumbent?: boolean;
};

type Constituency = {
  seats?: number;
  counts?: Record<number, Candidate[]>;
};

type Props = {
  name: string;
  constituency?: Constituency;
  view: string;
  count?: number;
};

function formatLabel(candidate: Candidate) {
  return candidate.name === candidate.party
    ? candidate.name
    : `${candidate.name} (${candidate.party})`;
}

function formatWinnerLabel(
  candidate: Candidate
) {
  if (
    candidate.name === candidate.party
  ) {
    return candidate.name;
  }

  const parts =
    candidate.name.trim().split(/\s+/);

  const lastName =
    parts.length > 1
      ? parts[parts.length - 1]
      : candidate.name;

  return `${lastName} (${candidate.party})`;
}

function Card({
  color,
  title,
  subtitle,
  children
}: {
  color: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: 240,
        overflow: "hidden",
        borderRadius: 10,
        background: "var(--panel)",
        color: "var(--text)",
        border: "1px solid var(--border)",
        boxShadow: "0 10px 24px rgba(0,0,0,0.28)"
      }}
    >
      <div
        style={{
          height: 4,
          width: "100%",
          background: color
        }}
      />

      <div style={{ padding: "8px 10px" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.2
          }}
        >
          {title}
        </div>

        {subtitle && (
          <div
            style={{
              marginTop: 2,
              fontSize: 10,
              opacity: 0.65
            }}
          >
            {subtitle}
          </div>
        )}

        <div style={{ marginTop: 8 }}>{children}</div>
      </div>
    </div>
  );
}

function PartyTooltip({
  name,
  constituency
}: {
  name: string;
  constituency?: Constituency;
}) {
  const first = constituency?.counts?.[1];

  if (!first || first.length === 0) {
    return (
      <Card color="#666" title={name}>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Awaiting results
        </div>
      </Card>
    );
  }

  const totals: Record<string, number> = {};

  first.forEach((candidate) => {
    const party = candidate.party || "Other";

    totals[party] =
      (totals[party] || 0) + (candidate.votes || 0);
  });

const sorted = Object.entries(totals).sort((a, b) => {
  if (a[0] === "IND") return 1;
  if (b[0] === "IND") return -1;
  return b[1] - a[1];
});

  const totalVotes = sorted.reduce(
    (sum, [, votes]) => sum + votes,
    0
  );

  const winner = sorted[0]?.[0] ?? "Other";

  const topFive = sorted.slice(0, 5);

  const othersVotes = sorted
    .slice(5)
    .reduce((sum, [, votes]) => sum + votes, 0);

  const rows: Array<[string, number]> = [...topFive];

  if (othersVotes > 0) {
    rows.push(["OTH", othersVotes]);
  }

  const subtitle =
    constituency?.seats !== undefined
      ? `${constituency.seats} seats`
      : undefined;

  return (
    <Card
      color={PARTY_COLORS[winner] || "#777"}
      title={name}
      subtitle={subtitle}
    >

        <div
  style={{
    fontSize: 10,
    fontWeight: 400,
    textTransform: "uppercase",
    opacity: 0.55,
    marginBottom: 6
  }}
>
  Top 5 parties by vote share
</div>
      {rows.map(([party, votes], index) => {
        const pct =
          totalVotes > 0 ? (votes / totalVotes) * 100 : 0;

        const barColor =
          party === "OTH"
            ? "#666"
            : PARTY_COLORS[party] || "#777";

        const label =
          party === "OTH" ? "Others" : party;

        return (
          <div
            key={party}
            style={{
              position: "relative",
              padding: "5px 8px",
              marginBottom:
                index === rows.length - 1 ? 0 : 4,
              borderRadius: 6,
              overflow: "hidden",
              background: "var(--panel-2)"
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${Math.min(pct * 2, 100)}%`,
                background: barColor,
                opacity: 0.24
              }}
            />

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <div
                style={{
                  width: 3,
                  height: 14,
                  borderRadius: 2,
                  background: barColor,
                  flexShrink: 0
                }}
              />

              <div
                style={{
                  width: 42,
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                {label}
              </div>

              <div style={{ flex: 1 }} />

              <div
                style={{
                  fontSize: 11,
                  opacity: 0.75
                }}
              >
                {pct.toFixed(1)}%
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function CountTooltip({
  name,
  constituency
}: {
  name: string;
  constituency?: Constituency;
}) {
  const first = constituency?.counts?.[1];

  if (!first || first.length === 0) {
    return (
      <Card color="#666" title={name}>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Awaiting results
        </div>
      </Card>
    );
  }

  const sorted = [...first].sort((a, b) => {
    if (a.party === "IND") return 1;
    if (b.party === "IND") return -1;
    return b.votes - a.votes;
  });

  const totalVotes = sorted.reduce(
    (sum, candidate) => sum + candidate.votes,
    0
  );

  const leader = sorted[0];

  if (!leader) {
    return (
      <Card color="#666" title={name}>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Awaiting results
        </div>
      </Card>
    );
  }

  const rows = sorted.slice(0, 6);

  const rawQuota = (
    first[0] as Candidate & {
      quota?: number;
    }
  ).quota;

  const quota =
    typeof rawQuota === "number" && rawQuota > 0
      ? rawQuota
      : null;

  return (
    <Card
      color={PARTY_COLORS[leader.party] || "#777"}
      title={name}
      subtitle={
        constituency?.seats !== undefined
          ? `${constituency.seats} seats`
          : undefined
      }
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 400,
          textTransform: "uppercase",
          opacity: 0.55,
          marginBottom: 5
        }}
      >
        Top 6 candidates on first count
      </div>

      {rows.map((candidate, index) => {
        const pct =
          totalVotes > 0
            ? (candidate.votes / totalVotes) * 100
            : 0;

        const barColor =
          PARTY_COLORS[candidate.party] || "#777";

        const incumbent = (
          candidate as Candidate & {
            incumbent?: boolean;
          }
        ).incumbent;

        return (
          <div
            key={`${candidate.name}-${candidate.party}`}
            style={{
              position: "relative",
              padding: "3px 7px",
              marginBottom:
                index === rows.length - 1 ? 0 : 3,
              borderRadius: 6,
              overflow: "hidden",
              background: "var(--panel-2)"
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${Math.min(pct * 2, 100)}%`,
                background: barColor,
                opacity: 0.24
              }}
            />

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <div
                style={{
                  width: 3,
                  height: 15,
                  borderRadius: 2,
                  background: barColor,
                  flexShrink: 0
                }}
              />

              <div
                style={{
                  flex: 1,
                  minWidth: 0
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.1
                  }}
                >
                  {candidate.name}
                  {incumbent && (
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 7,
                        opacity: 0.8
                      }}
                    >
                      ★
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: 8,
                    opacity: 0.62,
                    lineHeight: 1.05
                  }}
                >
                  {candidate.party}
                </div>
              </div>

              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  opacity: 0.82,
                  whiteSpace: "nowrap"
                }}
              >
                {candidate.votes.toLocaleString()}
              </div>
            </div>
          </div>
        );
      })}

      {quota !== null && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            opacity: 0.72
          }}
        >
          Quota:{" "}
          <span style={{ fontWeight: 700 }}>
            {quota.toLocaleString()}
          </span>
        </div>
      )}
    </Card>
  );
}

function TurnoutTooltip({
  name,
  constituency
}: {
  name: string;
  constituency?: Constituency;
}) {
  const first = constituency?.counts?.[1]?.[0] as
    | (Candidate & {
        turnout?: number;
        electorate?: number;
      })
    | undefined;

  if (!first) {
    return (
      <Card color="#4caf50" title={name}>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Awaiting results
        </div>
      </Card>
    );
  }

  const turnoutVotes =
    typeof first.turnout === "number"
      ? first.turnout
      : 0;

  const electorate =
    typeof first.electorate === "number"
      ? first.electorate
      : 0;

  const turnoutPercent =
    electorate > 0
      ? (turnoutVotes / electorate) * 100
      : 0;

  return (
    <Card color="#4caf50" title={name}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 400,
          textTransform: "uppercase",
          opacity: 0.55,
          marginBottom: 6
        }}
      >
        Voter turnout
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1
        }}
      >
        {turnoutPercent.toFixed(1)}%
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          opacity: 0.72
        }}
      >
        {turnoutVotes.toLocaleString()} votes cast
      </div>

      <div
        style={{
          fontSize: 10,
          opacity: 0.55
        }}
      >
        Electorate {electorate.toLocaleString()}
      </div>
    </Card>
  );
}

function SpoiltTooltip({
  name,
  constituency
}: {
  name: string;
  constituency?: Constituency;
}) {
  const first = constituency?.counts?.[1]?.[0] as
    | (Candidate & {
        spoilt?: number;
        turnout?: number;
      })
    | undefined;

  if (!first) {
    return (
      <Card color="#ff5252" title={name}>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Awaiting results
        </div>
      </Card>
    );
  }

  const spoiltVotes =
    typeof first.spoilt === "number"
      ? first.spoilt
      : 0;

  const turnoutVotes =
    typeof first.turnout === "number"
      ? first.turnout
      : 0;

  const spoiltPercent =
    turnoutVotes > 0
      ? (spoiltVotes / turnoutVotes) * 100
      : 0;

  return (
    <Card color="#ff5252" title={name}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 400,
          textTransform: "uppercase",
          opacity: 0.55,
          marginBottom: 6
        }}
      >
        Spoilt ballots
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1
        }}
      >
        {spoiltPercent.toFixed(2)}%
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          opacity: 0.72
        }}
      >
        {spoiltVotes.toLocaleString()} rejected ballots
      </div>

      <div
        style={{
          fontSize: 10,
          opacity: 0.55
        }}
      >
        From {turnoutVotes.toLocaleString()} votes cast
      </div>
    </Card>
  );
}

function MarginTooltip({
  name,
  constituency
}: {
  name: string;
  constituency?: Constituency;
}) {
  const first = constituency?.counts?.[1];

  if (!first || first.length < 2) {
    return (
      <Card color="#666" title={name}>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Awaiting results
        </div>
      </Card>
    );
  }

  const rows = [...first].sort(
    (a, b) => b.votes - a.votes
  );

  const winner = rows[0];
  const runnerUp = rows[1];

  const totalVotes = rows.reduce(
    (sum, c) => sum + c.votes,
    0
  );

  const winnerPct =
    totalVotes > 0
      ? (winner.votes / totalVotes) * 100
      : 0;

  const runnerPct =
    totalVotes > 0
      ? (runnerUp.votes / totalVotes) * 100
      : 0;

  const margin =
    winnerPct - runnerPct;

  const color =
    PARTY_COLORS[winner.party] || "#666";

  return (
    <Card color={color} title={name}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 400,
          textTransform: "uppercase",
          opacity: 0.55,
          marginBottom: 6
        }}
      >
        Margin
      </div>

<div
  style={{
    fontSize: 16,
    lineHeight: 1.1,
    marginBottom: 2
  }}
>
  <span
    style={{
      fontWeight: 500,
      opacity: 0.92
    }}
  >
    {formatWinnerLabel(winner)}
  </span>{" "}

  <span
    style={{
      fontWeight: 800,
      letterSpacing: "-0.2px"
    }}
  >
    +{margin.toFixed(1)}
  </span>
</div>

      <div
        style={{
          fontSize: 11,
          opacity: 0.68,
          marginBottom: 8
        }}
      >
        over {formatWinnerLabel(runnerUp)}
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 999,
          overflow: "hidden",
          background: "var(--panel-2)",
          display: "flex"
        }}
      >
        <div
          style={{
            width: `${winnerPct}%`,
            background:
              PARTY_COLORS[winner.party] ||
              "#777"
          }}
        />

        <div
          style={{
            width: `${runnerPct}%`,
            background:
              PARTY_COLORS[runnerUp.party] ||
              "#999",
            opacity: 0.7
          }}
        />
      </div>
    </Card>
  );
}

function WinnerTooltip({
  name,
  constituency
}: {
  name: string;
  constituency?: Constituency;
}) {
  const first = constituency?.counts?.[1];

  if (!first || first.length === 0) {
    return (
      <Card color="#666" title={name}>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          Awaiting results
        </div>
      </Card>
    );
  }

  const rows = [...first].sort(
    (a, b) => b.votes - a.votes
  );

  const winner = rows[0];

  const winnerColor =
    PARTY_COLORS[winner?.party] || "#666";

  const totalVotes = rows.reduce(
    (sum, candidate) => sum + candidate.votes,
    0
  );

  return (
    <Card
      color={winnerColor}
      title={name}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 400,
          textTransform: "uppercase",
          opacity: 0.55,
          marginBottom: 6
        }}
      >
        Vote share
      </div>

      {rows.map((candidate, index) => {
        const pct =
          totalVotes > 0
            ? (candidate.votes /
                totalVotes) *
              100
            : 0;

        const color =
          PARTY_COLORS[candidate.party] ||
          "#777";

        const incumbent =
          candidate.incumbent === true;

        return (
          <div
            key={`${candidate.name}-${candidate.party}-${index}`}
            style={{
              position: "relative",
              padding: "3px 7px",
              marginBottom:
                index === rows.length - 1
                  ? 0
                  : 3,
              borderRadius: 6,
              overflow: "hidden",
              background: "var(--panel-2)"
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${Math.min(
                  pct * 2,
                  100
                )}%`,
                background: color,
                opacity: 0.24
              }}
            />

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <div
                style={{
                  width: 3,
                  height: 15,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0
                }}
              />

              <div
                style={{
                  flex: 1,
                  minWidth: 0
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow:
                      "ellipsis",
                    lineHeight: 1.1
                  }}
                >
                  {candidate.name}

                  {incumbent && (
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 7,
                        opacity: 0.8
                      }}
                    >
                      ★
                    </span>
                  )}
                </div>

{candidate.party !== candidate.name && (
  <div
    style={{
      fontSize: 8,
      opacity: 0.62,
      lineHeight: 1.05
    }}
  >
    {candidate.party}
  </div>
)}
              </div>

              <div
  style={{
    fontSize: 10,
    fontWeight: 600,
    opacity: 0.82,
    whiteSpace: "nowrap"
  }}
>
  {pct.toFixed(1)}%
</div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

export default function MapTooltip({
  name,
  constituency,
  view
}: Props) {
  if (view === "party") {
    return (
      <PartyTooltip
        name={name}
        constituency={constituency}
      />
    );
  }

  if (view === "count") {
    return (
      <CountTooltip
        name={name}
        constituency={constituency}
      />
    );
  }

  if (view === "winner") {
    return (
      <WinnerTooltip
        name={name}
        constituency={constituency}
      />
    );
  }

  if (view === "turnout") {
    return (
      <TurnoutTooltip
        name={name}
        constituency={constituency}
      />
    );
  }

  if (view === "spoilt") {
    return (
      <SpoiltTooltip
        name={name}
        constituency={constituency}
      />
    );
  }

  if (view === "margin") {
    return (
      <MarginTooltip
        name={name}
        constituency={constituency}
      />
    );
  }

  return (
    <PartyTooltip
      name={name}
      constituency={constituency}
    />
  );
}