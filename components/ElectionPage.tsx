"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import ElectionMetaPanel from "./ElectionMetaPanel";
import Map from "./Map";
import TransferFlow from "./TransferFlow";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

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
  IPP: "#0e9775"
};

function AnimatedNumber({
value,
previousValue
}: {
value: number;
previousValue: number;
}) {
  const [display, setDisplay] = useState(previousValue);

  useEffect(() => {
    let start: number = previousValue;
    let end: number = value;
    let startTime: number | null = null;

    const duration = 700;

    function animate(time: number) {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 3);

      const current = Math.floor(start + (end - start) * eased);
      setDisplay(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [value, previousValue]);

  return display.toLocaleString();
}

function AnimatedBar({
percent,
quotaPercent,showSurplus,party,status,justEliminated
}: {
percent: number;
quotaPercent: number; showSurplus: number; party: number;  status: number; justEliminated: number;
}) {


  const [width, setWidth] = useState(percent);
  const previous = useRef(percent);

  useEffect(() => {
  let start = previous.current;
  let end = percent;
  let startTime: number | null = null;

  const duration = 800;

  function animate(time: number) {
    if (!startTime) startTime = time;
    const progress = Math.min((time - startTime) / duration, 1);

    const eased = 1 - Math.pow(1 - progress, 3);

    const current = start + (end - start) * eased;
    setWidth(current);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      previous.current = end;
    }
  }

  requestAnimationFrame(animate);
}, [percent]);

  const stripeLeft =
    percent > 0
      ? (quotaPercent / percent) * 100
      : 0;

  const stripeWidth =
    percent > quotaPercent
      ? ((percent - quotaPercent) / percent) * 100
      : 0;

  return (
    <div
      style={{
        width: justEliminated ? "100%" : `${width}%`,
        height: "100%",
        borderRadius: "4px",
        position: "relative",
        background:
          justEliminated
            ? "repeating-linear-gradient(45deg, #ff5252, #ff5252 6px, #ffcdd2 6px, #ffcdd2 12px)"
            : PARTY_COLORS[party] || "#888",
        overflow: "hidden"
      }}
    >
      {showSurplus && stripeWidth > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${stripeLeft}%`,
            width: `${stripeWidth}%`,
            height: "100%",
            background:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.6), rgba(255,255,255,0.6) 4px, transparent 4px, transparent 8px)"
          }}
        />
      )}
    </div>
  );
}

export default function ElectionPage({
  title,
  year,
  country,
  type
}: {
  title: string;
  year: number | string;
  country: string;
  type: string;
}) {
  // 👇 THIS is "inside the component"
// 👇 inside component

const [selected, setSelected] = useState<any>(null);
const [total, setTotal] = useState<any>(null);
const [resetTrigger, setResetTrigger] = useState<number>(0);

const [search, setSearch] = useState<string>("");
const [list, setList] = useState<any[]>([]);
const [results, setResults] = useState<any>({});

const [count, setCount] = useState<number>(1);

const [highlighted, setHighlighted] = useState<any>(null);

const [view, setView] = useState<string>("count");
const [mapView, setMapView] = useState<string>("party");
const [analysis, setAnalysis] = useState<string>("basic");

const [previousResults, setPreviousResults] = useState<any>({});

/* RESET COUNT WHEN CONSTITUENCY CHANGES */
useEffect(() => {
  setCount(1);
  setHighlighted(null);
}, [selected])

const toggleStyle = {
  flex: 1,
  padding: "6px 8px",
  border: "none",
  background: "transparent",
  color: "#fff",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
  position: "relative",
  zIndex: 1
};

const HelpTooltip = ({ text }: { text: string }) => {
  return (
    <span
      style={{
        marginLeft: "4px",
        cursor: "help",
        opacity: 0.6
      }}
      title={text}
    >
      ?
    </span>
  );
};

const LeakageTooltip = ({ active, payload, label }: { active: string; payload: any[]; label: string }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: "#1f1f1f",
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "8px",
        fontSize: "11px"
      }}
    >
      <div
        style={{
          fontWeight: "600",
          marginBottom: "4px"
        }}
      >
        Count {label}
      </div>

      <div>
        Leakage: {payload[0].value}%
      </div>
    </div>
  );
};

  const current = selected
  ? { name: selected.name, data: results[selected.name] }
  : null;

console.log("CURRENT DATA:", current);

const rawMeta =
  current?.data?.counts?.[count]?.[0];

const meta = rawMeta && {
  ...rawMeta,
  turnoutPercent: rawMeta.electorate
    ? (rawMeta.turnout / rawMeta.electorate) * 100
    : 0,
  tvpPercent: rawMeta.turnout
    ? (rawMeta.tvp / rawMeta.turnout) * 100
    : 0,
  spoiltPercent: rawMeta.turnout
    ? (rawMeta.spoilt / rawMeta.turnout) * 100
    : 0
};

  const counts = current?.data?.counts || {};
const latestCount = Math.max(...Object.keys(counts).map(Number));

let topGainer = null;

if (current?.data?.counts?.[count]) {
  const data = current.data.counts[count];
  const prevData: any[] = current.data.counts[count - 1] || [];

  const candidates = [...data];

  const gains = candidates.map((c) => {
    const prev = prevData.find(
      (p) => p.name === c.name && p.party === c.party
    );
    return prev ? c.votes - prev.votes : 0;
  });

  const maxGain = gains.length ? Math.max(...gains) : 0;

  topGainer =
    maxGain > 0
      ? candidates.find((c, i) => gains[i] === maxGain)
      : null;
}

useEffect(() => {
  if (topGainer) {
    setHighlighted(topGainer.id);

    const timeout = setTimeout(() => {
      setHighlighted(null);
    }, 1500);

    return () => clearTimeout(timeout);
  }
}, [count, topGainer]);

const constituencies = total
  ? Object.keys(total.data).length > 0
    ? Object.keys(total.data) // TEMP fallback (we’ll improve later)
    : []
  : [];

const filtered = list.filter((name) =>
  name.toLowerCase().includes(search.toLowerCase())
);

const nationalResults = (() => {
  const partySeats: Record<string, number> = {};
  const partyVotes: Record<string, number> = {};

  let constituenciesReporting = 0;
  let totalSeatsDeclared = 0;

  const totalConstituencies = Object.keys(results || {}).length;

  Object.entries(results || {}).forEach(([constituency, constituencyData]) => {
  const data = constituencyData as any;
    const counts = (constituencyData as any)?.counts;
    if (!counts) return;

    const firstCount = counts[1] || [];

    const countNumbers = Object.keys(counts).map(Number);
    const lastCount = Math.max(...countNumbers);

    if (lastCount >= 1) {
      constituenciesReporting++;
    }

    const finalData = counts[lastCount] || [];

    // Seats from FINAL count
    finalData.forEach((c: any) => {
      if (c.status === "elected") {
        if (!partySeats[c.party]) partySeats[c.party] = 0;
        partySeats[c.party]++;
        totalSeatsDeclared++;
      }
    });

    // Votes from FIRST count
    firstCount.forEach((c: any) => {
      if (!partyVotes[c.party]) partyVotes[c.party] = 0;
      partyVotes[c.party] += c.votes;
    });
  });


  const totalVotes = Object.values(partyVotes)
    .reduce((a, b) => a + b, 0);

  /* =============================
     PREVIOUS RESULTS (REPORTING ONLY)
  ============================= */

  const previousPartySeats: Record<string, number> = {};
  const previousPartyVotes: Record<string, number> = {};

  Object.entries(results || {}).forEach(
    ([constituency]) => {

      const previous = previousResults?.[constituency];
      if (!previous) return;

      Object.entries(previous).forEach(
        ([party, data]: [string, any]) => {

          if (!previousPartySeats[party]) {
            previousPartySeats[party] = 0;
          }

          if (!previousPartyVotes[party]) {
            previousPartyVotes[party] = 0;
          }

          previousPartySeats[party] += data.seats || 0;
          previousPartyVotes[party] += data.votes || 0;

        }
      );

    }
  );


  const previousTotalVotes = Object.values(previousPartyVotes)
    .reduce((a, b) => a + b, 0);


  /* =============================
     BUILD PARTY DATA
  ============================= */

const parties = Object.keys(partyVotes).map((party) => {

  const currentVotes = partyVotes[party] || 0;
  const previousVotes = previousPartyVotes[party] || 0;

  const currentPercent =
    totalVotes
      ? (currentVotes / totalVotes) * 100
      : 0;

  const previousPercent =
    previousTotalVotes
      ? (previousVotes / previousTotalVotes) * 100
      : 0;

  const voteChange = currentPercent - previousPercent;


  /* SEAT CHANGE CALCULATION */

  let confirmedGain = 0;
  let projectedGain = 0;

  Object.entries(results || {}).forEach(
    ([constituency, constituencyData]) => {

      const counts = (constituencyData as any)?.counts;
      if (!counts) return;

      const lastCount = Math.max(...Object.keys(counts).map(Number));
      const finalData = counts[lastCount] || [];

      const seats =
      current?.data?.seats ||
      finalData[0]?.seats ||
        0;

      const elected = finalData.filter(
        (c: any) => c.status === "elected" && c.party === party
      ).length;

      const running = finalData.filter(
        (c: any) =>
          c.party === party &&
          c.status !== "elected" &&
          c.status !== "eliminated"
      ).length;

      const previousSeats =
        previousResults?.[constituency]?.[party]?.seats || 0;

      const constituencyComplete =
        finalData.filter((c: any) => c.status === "elected").length === seats;

      if (constituencyComplete) {
        confirmedGain += (elected - previousSeats);
      } else {

        if (elected > previousSeats) {
          projectedGain += (elected - previousSeats);
        }

        if (running === 0 && elected < previousSeats) {
          projectedGain += (elected - previousSeats);
        }

      }

    }
  );

  const seatChange = confirmedGain + projectedGain;


  return {
    party,
    seats: partySeats[party] || 0,
    votes: currentVotes,
    percent: currentPercent.toFixed(1),
    voteChange,
    seatChange,
    confirmedGain,
    projectedGain
  };

});


  const voteSorted = [...parties].sort((a, b) => {
    if (a.party === "IND") return 1;
    if (b.party === "IND") return -1;
    return b.votes - a.votes;
  });


const seatSorted = [...parties]
  .filter((p) => 
    p.seats > 0 || 
    (previousPartySeats[p.party] || 0) > 0
  )
  .sort((a, b) => {
      if (a.party === "IND") return 1;
      if (b.party === "IND") return -1;
      return b.seats - a.seats;
    });


  return {
    parties: voteSorted,
    seats: seatSorted,
    constituenciesReporting,
    totalConstituencies,
    totalSeatsDeclared
  };

})();

const nationalMeta = (() => {
  let electorate = 0;
  let turnout = 0;
  let tvp = 0;
  let spoilt = 0;
  let quota = 0;
  let quotaCount = 0;

  Object.values(results || {}).forEach((constituency: any) => {
    const counts = constituency?.counts;
    if (!counts) return;

    const first = counts[1]?.[0];
    if (!first) return;

    electorate += first.electorate || 0;
    turnout += first.turnout || 0;
    tvp += first.tvp || 0;
    spoilt += first.spoilt || 0;

    if (first.quota) {
      quota += first.quota;
      quotaCount++;
    }
  });

  return {
    electorate,
    turnout,
    tvp,
    spoilt,
    quota: quotaCount ? Math.round(quota / quotaCount) : 0,
    turnoutPercent: electorate
      ? (turnout / electorate) * 100
      : 0
  };
})();

/* CONSTITUENCY PARTY TOTALS + SWING */

const constituencyParties = (() => {
  if (!current) return [];

  const data = current?.data?.counts?.[1];
  if (!data) return [];

  const totals: Record<string, number> = {};

  data.forEach((c: any) => {
    const party = c.party || "IND";

    if (!totals[party]) {
      totals[party] = 0;
    }

    totals[party] += c.votes;
  });

  const totalVotes = Object.values(totals)
    .reduce((sum, v) => sum + v, 0);

  const constituencyName = current?.name;
  const previous = previousResults?.[constituencyName] || {};

  const previousTotalVotes = Object.values(previous)
    .reduce((sum: number, p: any) => sum + (p.votes || 0), 0);

  return Object.entries(totals)
    .map(([party, votes]: [string, any]) => {

      const percent = totalVotes
        ? (votes / totalVotes) * 100
        : 0;

      const previousVotes =
        previous?.[party]?.votes || 0;

      const previousPercent =
        previousTotalVotes
          ? (previousVotes / previousTotalVotes) * 100
          : 0;

      const swing = percent - previousPercent;

      return {
        party,
        votes,
        percent: percent.toFixed(1),
        swing
      };

    })
    .sort((a, b) => {
      if (a.party === "IND") return 1;
      if (b.party === "IND") return -1;
      return b.votes - a.votes;
    });

})();

const transferData = (() => {
  if (!current?.data?.counts || count <= 1) return null;

  const counts = current.data.counts;

  const currentData = counts[count] || [];
  const prevData = counts[count - 1] || [];
  const prevPrevData = counts[count - 2] || [];

  const sources: any[] = [];

  /* Count 2 special case */
  if (count === 2) {
    prevData.forEach((c: any) => {

      /* Eliminated */
      if (c.status === "eliminated") {
        sources.push({
          ...c,
          type: "eliminated"
        });
      }

      /* Surplus */
      if (c.status === "elected" && c.votes > c.quota) {
        sources.push({
          ...c,
          type: "surplus"
        });
      }

    });

  } else {

    prevData.forEach((c: any) => {

      const prevPrev = prevPrevData.find(
        (p: any) => p.name === c.name && p.party === c.party
      );

      /* Eliminated */
      if (
        prevPrev &&
        prevPrev.status !== "eliminated" &&
        c.status === "eliminated"
      ) {
        sources.push({
          ...c,
          type: "eliminated"
        });
      }

      /* Surplus */
      if (
        c.status === "elected" &&
        c.votes > c.quota
      ) {
        sources.push({
          ...c,
          type: "surplus"
        });
      }

    });

  }

  if (!sources.length) return null;

  const transfers: any[] = [];

  currentData.forEach((c: any) => {
    const prev = prevData.find(
      (p: any) => p.name === c.name && p.party === c.party
    );

    const gain = prev ? c.votes - prev.votes : 0;

    if (gain > 0) {
      transfers.push({
        name: c.name,
        party: c.party,
        gain
      });
    }
  });

  return {
    sources,
    transfers: transfers.sort((a, b) => b.gain - a.gain)
  };

})();

/* TRANSFER FRIENDLINESS MATRIX */

const transferMatrix = (() => {
  if (!transferData) return null;

  const matrix: Record<string, number> = {};

  transferData.transfers.forEach((t) => {
    if (!matrix[t.party]) {
      matrix[t.party] = 0;
    }

    matrix[t.party] += t.gain;
  });

  const total = Object.values(matrix)
    .reduce((a, b) => a + b, 0);

  return Object.entries(matrix)
    .map(([party, votes]: [string, any]) => ({
      party,
      votes,
      percent: total
        ? ((votes / total) * 100).toFixed(1)
        : 0
    }))
    .sort((a, b) => b.votes - a.votes);

})();

/* VOTE LEAKAGE */

const voteLeakage = (() => {
  if (!transferData) return null;

const totalEliminated = transferData.sources
  .reduce((sum, c) => {

    /* elected candidates — use surplus only */
    if (
      c.status === "elected" &&
      c.votes > (c.quota || transferData.quota || 0)
    ) {
      const quota =
        c.quota ||
        transferData.quota ||
        0;

      return sum + (c.votes - quota);
    }

    /* eliminated candidates */
    return sum + (c.votes || 0);

  }, 0);

  const totalTransferred = transferData.transfers
    .reduce((sum, t) => sum + (t.gain || 0), 0);

  const leakage = Math.max(0, totalEliminated - totalTransferred);

  const percent = totalEliminated
    ? ((leakage / totalEliminated) * 100).toFixed(1)
    : 0;

  return {
    leakage,
    percent
  };
})();

/* VOTE LEAKAGE HISTORY */


const leakageHistory = (() => {
  if (!current?.data?.counts) return [];

  const counts = current.data.counts;
  const history: any[] = [];

  Object.keys(counts).forEach((c) => {

    const count = Number(c);

    if (count === 1) {
      history.push({
        count,
        leakage: 0,
        percent: 0
      });
      return;
    }

    const data = counts[count];
    const prev = counts[count - 1];

    if (!data || !prev) return;

    const quota =
      data?.[0]?.quota ||
      prev?.[0]?.quota ||
      0;

    let transferableVotes = 0;
    let totalGain = 0;

    prev.forEach((p: any) => {

      const curr = data.find(
        (d: any) => d.name === p.name && d.party === p.party
      );

      if (!curr) return;

      const diff = curr.votes - p.votes;

      /* Gains */
      if (diff > 0) {
        totalGain += diff;
      }

      /* Eliminated candidates */
      if (p.status === "eliminated") {
        transferableVotes += p.votes;
      }

/* Surplus ONLY */
if (
  p.status === "elected" &&
  p.votes > quota &&
  curr.votes <= quota
) {
  transferableVotes += (p.votes - quota);
}

    });

    const leakageVotes = Math.max(
      0,
      transferableVotes - totalGain
    );

    const percent = transferableVotes
      ? (leakageVotes / transferableVotes) * 100
      : 0;

    history.push({
      count,
      leakage: Math.round(leakageVotes),
      percent: Number(percent.toFixed(1))
    });

  });

  return history;

})();

/* PARTY IDEOLOGY MAP */

const partyIdeology = {

  /* Far Left */
  "PBPS": "far-left",

  /* Left */
  "SF": "left",

  /* Centre Left */
  "LAB": "centre-left",
  "SD": "centre-left",
  "GP": "centre-left",

  /* Centre */
  "FF": "centre",
  "IND": "centre",
  "INDIRL": "centre",
  "AON": "centre",

  /* Centre Right */
  "FG": "centre-right",

  /* Right */
  "REN": "right",

  /* Far Right */
  "IFP": "far-right",
  "IPP": "far-right",
  "NP": "far-right"

};


/* IDEOLOGY DISTANCE */

const ideologyDistance = {
  "far-left": 0,
  "left": 1,
  "centre-left": 2,
  "centre": 3,
  "centre-right": 4,
  "right": 5,
  "far-right": 6
};


/* LIKE-MINDED CHECK */

const isLikeMinded = (partyA, partyB) => {
  const a = ideologyDistance[
    partyIdeology[partyA] || "centre"
  ];

  const b = ideologyDistance[
    partyIdeology[partyB] || "centre"
  ];

  return Math.abs(a - b) <= 1;
};

/* ADVANCED METRICS DATA */

const advancedMetrics = (() => {
  const counts = current?.data?.counts;
  const data = counts?.[count];
  const firstCount = counts?.[1];

  if (!data || !firstCount) return [];

  const quota = data?.[0]?.quota || 0;

  const candidates = data.map((c: any) => {

    const first = firstCount.find(
      (p: any) => p.name === c.name && p.party === c.party
    );

    const firstVotes = first?.votes || 0;
    const gain = c.votes - firstVotes;

    let totalGain = 0;
    let gainCounts = 0;
    let transferCounts = 0;

    let likeMindedTransfers = 0;
    let totalTransfers = 0;

    let samePartyTransfers = 0;
    let samePartyAvailable = 0;

    Object.keys(counts).forEach((k) => {
      const n = Number(k);
      if (n <= 1 || n > count) return;

      const prev = counts[n - 1];
      const curr = counts[n];

      const prevCandidate = prev?.find(
        (p: any) => p.name === c.name && p.party === c.party
      );

      const currCandidate = curr?.find(
        (p: any) => p.name === c.name && p.party === c.party
      );

      if (!prevCandidate || !currCandidate) return;

      const diff = currCandidate.votes - prevCandidate.votes;

      transferCounts++;

      if (diff > 0) {
        gainCounts++;
        totalGain += diff;
      }

      /* Transfer source analysis */
      prev.forEach((p: any) => {

        const transferring =
          p.status === "eliminated" ||
          p.status === "elected";

        if (!transferring) return;

        totalTransfers++;

        /* Like-minded party */
        if (isLikeMinded(c.party, p.party)) {
          likeMindedTransfers++;
        }

        /* Same party transfers */
        if (
          p.party === c.party &&
          p.name !== c.name
        ) {
          samePartyAvailable += p.votes;

          if (diff > 0) {
            samePartyTransfers += diff;
          }
        }

      });

    });

    const consistency = transferCounts
      ? gainCounts / transferCounts
      : 0;

    const growth = firstVotes
      ? totalGain / firstVotes
      : 0;

    const quotaProgress = quota
      ? c.votes / quota
      : 0;

    const partyAlignment = totalTransfers
      ? likeMindedTransfers / totalTransfers
      : 0;

    const partyTransferEfficiency = samePartyAvailable
      ? samePartyTransfers / samePartyAvailable
      : 0;

    return {
      ...c,
      firstVotes,
      gain,
      quotaDistance: c.votes - quota,

      consistency,
      growth,
      quotaProgress,
      partyAlignment,
      partyTransferEfficiency
    };

  });

  return candidates
    .map((c: any) => ({

      ...c,

      /* Magnet */
      magnet: c.votes
        ? (Math.max(0, c.gain) / c.votes) * 100
        : 0,

      /* Composite Efficiency */
      efficiency: (
        (c.growth * 0.25) +
        (c.quotaProgress * 0.25) +
        (c.consistency * 0.15) +
        (c.partyAlignment * 0.15) +
        (c.partyTransferEfficiency * 0.20)
      ) * 100

    }))
    .sort((a: any, b: any) => b.votes - a.votes);

})();

/* SANKEY DATA */

const sankeyData = (() => {
  if (!transferData) return null;

  const nodes: any[] = [];
  const links: any[] = [];

  /* Combined eliminated node */
const sourceLabel = transferData.sources
  .map(s =>
    s.type === "surplus"
      ? `${s.name} (${s.party}) Surplus`
      : `${s.name} (${s.party})`
  );

  nodes.push({
    name: sourceLabel.join("\n"),
    fill: "#666"
  });

  /* Receiving candidates */
  transferData.transfers.forEach((t) => {
    nodes.push({
      name: `${t.name} (${t.party}) +${t.gain.toLocaleString()}`,
      gain: t.gain,
      fill: PARTY_COLORS[t.party] || "#888"
    });
  });

  /* Links */
  transferData.transfers.forEach((t, i) => {
    links.push({
      source: 0,
      target: i + 1,
      value: t.gain
    });
  });

  return { nodes, links };

})();

const hasResults =
  current?.data?.counts &&
  Object.keys(current.data.counts).length > 0;

return (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      overflow: "hidden"
    }}
  >

{/* PAGE HEADER */}
<div
  style={{
    flexShrink: 0,
    padding: "12px 20px",
    borderBottom: "1px solid #333",
    background: "#1f1f1f",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10
  }}
>

{/* LEFT SIDE */}
<div>
  <div style={{ fontSize: "11px", opacity: 0.6 }}>
    You are viewing
  </div>

  <div
    style={{
      fontSize: "18px",
      fontWeight: "700"
    }}
  >
    {title}
  </div>
</div>


{/* RIGHT SIDE */}
<div
  style={{
    display: "flex",
    alignItems: "center"
  }}
>

<div
  style={{
    position: "relative",
    display: "flex",
    background: "#2a2a2a",
    borderRadius: "10px",
    padding: "3px",
    border: "1px solid #333",
    width: "200px"
  }}
>

{/* Sliding Background */}
<div
  style={{
    position: "absolute",
    top: "3px",
    left: analysis === "basic"
      ? "3px"
      : "calc(50% + 1px)",
    width: "calc(50% - 4px)",
    height: "calc(100% - 6px)",
    background: "#444",
    borderRadius: "8px",
    transition: "all 0.25s ease"
  }}
/>

<button
  onClick={() => setAnalysis("basic")}
  style={{
    flex: 1,
    padding: "6px 12px",
    border: "none",
    background: "transparent",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    position: "relative",
    zIndex: 1
  }}
>
Basic
</button>

<button
  onClick={() => setAnalysis("advanced")}
  style={{
    flex: 1,
    padding: "6px 12px",
    border: "none",
    background: "transparent",
    color: "#fff",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    position: "relative",
    zIndex: 1
  }}
>
Advanced
</button>

</div>

</div>

</div>

{/* MAIN CONTENT */}
<div
  style={{
    display: "flex",
    flex: 1,
    minHeight: 0,
    overflow: "hidden"
  }}
>

      {/* LEFT PANEL */}
<div style={{
  width: "55%",
  height: "100%",
  padding: "20px",
  borderRight: "1px solid #333",
  background: "#1f1f1f",
  overflowY: "auto",
  transition: "opacity 0.2s ease"
}}>

{current ? (
  <div>

  
      <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px"
  }}
>

{/* LEFT SIDE */}
<div>

<h2
  style={{
    margin: 0,
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "-0.3px",
    padding: "7px 0px 0px 10px",
    display: "flex",
    alignItems: "center",
    gap: "12px"
  }}
>
  {current.name}

  {/* STATUS DOT */}
  {(() => {
    const counts = current?.data?.counts;
    if (!counts) return null;

    const lastCount = Math.max(...Object.keys(counts).map(Number));
    const finalData = counts[lastCount] || [];

    const seats =
  current?.data?.seats ||
  finalData?.[0]?.seats ||
  0;
    const filled = finalData.filter(
      (c: any) => c.status === "elected"
    ).length;

    const complete = filled === seats;

    return (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13px",
          fontWeight: "600",
          opacity: 0.85
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: complete ? "#4caf50" : "#ff5252",
            animation: complete ? "none" : "blink 2s infinite"
          }}
        />

        {complete ? "Complete" : "Counting"}
      </span>
    );
  })()}
</h2>


{/* SEATS FILLED */}
{(() => {
  const counts = current?.data?.counts;
  if (!counts) return null;

  const lastCount = Math.max(...Object.keys(counts).map(Number));
  const finalData = counts[lastCount] || [];

  const seats =
  current?.data?.seats ||
  finalData?.[0]?.seats ||
  0;
  const filled = finalData.filter(
    (c: any) => c.status === "elected"
  ).length;

  return (
    <div
      style={{
        margin: "2px 0 0 10px",
        fontSize: "14px",
        fontWeight: "600",
        opacity: 0.9
      }}
    >
      {filled} / {seats} Seats Filled
    </div>
  );
})()}

</div>


{/* RIGHT SIDE */}
{selected && (
<button
  onClick={() => {
    setSelected(null);
    setResetTrigger(prev => prev + 1);
  }}
  style={{
    marginTop: "10px",
    padding: "5px 7px",
    borderRadius: "12px",
    background: "transparent",
    border: "2px solid #333",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    fontSize: "12px",
    color: "#aaa",
    cursor: "pointer"
  }}
>
↺ Back to national result
</button>
)}

</div>

{(() => {
  const counts = current?.data?.counts;
  if (!counts) return null;

  const lastCount = Math.max(...Object.keys(counts).map(Number));
  const finalData = counts[lastCount] || [];

  const seats =
  current?.data?.seats ||
  finalData?.[0]?.seats ||
  0;

  const elected = finalData
    .filter((c: any) => c.status === "elected")
    .map((c: any) => {
      let electedOn = null;

      for (let i = 1; i <= lastCount; i++) {
        const countData = counts[i] || [];

        const found = countData.find(
          (p: any) => p.name === c.name && p.party === c.party
        );

        if (found?.status === "elected") {
          electedOn = i;
          break;
        }
      }

      return {
        ...c,
        electedOn
      };
    });

  const filled = elected.length;
  const emptySeats = Math.max(seats - filled, 0);

return (

<>

{/* INFO PANEL */}
<ElectionMetaPanel meta={meta} />

{/* ELECTED */}
<div
  style={{
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    margin: "10px 0"
  }}
>

{/* EMPTY SEATS */}
{Array.from({ length: emptySeats }).map((_, i) => (
<div
  key={`empty-${i}`}
  style={{
    width: "110px",
    height: "135px",
    borderRadius: "15px",
    background: "rgba(255,255,255,0.02)",
    border: "1px dashed rgba(255,255,255,0.08)",
    opacity: 0.4
  }}
/>
))}

{/* ELECTED CANDIDATES */}
{elected.map((c: any) => (
<div
  key={c.id}
  style={{
    width: "110px",
    height: "135px",
    borderRadius: "15px",
    overflow: "hidden",
    background: "#2a2a2a",
    display: "flex",
    flexDirection: "column"
  }}
>

{/* AVATAR */}
<div
  style={{
    height: "65px",
    background: `${PARTY_COLORS[c.party]}33`,
    position: "relative",
    overflow: "hidden"
  }}
>
<svg
  viewBox="0 0 24 24"
  preserveAspectRatio="xMidYMid slice"
  style={{
    position: "absolute",
    width: "110%",
    height: "110%",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    opacity: 0.35
  }}
  fill={PARTY_COLORS[c.party] || "#fff"}
>
<path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/>
</svg>
</div>

{/* INFO */}
<div
  style={{
    flex: 1,
    padding: "8px",
    fontSize: "11px",
    background: PARTY_COLORS[c.party] || "#444",
    color: "white",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    gap: "6px"
  }}
>

{/* NAME */}
<div style={{ minHeight: "32px"}}>

<div
  style={{
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "4px"
  }}
>
<div
  style={{
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  }}
>
  <svg
    width="8"
    height="8"
    viewBox="0 0 16 16"
    fill="none"
  >
    <path
      d="M3.5 8.5L7 11.5L12.5 5"
      stroke={PARTY_COLORS[c.party] || "#1f1f1f"}
      strokeWidth="3"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
  </svg>
</div>

<span>
{c.name.split(" ").slice(1).join(" ") || c.name}
</span>

</div>

{c.incumbent && (
<div
  style={{
    fontSize: "10px",
    opacity: c.incumbent ? 0.9 : 0,
    height: "14px"
  }}
>
  ★ Incumbent
</div>
)}

</div>

{/* PARTY + COUNT */}
<div
  style={{
    fontSize: "10px",
    opacity: 0.9,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "2px"
  }}
>

<span style={{ fontWeight: 600 }}>
  {c.party}
</span>

<span style={{ opacity: 0.4 }}>•</span>

<span style={{ opacity: 0.85 }}>
  Count {c.electedOn}
</span>

</div>

</div>

</div>
))}

</div>

</>
);
})()}



{/* TALLY BAR */}
{!hasResults && (
<div style={{
  marginBottom: "15px",
  padding: "8px 12px",
  borderRadius: "8px",
  background: "#2a2a2a",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
}}>

  {/* LEFT: LIVE */}
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: "6px",
    whiteSpace: "nowrap"
  }}>
    <span style={{
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "red",
      animation: "blink 2s infinite"
    }} />

    <span style={{ color: "red", fontWeight: "700" }}>
      LIVE
    </span>

    <span style={{ color: "#aaa", fontWeight: "600" }}>
      TALLY:
    </span>
  </div>

  {/* CENTER: SCROLLING TICKER */}
  <div style={{
    flex: 1,
    overflow: "hidden",
    margin: "0 10px",
    maskImage: "linear-gradient(to right, transparent, white 10%, white 90%, transparent)"
  }}>
    <div
  style={{
    display: "inline-flex",
    gap: "20px",
    whiteSpace: "nowrap",
    animation: "scroll 30s linear infinite"
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.animationPlayState = "paused";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.animationPlayState = "running";
  }}
>
{(() => {
  const data = current?.data?.counts?.[1] ?? [];

  const candidates = [...data];
  const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);

  candidates.sort((a, b) => b.votes - a.votes);

  return candidates.map((c) => {

    const percent = totalVotes
      ? ((c.votes / totalVotes) * 100).toFixed(1)
      : 0;

    return (
      <span key={c.id} style={{ marginRight: "24px" }}>
        {c.name}{" "}
        <span style={{ fontWeight: "700" }}>{c.party}</span>{" "}
        {percent}%
      </span>
    );
  });
})()}
    </div>
  </div>

  {/* RIGHT: % IN */}
  <div style={{
    fontSize: "12px",
    color: "#aaa",
    fontWeight: "600",
    whiteSpace: "nowrap"
  }}>
    99% COUNTED
  </div>

</div>
)}

{/* VIEW HEADER */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px"
  }}
>

{/* Segmented Toggle */}
<div
  style={{
    position: "relative",
    display: "flex",
    background: "#2a2a2a",
    borderRadius: "10px",
    padding: "3px",
    border: "1px solid #333",
    width: "200px"
  }}
>

{/* Sliding Background */}
<div
  style={{
    position: "absolute",
    top: "3px",
    left: view === "party" ? "3px" : "calc(50% + 1px)",
    width: "calc(50% - 4px)",
    height: "calc(100% - 6px)",
    background: "#444",
    borderRadius: "8px",
    transition: "all 0.25s cubic-bezier(.4,0,.2,1)"
  }}
/>

<button
  onClick={() => setView("party")}
  style={{
    flex: 1,
    padding: "6px 12px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    position: "relative",
    zIndex: 1
  }}
>
  Party
</button>

<button
  onClick={() => setView("count")}
  style={{
    flex: 1,
    padding: "6px 12px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    position: "relative",
    zIndex: 1
  }}
>
  Candidate
</button>

</div>


{/* Count Controls */}
{view === "count" && (
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }}
>

<button
  disabled={count === 1}
  onClick={() => setCount(count - 1)}
  style={{
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "transparent",
    color: "#fff",
    opacity: count === 1 ? 0.3 : 1
  }}
>
  ‹
</button>

<div
  style={{
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "#2a2a2a",
    fontWeight: "600"
  }}
>
  Count {count}
</div>

<button
  disabled={count === latestCount}
  onClick={() => setCount(count + 1)}
  style={{
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "transparent",
    color: "#fff",
    opacity: count === latestCount ? 0.3 : 1
  }}
>
  ›
</button>

<button
  onClick={() => setCount(latestCount)}
  style={{
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: count === latestCount ? "#444" : "transparent",
    color: "#fff",
    fontSize: "12px"
  }}
>
  Jump to Latest
</button>

</div>
)}

</div>

{/* PARTY PANEL */}
{view === "party" && (

<div
  style={{
    marginTop: "20px",
    display: "flex",
    gap: "20px"
  }}
>

{/* VOTE SHARE */}
<div
  style={{
    flex: 2,
    padding: "15px",
    borderRadius: "12px",
    background: "#1f1f1f",
    border: "1px solid #333"
  }}
>

<div
  style={{
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "10px",
    opacity: 0.7
  }}
>
Vote Share
</div>

{constituencyParties.map((p) => (

<div
key={p.party}
style={{
display: "flex",
alignItems: "center",
padding: "8px 0"
}}
>

<div style={{ width: "60px", fontWeight: "600" }}>
{p.party}
</div>

<div style={{
flex: 1,
height: "12px",
background: "#333",
marginRight: "10px",
borderRadius: "4px"
}}>
<div
style={{
width: `${Math.min(p.percent * 1.8, 100)}%`,
height: "100%",
borderRadius: "4px",
background: PARTY_COLORS[p.party] || "#888"
}}
/>
</div>

<div style={{ width: "80px", textAlign: "right" }}>
{p.votes.toLocaleString()}
</div>

<div style={{ width: "60px", textAlign: "right" }}>
{p.percent}%
</div>

</div>

))}

</div>


{/* SWING */}
<div
  style={{
    flex: 1,
    padding: "15px",
    borderRadius: "12px",
    background: "#1f1f1f",
    border: "1px solid #333"
  }}
>

<div
  style={{
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "10px",
    opacity: 0.7
  }}
>
Swing
</div>

{constituencyParties.map((p) => (

<div
key={p.party}
style={{
display: "flex",
alignItems: "center",
padding: "8px 0"
}}
>

<div style={{ width: "60px", fontWeight: "600" }}>
{p.party}
</div>

<div
style={{
flex: 1,
height: "12px",
background: "#333",
marginRight: "10px",
borderRadius: "4px",
position: "relative",
overflow: "hidden"
}}
>

<div
style={{
position: "absolute",
left: "50%",
top: 0,
bottom: 0,
width: "1px",
background: "#666"
}}
/>

<div
style={{
position: "absolute",
left: p.swing > 0
? "50%"
: `${50 + p.swing * 4}%`,
width: `${Math.abs(p.swing) * 4}%`,
height: "100%",
background: PARTY_COLORS[p.party] || "#888",

borderTopLeftRadius:
p.swing < 0 ? "4px" : "0px",

borderBottomLeftRadius:
p.swing < 0 ? "4px" : "0px",

borderTopRightRadius:
p.swing > 0 ? "4px" : "0px",

borderBottomRightRadius:
p.swing > 0 ? "4px" : "0px"
}}
/>

</div>

<div style={{ width: "60px", textAlign: "right" }}>
<span
style={{
fontWeight: "400",
fontSize: "12px",
color: "#888"
}}
>
{p.swing > 0 ? "+" : ""}
{p.swing.toFixed(1)}
</span>
</div>

</div>

))}

</div>

</div>

)}

{/* COUNT PANEL */}

{view === "count" && (
<>

{/* RESULT TABLE */}
<div style={{
  marginTop: "20px",
  padding: "15px",
  borderRadius: "12px",
  background: "#1f1f1f",
  border: "1px solid #333",
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  position: "relative",
  maxHeight: "calc(100vh - 420px)",
  overflowY: "auto"
}}>
  <div style={{
  display: "flex",
  alignItems: "center",
  marginBottom: "10px",
  paddingBottom: "6px",
  borderBottom: "1px solid #333",
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.5px",
  color: "#aaa"
}}>
  {/* CHECKMARK SPACE */}
  <div style={{ width: "20px" }} />

  {/* IMAGE SPACE */}
  <div style={{
    width: "36px",
    marginRight: "10px"
  }} />

  {/* NAME (CANDIDATE) */}
  <div style={{ width: "140px", marginLeft: "5px" }}>
    CANDIDATE
  </div>

  {/* BAR SPACE */}
<div style={{
  width: "calc(100% - 420px)",
  height: "15px",
    marginRight: "10px"
  }} />

  {/* PERCENT */}
<div
  style={{
    width: "60px",
    textAlign: "right",
    marginLeft: "35px",
    opacity: count === 1 ? 1 : 0
  }}
>
  PERCENT
</div>

  {/* VOTES */}
  <div style={{
    width: "80px",
    textAlign: "right",
    marginLeft: "15px"
  }}>
    VOTES
  </div>
</div>

{/* RESULTS TABLE CONTENT */}

<div style={{ position: "relative" }}>

{(() => {
 const data = current?.data?.counts?.[count] || [];

if (!data.length) return <p>Awaiting results...</p>;

const firstCount = current?.data?.counts?.[1] || [];

const firstTotalVotes = firstCount.reduce(
  (sum: any, c: any) => sum + (c.votes || 0),
  0
);

const allCandidates = [...data];

const electedMap = new globalThis.Map();

for (let i = 1; i <= count; i++) {
  const countData = current?.data?.counts?.[i] || [];

  countData.forEach((c: any) => {
    if (c.status === "elected") {
      const key = `${c.name}-${c.party}`;

      if (!electedMap.has(key)) {
        electedMap.set(key, {
          ...c,
          electedOn: i
        });
      }
    }
  });
}

const elected = Array.from(electedMap.values());

const electedKeys = new Set(
  elected.map(c => `${c.name}-${c.party}`)
);

const candidates = allCandidates.filter(
  c => !electedKeys.has(`${c.name}-${c.party}`)
);

const running = candidates.filter(c => {
  if (c.status !== "eliminated") return true;

  const prevData = current?.data?.counts?.[count - 1] || [];
  const prev = prevData.find(
    (p: any) => p.name === c.name && p.party === c.party
  );

  // still show in running area on elimination count
  return prev?.status !== "eliminated";
});

const eliminated = candidates.filter(c => {
  if (c.status !== "eliminated") return false;

  const prevData = current?.data?.counts?.[count - 1] || [];
  const prev = prevData.find(
    (p: any) => p.name === c.name && p.party === c.party
  );

  // only move AFTER redistribution
  return prev?.status === "eliminated";
});

// 👇 sort running by votes
running.sort((a, b) => b.votes - a.votes);

// 👇 determine elimination order
const counts = current.data.counts;

const eliminatedWithOrder = eliminated.map((c) => {
  let eliminatedOn = null;

  for (let i = 1; i <= count; i++) {
    const found = (counts[i] || []).find(
      (p: any) => p.name === c.name && p.party === c.party
    );

    if (found?.status === "eliminated") {
      eliminatedOn = i;
      break;
    }
  }

  return { ...c, eliminatedOn };
});

// 👇 sort eliminated by when they were eliminated
eliminatedWithOrder.sort((a, b) => a.eliminatedOn - b.eliminatedOn);

// 👇 final order
const orderedCandidates = [
  ...elected,
  ...running,
  ...eliminatedWithOrder
];

  const totalVotes = allCandidates.reduce((sum, c) => sum + c.votes, 0);

  const prevData = current?.data?.counts?.[count - 1] || [];

  const gains = candidates.map((c) => {
    const prev = prevData.find(
      (p: any) => p.name === c.name && p.party === c.party
    );
    return prev ? c.votes - prev.votes : 0;
  });

  const maxGain = gains.length ? Math.max(...gains) : 0;

  const topGainer =
  maxGain > 0
    ? candidates.find((c, i) => gains[i] === maxGain)
    : null;

return orderedCandidates.map((c, index) => {

const electedOn = c.electedOn || 0;

const quota = current?.data?.quota || data?.[0]?.quota || 0;

const justElected =
  c.status === "elected" &&
  count === electedOn;

const showSurplus =
  c.status === "elected" &&
  count === electedOn + 1;

const freezeAtQuota =
  c.status === "elected" &&
  count >= electedOn + 2;

const effectiveVotes =
  freezeAtQuota ? quota : c.votes;

const percent = firstTotalVotes
  ? (effectiveVotes / firstTotalVotes) * 100
  : 0;

const quotaPercent = firstTotalVotes
  ? (quota / firstTotalVotes) * 100
  : 0;

const scaledPercent = quotaPercent
  ? (percent / quotaPercent) * 70
  : 0;

const surplus =
  showSurplus && c.votes >= quota
    ? c.votes - quota
    : 0;

const surplusPercent = firstTotalVotes
  ? (surplus / firstTotalVotes) * 100
  : 0;

const scaledSurplusPercent = Math.min(
  surplusPercent * 3,
  100
);

const prevData = current?.data?.counts?.[count - 1] || [];

let justEliminated = false;

if (count > 1) {
  const prev = prevData.find(
    (p: any) => p.name === c.name && p.party === c.party
  );

  // 👇 candidate was eliminated LAST count
  if (prev?.status === "eliminated") {
    justEliminated = true;
  }
}
    
const prev = prevData.find(
  (p: any) => p.name === c.name && p.party === c.party
);

const prevEffectiveVotes =
  count > electedOn + 1 && prev?.status === "elected"
    ? quota
    : prev?.votes || 0;

const currentEffectiveVotes =
  freezeAtQuota ? quota : c.votes;

const gain = currentEffectiveVotes - prevEffectiveVotes;

const finalGain =
  count > electedOn + 1 ? 0 : gain;

    const isTopGainer = gain === maxGain && gain > 0;

  const showDivider =
  c.status === "eliminated" &&
  orderedCandidates.findIndex(x => x.status === "eliminated") ===
    orderedCandidates.findIndex(x => x.id === c.id);

const scaledQuotaPercent = 70;

const surplusWidth =
  Math.max(0, scaledPercent - scaledQuotaPercent);
  
    
return (
  <Fragment key={c.id}>
  {showDivider && (
  <div style={{ margin: "15px 0 10px 0" }}>
    <div
      style={{
        borderTop: "2px dotted #555",
        marginBottom: "6px"
      }}
    />

    <div
      style={{
        fontSize: "11px",
        fontWeight: "600",
        letterSpacing: "1px",
        color: "#777",
        textTransform: "uppercase"
      }}
    >
      Eliminated
    </div>
  </div>
)}

    <div
      style={{
        display: "flex",
        alignItems: "center",
        minWidth: 0,
        padding: "10px",
        marginBottom: "10px",
        borderRadius: "10px",
        background: c.status === "elected" ? "#2a2a2a" : "transparent",
        color: "white",
        position: "relative",
        overflow: "hidden"
      }}
    >

      {/* FLASH */}
      {highlighted === c.id && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "-100%",
            width: "100%",
            height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(18, 73, 20, 0.81), transparent)",
            animation: "flashSweep 1s ease-out",
            zIndex: 2
          }}
        />
      )}

      {/* LABEL */}
      {highlighted === c.id && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "25px",
            fontWeight: "700",
            fontStyle: "italic",
            color: "rgba(255, 255, 255, 0.81)",
            background: "rgba(0,0,0,0)",
            backdropFilter: "blur(3px)",
            animation: "fadeOverlay 1.0s ease-in-out forwards",
            zIndex: 3,
            pointerEvents: "none",
            letterSpacing: "2px"
          }}
        >
          MOST TRANSFERS RECEIVED
        </div>
      )}

{/* ELECTED STRIP */}
{c.status === "elected" && (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "26px",
      background: "#ffffff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1
    }}
  >
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M4 8.5L7 11.5L12 5"
        stroke="#1f1f1f"
        strokeWidth="2.8"
        strokeLinecap="square"
      />
    </svg>
  </div>
)}

{/* Spacer */}
<div style={{ width: "26px" }} />

{/* IMAGE / AVATAR */}
<div
  style={{
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: PARTY_COLORS[c.party] || "#444",
    border: "2px solid #1f1f1f",
    marginRight: "10px",
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }}
>
  <svg
    viewBox="0 0 24 24"
    style={{
      width: "120%",
      height: "120%",
      opacity: 0.25,
      transform: "translateY(2px)"
    }}
    fill="white"
  >
    <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/>
  </svg>
</div>

      {/* NAME */}
      <div style={{ width: "220px" }}>
        <div style={{ fontWeight: "600" }}>
          {c.name}
          {c.incumbent && (
            <span style={{ marginLeft: "6px", fontSize: "10px" }}>★</span>
          )}
        </div>
        <div style={{ fontSize: "12px", opacity: 0.7 }}>
          {c.party}
        </div>
      </div>

{/* BAR */}
<div style={{
  width: "calc(100% - 420px)",
  height: "15px",
  background: "#333",
  marginRight: "10px",
  borderRadius: "4px",
  position: "relative",
  overflow: "hidden"
}}>

{/* MAIN BAR */}
<div
  style={{
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    width: `${scaledPercent}%`,
    background: PARTY_COLORS[c.party] || "#888",
    borderRadius: "4px"
  }}
>

</div>

{/* QUOTA LINE */}
<div
  style={{
    position: "absolute",
    left: `${scaledQuotaPercent}%`,
    top: "-2000px",
    bottom: "-2000px",
    width: "0px",
    borderLeft: "2px dotted white",
    opacity: 0.5,
    pointerEvents: "none",
    zIndex: 3
  }}
/>

{/* QUOTA LABEL */}
{index === 0 && (
<div
  style={{
    position: "absolute",
    left: `${scaledQuotaPercent}%`,
    top: "-22px",
    transform: "translateX(30%)",
    fontSize: "10px",
    fontWeight: "600",
    color: "white",
    opacity: 0.8,
    pointerEvents: "none",
    zIndex: 3
  }}
>
Quota
</div>
)}

<AnimatedBar
  percent={scaledPercent}
  quotaPercent={scaledQuotaPercent}
  showSurplus={showSurplus}
  party={c.party}
  status={c.status}
  justEliminated={justEliminated}
/>

</div>

      {/* % */}
<div
  style={{
    width: "60px",
    textAlign: "right",
    opacity: count === 1 ? 1 : 0
  }}
>
  {percent.toFixed(1)}%
</div>

      {/* VOTES + GAIN */}
      <div style={{ width: "110px", textAlign: "right" }}>
        <div>
{freezeAtQuota ? (
  <AnimatedNumber
    value={quota}
    previousValue={
      prevData.find(
        (p: any) => p.name === c.name && p.party === c.party
      )?.votes || 0
    }
  />
) : showSurplus ? (
  <AnimatedNumber
    value={c.votes}
    previousValue={
      prevData.find(
        (p: any) => p.name === c.name && p.party === c.party
      )?.votes || 0
    }
  />
) : count > c.electedOn ? (
  <span style={{ opacity: 0.5 }}>—</span>
) : (
  <AnimatedNumber
    value={c.votes}
    previousValue={
      prevData.find(
        (p: any) => p.name === c.name && p.party === c.party
      )?.votes || 0
    }
  />
)}
        </div>

{count > 1 && (
  <div
    style={{
      fontSize: "11px",
      fontWeight: isTopGainer ? "700" : "500",
      color:
        gain > 0 ? "#4caf50" :
        gain < 0 ? "#f44336" :
        "#aaa",
    }}
  >
    {gain > 0 ? "↑ " : gain < 0 ? "↓ " : "→ "}
    {gain > 0 ? `+${gain}` : gain}
  </div>
)}
      </div>

    </div>
  </Fragment>
);
});
})()}
</div>
</div>

</>
)}

</div>

) : (

<div>

{/* NATIONAL HEADER */}
<h2
  style={{
    margin: 0,
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "-0.3px",
    padding: "7px 0px 0px 10px"
  }}
>
National Results
</h2>

<div style={{ marginTop: "15px", marginLeft: "10px" }}>
  <ElectionMetaPanel meta={nationalMeta} showQuota={false} />
</div>

{/* SEATS CARDS */}
<div
  style={{
    marginTop: "15px",
    display: "flex",
    gap: "8px",
    flexWrap: "wrap"
  }}
>

{nationalResults.seats.map((p) => (

<div
  key={p.party}
  style={{
    padding: "8px 10px",
    borderRadius: "10px",
    background: `${PARTY_COLORS[p.party]}22`,
    border: `1px solid ${PARTY_COLORS[p.party] || "#444"}`,
    minWidth: "60px",
    textAlign: "center"
  }}
>

{/* PARTY */}
<div
  style={{
    fontSize: "11px",
    opacity: 0.8
  }}
>
{p.party}
</div>

{/* SEATS */}
<div
  style={{
    fontWeight: "700",
    fontSize: "16px"
  }}
>
{p.seats}
</div>

{/* CHANGE */}
{p.seatChange !== 0 && (
<div
  style={{
    fontSize: "10px",
    fontWeight: "600",
    color:
      p.seatChange > 0
        ? "#4caf50"
        : "#f44336"
  }}
>
{p.seatChange > 0 ? "+" : ""}
{p.seatChange}
</div>
)}

</div>

))}

</div>


{/* PROGRESS */}
<div
  style={{
    marginTop: "12px",
    display: "flex",
    gap: "20px",
    fontSize: "13px",
    fontWeight: "600",
    paddingLeft: "10px"
  }}
>

<div>
First Counts:{" "}
<b>
{nationalResults.constituenciesReporting} / {nationalResults.totalConstituencies}
</b>
</div>

<div>
Seats Declared:{" "}
<b>
{nationalResults.totalSeatsDeclared} / 174
</b>
</div>

</div>


{/* VOTE SHARE + SWING */}
<div
  style={{
    marginTop: "20px",
    display: "flex",
    gap: "20px"
  }}
>

{/* VOTE SHARE */}
<div
  style={{
    flex: 2,
    padding: "15px",
    borderRadius: "12px",
    background: "#1f1f1f",
    border: "1px solid #333"
  }}
>

<div
  style={{
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "10px",
    opacity: 0.7
  }}
>
Vote Share
</div>

{nationalResults.parties.map((p) => (

<div
  key={p.party}
  style={{
    display: "flex",
    alignItems: "center",
    padding: "8px 0"
  }}
>

<div style={{ width: "60px", fontWeight: "600" }}>
{p.party}
</div>

<div
  style={{
    flex: 1,
    height: "12px",
    background: "#333",
    borderRadius: "4px",
    marginRight: "10px"
  }}
>
<div
  style={{
    width: `${Math.min(p.percent * 2, 100)}%`,
    height: "100%",
    borderRadius: "4px",
    background: PARTY_COLORS[p.party] || "#888"
  }}
/>
</div>

<div style={{ width: "80px", textAlign: "right" }}>
{p.votes.toLocaleString()}
</div>

<div style={{ width: "60px", textAlign: "right" }}>
{p.percent}%
</div>

</div>

))}

</div>


{/* SWING */}
<div
  style={{
    flex: 1,
    padding: "15px",
    borderRadius: "12px",
    background: "#1f1f1f",
    border: "1px solid #333"
  }}
>

<div
  style={{
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "10px",
    opacity: 0.7
  }}
>
Swing
</div>

{nationalResults.parties.map((p) => (

<div
  key={p.party}
  style={{
    display: "flex",
    alignItems: "center",
    padding: "8px 0"
  }}
>

<div style={{ width: "60px", fontWeight: "600" }}>
{p.party}
</div>

<div
  style={{
    flex: 1,
    height: "12px",
    background: "#333",
    borderRadius: "4px",
    marginRight: "10px",
    position: "relative",
    overflow: "hidden"
  }}
>

{/* ZERO LINE */}
<div
  style={{
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: "1px",
    background: "#666",
    zIndex: 2
  }}
/>

{/* SWING BAR */}
<div
  style={{
    position: "absolute",
    left: p.voteChange > 0
      ? "50%"
      : `${50 + p.voteChange * 4}%`,
    width: `${Math.abs(p.voteChange) * 4}%`,
    height: "100%",
    background: PARTY_COLORS[p.party] || "#888",

    borderTopLeftRadius:
      p.voteChange < 0 ? "4px" : "0px",

    borderBottomLeftRadius:
      p.voteChange < 0 ? "4px" : "0px",

    borderTopRightRadius:
      p.voteChange > 0 ? "4px" : "0px",

    borderBottomRightRadius:
      p.voteChange > 0 ? "4px" : "0px"
  }}
/>

</div>

<div style={{ width: "60px", textAlign: "right" }}>
<span
  style={{
    fontWeight: "400",
    fontSize: "12px",
    color: "#888"
  }}
>
{p.voteChange > 0 ? "+" : ""}
{p.voteChange.toFixed(1)}
</span>
</div>

</div>

))}

</div>

</div>

</div>
)}


{/* VIEW HEADER */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
    marginTop: "14px"
  }}
>

{/* Count Controls */}
{view === "count" && analysis === "advanced" && selected && sankeyData && (
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }}
>

<button
  disabled={count === 1}
  onClick={() => setCount(count - 1)}
  style={{
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "transparent",
    color: "#fff",
    opacity: count === 1 ? 0.3 : 1
  }}
>
  ‹
</button>

<div
  style={{
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "#2a2a2a",
    fontWeight: "600"
  }}
>
  Count {count}
</div>

<button
  disabled={count === latestCount}
  onClick={() => setCount(count + 1)}
  style={{
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "transparent",
    color: "#fff",
    opacity: count === latestCount ? 0.3 : 1
  }}
>
  ›
</button>

<button
  onClick={() => setCount(latestCount)}
  style={{
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: count === latestCount ? "#444" : "transparent",
    color: "#fff",
    fontSize: "12px"
  }}
>
  Jump to Latest
</button>

</div>
)}

</div>

{/* ADVANCED ANALYSIS */}
{view === "count" && analysis === "advanced" && selected && sankeyData && (
<div style={{
  marginTop: "20px",
  padding: "15px",
  borderRadius: "12px",
  background: "#1f1f1f",
  border: "1px solid #333",
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  position: "relative",
  maxHeight: "calc(100vh - 420px)",
  overflowY: "auto"
}}>

<div
  style={{
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    background: "#1f1f1f",
    border: "1px solid #333"
  }}
>

<div
  style={{
    fontSize: "13px",
    fontWeight: "600",
    marginBottom: "10px"
  }}
>
Transfer Flow — Count {count}
</div>

<div
  style={{
    display: "flex",
    gap: "12px",
    alignItems: "stretch"
  }}
>

{/* TRANSFER FLOW */}
<div style={{ flex: 2 }}>
  <TransferFlow data={sankeyData} />
</div>

{/* TRANSFER MATRIX */}
<div style={{ flex: 1 }}>
{transferMatrix && (
<div
  style={{
    padding: "10px",
    borderRadius: "10px",
    background: "#2a2a2a",
    height: "100%"
  }}
>

<div
  style={{
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "8px",
    opacity: 0.8
  }}
>
Transfer Friendliness
</div>

{transferMatrix.map((p) => (

<div
  key={p.party}
  style={{
    display: "flex",
    alignItems: "center",
    marginBottom: "6px"
  }}
>

<div
  style={{
    width: "40px",
    fontSize: "11px",
    fontWeight: "600"
  }}
>
{p.party}
</div>

<div
  style={{
    flex: 1,
    height: "8px",
    background: "#333",
    borderRadius: "4px",
    margin: "0 6px"
  }}
>

<div
  style={{
    width: `${p.percent}%`,
    height: "100%",
    background: PARTY_COLORS[p.party] || "#888",
    borderRadius: "4px"
  }}
/>

</div>

<div
  style={{
    width: "35px",
    fontSize: "11px",
    textAlign: "right"
  }}
>
{p.percent}%
</div>

</div>

))}

</div>
)}
</div>
</div>

</div>

{/* VOTE LEAKAGE CHART */}

{voteLeakage && (
<div
  style={{
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    background: "#1f1f1f",
    border: "1px solid #333"
  }}
>

<div
  style={{
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "8px",
    opacity: 0.8
  }}
>
Vote Leakage
</div>

<div
  style={{
    height: "10px",
    background: "#333",
    borderRadius: "5px"
  }}
>

<div
  style={{
    width: `${voteLeakage.percent}%`,
    height: "100%",
    background: "#f44336",
    borderRadius: "5px"
  }}
/>

</div>

<div
  style={{
    fontSize: "11px",
    marginTop: "6px",
    opacity: 0.8
  }}
>
{voteLeakage.leakage.toLocaleString()} votes were non-transferrable ({voteLeakage.percent}%)
</div>

{leakageHistory.length > 1 && (
<div
  style={{
    height: "140px",
    marginTop: "12px"
  }}
>

<ResponsiveContainer width="100%" height="100%">
<LineChart data={leakageHistory}>

<CartesianGrid
  stroke="#333"
  strokeDasharray="3 3"
/>

<XAxis
  dataKey="count"
  stroke="#aaa"
  tick={{ fontSize: 10 }}
/>

<YAxis
  stroke="#aaa"
  tick={{ fontSize: 10 }}
  domain={[0, 100]}
/>

<Tooltip content={<LeakageTooltip />} />

<Line
  type="monotone"
  dataKey="percent"
  stroke="#f44336"
  strokeWidth={2}
  dot={{ r: 2 }}
  activeDot={{ r: 4 }}
/>

</LineChart>
</ResponsiveContainer>

</div>
)}

</div>
)}

{/* ADVANCED TABLE GOES HERE */}

{/* ADVANCED ANALYTICS TABLE */}
{advancedMetrics && (
<div
  style={{
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    background: "#1f1f1f",
    border: "1px solid #333"
  }}
>

<div
  style={{
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "10px",
    opacity: 0.8
  }}
>
Candidate Performance
</div>

<div
  style={{
    display: "flex",
    fontSize: "11px",
    opacity: 0.7,
    marginBottom: "6px"
  }}
>
<div style={{ width: "200px" }}>Candidate</div>
<div style={{ width: "110px", textAlign: "left" }}>Votes this Count</div>
<div style={{ width: "120px", textAlign: "left" }}>Distance from Quota</div>

<div style={{ width: "110px", textAlign: "left" }}>
Magnet
<HelpTooltip text="Magnet measures how strongly a candidate attracts transfers relative to their overall vote. Higher scores indicate candidates whose support is driven more heavily by transfers." />
</div>

<div style={{ width: "110px", textAlign: "left" }}>
Efficiency
<HelpTooltip text="Efficiency measures how effectively a candidate builds support through transfers, including consistency of gains, progress toward quota, and strength of same-party and like-minded transfers." />
</div>
</div>

{advancedMetrics.map((c: any) => {

const prev = current?.data?.counts?.[count - 1]
  ?.find((p: any) => p.name === c.name && p.party === c.party);

const disableScores =
  prev?.status === "elected" ||
  prev?.status === "eliminated";

return (

<div
  key={c.id}
  style={{
    display: "flex",
    alignItems: "center",
    padding: "6px 0",
    borderTop: "1px solid #2a2a2a",
    fontSize: "11px"
  }}
>

<div
  style={{
    width: "200px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }}
>

{/* Avatar */}
<div
  style={{
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    background: "#2a2a2a",
    border: "1px solid #444",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: "600",
    color: "#aaa"
  }}
>
{c.name.split(" ").map((n: any) => n[0]).slice(0,2).join("")}
</div>

{/* Name + Party + Status */}
<div style={{ lineHeight: "1.1" }}>

<div>
{c.name}
</div>

<div
  style={{
    fontSize: "10px",
    opacity: 0.6,
    display: "flex",
    gap: "6px"
  }}
>

<span>{c.party || "Ind"}</span>

{c.status === "elected" && (
<span style={{ color: "#4caf50" }}>
Elected
</span>
)}

{c.status === "eliminated" && (
<span style={{ color: "#f44336" }}>
Eliminated
</span>
)}

</div>

</div>

</div>

<div style={{ width: "110px", textAlign: "left" }}>
{c.votes.toLocaleString()}
</div>

<div
  style={{
    width: "120px",
    textAlign: "left",
    color: c.quotaDistance > 0 ? "#4caf50" : "#aaa"
  }}
>
{c.quotaDistance > 0 ? "+" : ""}
{Math.round(c.quotaDistance)}
</div>

<div
  style={{
    width: "110px",
    textAlign: "left",
    color: c.magnet > 0 ? "#4caf50" : "#aaa"
  }}
>
{disableScores
  ? "—"
  : `${c.magnet > 0 ? "+" : ""}${c.magnet.toFixed(1)}%`
}
</div>

<div
  style={{
    width: "100px",
    textAlign: "left",
    color:
      c.efficiency > 75 ? "#4caf50" :
      c.efficiency > 40 ? "#ffc107" :
      "#aaa"
  }}
>
{disableScores
  ? "—"
  : `${c.efficiency.toFixed(0)}%`
}
</div>

</div>

);

})}

</div>
)}

</div>
)}

</div>

{/* END OF LEFT PANEL */}

      {/* RIGHT MAP */}
      <div style={{
  width: "45%",
  height: "100%",
  position: "relative"
}}>

{/* MAP TOGGLE */}
{!selected && (
<div
  style={{
    position: "absolute",
    top: "10px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1000
  }}
>

<div
  style={{
    position: "relative",
    display: "flex",
    background: "#2a2a2a",
    borderRadius: "10px",
    padding: "3px",
    border: "1px solid #333",
    width: "520px"
  }}
>

{/* Sliding Background */}
<div
  style={{
    position: "absolute",
    top: "3px",
    left:
      mapView === "party" ? "3px" :
      mapView === "count" ? "calc(25% + 1px)" :
      mapView === "turnout" ? "calc(50% + 1px)" :
      "calc(75% + 1px)",
    width: "calc(25% - 4px)",
    height: "calc(100% - 6px)",
    background: "#444",
    borderRadius: "8px",
    transition: "all 0.25s ease"
  }}
/>

<button
  onClick={() => setMapView("party")}
  style={toggleStyle}
>
Largest Party
</button>

<button
  onClick={() => setMapView("count")}
  style={toggleStyle}
>
Poll-topper
</button>

<button
  onClick={() => setMapView("turnout")}
  style={toggleStyle}
>
Turnout
</button>

<button
  onClick={() => setMapView("spoilt")}
  style={toggleStyle}
>
Spoilt Ballots
</button>

</div>

</div>
)}

<Map
  election={{
    country,
    type,
    year
  }}
  selected={selected}
  view={!selected ? mapView : view}
  onSelect={setSelected}
  onLoadTotal={setTotal}
  onLoadList={setList}
  onLoadResults={setResults}
  resetTrigger={resetTrigger}
  results={results}
  count={count}
  onLoadPreviousResults={setPreviousResults}
/>
      </div>

    </div>
    </div>
  );
}