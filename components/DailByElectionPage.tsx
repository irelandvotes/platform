"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import ElectionMetaPanel from "./ElectionMetaPanel";
import { buildCountTimeline } from "../utils/buildCountTimeline";
import dynamic from "next/dynamic";
import MapViewToggle from "./MapViewToggle";
import { useRouter, useSearchParams } from "next/navigation";

const Map = dynamic(
  () => import("@/components/Map"),
  { ssr: false }
) as any;
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
    let start: any = previousValue;
    let end: any = value;
    let startTime: any = null;

    const duration = 700;

    function animate(time: any) {
      
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
quotaPercent: number; showSurplus: any; party: number;  status: number; justEliminated: any;
}) {

  
  const [width, setWidth] = useState(percent);
  const previous = useRef(percent);

  useEffect(() => {
   let start = previous.current;
  let end = percent;
  let startTime: any | null = null;

  const duration = 800;

  function animate(time: any) {
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

export default function DailByElectionPage({
  title,
  year,
  country,
  type,
  slug,
}: {
  title: string;
  year: number | string;
  country: string;
  type: string;
  slug: string;
}) {
// 👇 inside component

const [selected, setSelected] = useState<any>(null);
const [total, setTotal] = useState<any>(null);

const [resetTrigger, setResetTrigger] = useState<number>(0);

const [search, setSearch] = useState<string>("");

const [list, setList] = useState<any[]>([]);
const [results, setResults] = useState<any>({});
const [officialResults, setOfficialResults] = useState<any>(null);

const [count, setCount] = useState<number>(1);

const [highlighted, setHighlighted] = useState<any>(null);

const [view, setView] = useState<string>(
  selected ? "count" : "party"
);
const [analysis, setAnalysis] = useState<string>("basic");

const [previousResults, setPreviousResults] = useState<any>({});
const [mapView, setMapView] = useState<string>("winner");
const [projection, setProjection] = useState<any>(null);

const router = useRouter();
const searchParams = useSearchParams();
const selectedSlug = searchParams.get("c");

const hasResults =
  Object.keys(results || {}).length > 0;

const hasOfficial =
  officialResults &&
  Object.keys(officialResults).length > 0;

const displayResults =
  hasOfficial ? officialResults : results;

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

useEffect(() => {
  if (selected) {
    setView("count");
  }
}, [selected]);

useEffect(() => {
  if (!selectedSlug) {
    setSelected(null);
    return;
  }

  // 🔥 DO NOT early return permanently
  if (!list.length) return;

  const match = list.find((item) => {
    const value =
      typeof item === "string"
        ? item
        : item.name || item.slug || item.id;

    return normalizeSlug(value) === selectedSlug;
  });

  if (!match) {
    // 👇 IMPORTANT: retry later instead of killing state
    return;
  }

  setSelected(
    typeof match === "string"
      ? { name: match }
      : { name: match.name || match.slug || match.id }
  );

}, [selectedSlug, list]);

/* RESET COUNT WHEN CONSTITUENCY CHANGES */
useEffect(() => {
  setCount(1);
  setHighlighted(null);
}, [selected])

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

const LeakageTooltip = ({ active, payload, label }: { active: boolean; payload: any[]; label: string }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
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

function aggregateNationalMeta(results: Record<string, any>, count: number) {
  let electorate = 0;
  let turnout = 0;
  let tvp = 0;
  let spoilt = 0;
  let seats = 1;

  Object.values(results).forEach((constituency) => {
    const rows = constituency?.counts?.[count];

    if (!rows || !rows.length) return;

    const meta = rows[0]; // first candidate row contains metadata

    electorate += meta.electorate || 0;
    turnout += meta.turnout || 0;
    tvp += meta.tvp || 0;
    spoilt += meta.spoilt || 0;

    seats = meta.seats || 1;
  });

const quota = Math.floor(tvp / (seats + 1)) + 1;

const turnoutPercent = electorate
  ? (turnout / electorate) * 100
  : 0;

const tvpPercent = turnout
  ? (tvp / turnout) * 100
  : 0;

const spoiltPercent = turnout
  ? (spoilt / turnout) * 100
  : 0;

return {
  electorate,
  turnout,
  turnoutPercent,
  tvp,
  tvpPercent,
  spoilt,
  spoiltPercent,
  quota,
  seats
};
}

function aggregateNational(results: any) {
  const counts: Record<string, any[]> = {};

  Object.values(results).forEach((constituency: any) => {
    Object.entries(constituency.counts || {}).forEach(([count, data]: [string, any]) => {
      if (!counts[count]) counts[count] = [];

      data.forEach((candidate: any) => {
        const existing = counts[count].find(
          c =>
            c.name === candidate.name &&
            c.party === candidate.party
        );

        if (existing) {
          existing.votes += candidate.votes;
        } else {
          counts[count].push({ ...candidate });
        }
      });
    });
  });

  return { counts };
}

function getCandidateImage(name: any) {
  const slug = name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "-");

  return `/candidates/images/${slug}.jpg`;
}

const usingOfficial =
  officialResults &&
  Object.keys(officialResults).length > 0;

const current: any = selected
  ? {
      name: selected.name,

      // ALWAYS use count/tally data
      data: results?.[selected.name],

      // separate official state
      official: officialResults?.[selected.name]
    }
  : hasResults || hasOfficial
  ? {
      name: "Overall",

      // overall should use whichever dataset is active
      data: aggregateNational(displayResults)
    }
  : null;

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

const prevCountRef = useRef(count);

useEffect(() => {
  if (prevCountRef.current === count) return;

  prevCountRef.current = count;

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
const dataset =
  hasResults && Object.keys(results).length > 0
    ? results
    : displayResults;
  const partySeats: Record<string, number> = {};
  const partyVotes: Record<string, number> = {};

  let constituenciesReporting = 0;
  let totalSeatsDeclared = 0;

  const totalConstituencies = Object.keys(dataset || {}).length;

  Object.entries(dataset || {}).forEach(
    ([constituency, constituencyData]) => {

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

const overallPrevious =
  previousResults?.[title] ||
  Object.values(previousResults || {})[0];

if (overallPrevious) {

  Object.entries(overallPrevious).forEach(
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

 Object.entries(displayResults || {}).forEach(
    ([constituency, constituencyData]) => {

      const counts = (constituencyData as any)?.counts;
      if (!counts) return;

      const lastCount = Math.max(...Object.keys(counts).map(Number));
      const finalData = counts[lastCount] || [];

      const seats = finalData[0]?.seats || 0;

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
  hasOfficial &&
  finalData.filter(
    (c: any) => c.status === "elected"
  ).length === seats;

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
    .reduce((sum: number, v: any) => sum + v, 0);

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

const countTimeline = current?.data?.counts
  ? buildCountTimeline(current.data.counts)
  : {};

const transferData: any = (() => {
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

  transferData.transfers.forEach((t: any) => {
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
  .reduce((sum: number, c: any) => {

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
    .reduce((sum: number, t: any) => sum + (t.gain || 0), 0);

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

const partyIdeology: Record<string, string> = {

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

const ideologyDistance: Record<string, number> = {
  "far-left": 0,
  "left": 1,
  "centre-left": 2,
  "centre": 3,
  "centre-right": 4,
  "right": 5,
  "far-right": 6
};


/* LIKE-MINDED CHECK */

const isLikeMinded = (partyA: string, partyB: string) => {
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
  .map((s: any) =>
    s.type === "surplus"
      ? `${s.name} (${s.party}) Surplus`
      : `${s.name} (${s.party})`
  );

  nodes.push({
    name: sourceLabel.join("\n"),
    fill: "#666"
  });

  /* Receiving candidates */
  transferData.transfers.forEach((t: any) => {
    nodes.push({
      name: `${t.name} (${t.party}) +${t.gain.toLocaleString()}`,
      gain: t.gain,
      fill: PARTY_COLORS[t.party] || "#888"
    });
  });

  /* Links */
  transferData.transfers.forEach((t: any, i: number) => {
    links.push({
      source: 0,
      target: i + 1,
      value: t.gain
    });
  });

  return { nodes, links };

})();

const resultsObj = displayResults as Record<string, any>;

const totalConstituencies = Object.keys(resultsObj).length;

const reporting = Object.values(resultsObj).filter((c) => {
  const first = c?.counts?.[1];

  if (!first || !first.length) return false;

  const totalVotes = first.reduce(
    (sum: number, x: any) => sum + (x.votes || 0),
    0
  );

  return totalVotes > 0;
}).length;

const reportingPercent =
  totalConstituencies > 0
    ? Math.round((reporting / totalConstituencies) * 100)
    : 0;

const isOverall = current?.name === "Overall";

const isTally =
  !isOverall || // ALWAYS true for constituencies
  !officialResults ||
  Object.keys(officialResults).length === 0;

console.log(Object.keys(results));

const rawMeta =
  current?.name === "Overall"
    ? aggregateNationalMeta(
  displayResults,
        1 // 👈 ALWAYS use first count for meta
      )
    : current?.data?.counts?.[count]?.[0] ||
      current?.data?.counts?.[1]?.[0]; // 👈 fallback

const nationalMeta = rawMeta && {
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

return (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
    }}
  >

{/* PAGE HEADER */}
<div
  style={{
    flexShrink: 0,
    padding: "12px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--panel)",
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

</div>

{/* MAIN CONTENT */}
<div
  className="election-layout"
  style={{
    flex: 1,
    minHeight: 0
  }}
>

{/* LEFT PANEL */}
<div
  className="election-left-panel"
  style={{
    padding: "20px",
    background: "var(--panel)",
overflowY: "auto",
WebkitOverflowScrolling: "touch",
touchAction: "pan-y",
    transition: "opacity 0.2s ease"
  }}
>
 
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
  {current?.name || "Loading..."}

  {/* STATUS DOT */}
  {(() => {
    const counts = current?.data?.counts;
    if (!counts) return null;

    const lastCount = Math.max(...Object.keys(counts).map(Number));
    const finalData = counts[lastCount] || [];

    const seats = finalData[0]?.seats || 0;
    const filled = finalData.filter(
      (c: any) => c.status === "elected"
    ).length;

let complete = false;

if (isTally) {
  // 🟥 TALLY LOGIC
  if (isOverall) {
    // overall tally = all constituencies reporting
    complete = reporting === totalConstituencies;
  } else {
    // constituency tally = any data present
    const hasData =
      current?.data?.counts &&
      Object.keys(current.data.counts).length > 0;

    complete = !!hasData;
  }
} else {
  // 🟩 OFFICIAL RESULT LOGIC
  complete = filled === seats;
}

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

{isTally && (
  <div
    style={{
      marginTop: "8px",
      padding: "10px 12px",
      borderRadius: "8px",
      background: "rgba(255, 82, 82, 0.08)",
      border: "1px solid rgba(255, 82, 82, 0.25)",
      fontSize: "12px",
      lineHeight: 1.4
    }}
  >

    {/* TOP ROW */}
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "4px"
      }}
    >
      <div style={{ fontWeight: "700", color: "#ff5252" }}>
        Tally Data
      </div>

      <div
        style={{
          fontSize: "11px",
          opacity: 0.7
        }}
      >
        {isOverall
  ? ` ${reportingPercent}% counted`
  : ""}
      </div>
    </div>

    {/* EXPLANATION */}
    <div style={{ opacity: 0.8 }}>
      Estimated result based on collated ballot boxes. Not an official result.
    </div>

  </div>
)}

</div>


{/* RIGHT SIDE */}
{selected && (
<button
  onClick={() => {
    setSelected(null);
router.push(`?`);
    setResetTrigger(prev => prev + 1);
  }}
  style={{
    marginTop: "10px",
    padding: "5px 7px",
    borderRadius: "12px",
    background: "transparent",
    border: "1px solid var(--border)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    fontSize: "12px",
    color: "var(--text-muted)",
    cursor: "pointer"
  }}
>
↺ Back to overall result
</button>
)}

</div>

{(() => {
  const counts = current?.data?.counts;
  if (!counts) return null;

  const lastCount = Math.max(...Object.keys(counts).map(Number));
  const finalData = counts[lastCount] || [];

  const seats = finalData[0]?.seats || 0;

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

{/* WINNER BANNER */}
{elected.slice(0, 1).map((c: any) => (
<div
  key={c.id}
  style={{
    marginBottom: "16px",
    marginLeft: "-20px",
    marginRight: "-20px",
    borderRadius: "0px",
    overflow: "hidden",
    background: PARTY_COLORS[c.party] || "#444",
    color: "white",
    display: "flex",
    alignItems: "stretch",
    position: "relative"
  }}
>

{/* IMAGE */}
<div
  style={{
    width: "110px",
    background: "#00000033"
  }}
>
<img
  src={getCandidateImage(c.name)}
  alt={c.name}
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover"
  }}
onError={(e) => {
  (e.target as HTMLImageElement).style.display = "none";
}}
/>
</div>

{/* CONTENT */}
<div
  style={{
    flex: 1,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center"
  }}
>

{/* NAME + CHECKMARK */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "22px",
    fontWeight: "700",
    marginTop: "2px"
  }}
>

{/* CHECKMARK */}
<div
  style={{
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  }}
>
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
  >
    <path
      d="M4 8.5L7 11.5L12 5"
      stroke={PARTY_COLORS[c.party] || "#1f1f1f"}
      strokeWidth="2.8"
      strokeLinecap="square"
    />
  </svg>
</div>

<span>{c.name}</span>

</div>

{/* INCUMBENT */}
{c.incumbent && (
<div
  style={{
    fontSize: "11px",
    opacity: 0.9
  }}
>
★ Incumbent
</div>
)}

{/* PARTY + COUNT */}
<div
  style={{
    fontSize: "13px",
    opacity: 0.9
  }}
>
{c.party} • Count {c.electedOn}
</div>

{/* PROJECTION */}
{projection && (
<div
  style={{
    marginTop: "8px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    background: "rgba(0,0,0,0.18)",
    padding: "4px 8px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.15)",
    width: "fit-content"
  }}
>

<span
  style={{
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#4caf50",
    flexShrink: 0
  }}
/>

<span>
<b>#Projected</b> by Ireland Votes — {projection.note}
</span>

</div>
)}

</div>

</div>
))}

    {/* INFO LIST */}

<div style={{ marginBottom: "14px" }}>
  <ElectionMetaPanel meta={nationalMeta} type={undefined} />
</div>

{/* VIEW HEADER */}
<div
  className="view-header"
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
    gap: "12px",
    flexWrap: "wrap"
  }}
>

{/* LEFT: VIEW TOGGLE */}
{current?.name === "Overall" && (
<div
  style={{
    position: "relative",
    display: "flex",
    background: "var(--panel-2)",
    borderRadius: "10px",
    padding: "3px",
    border: "1px solid var(--border)",
    width: "170px"
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
    background: "var(--panel)",
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
    color: "var(--text)",
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
    color: "var(--text)",
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
)}

{/* RIGHT: COUNT CONTROLS */}
{view === "count" && !isTally && (
<div
  className="count-controls"
  style={{
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginLeft: "auto"
  }}
>

<button
  disabled={count === 1}
  onClick={() => setCount(count - 1)}
  style={{
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    opacity: count === 1 ? 0.3 : 1
  }}
>
  ‹
</button>

<div
  style={{
    padding: "6px 12px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "var(--panel-2)",
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
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
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
    border: "1px solid var(--border)",
    background: count === latestCount
      ? "var(--panel-2)"
      : "transparent",
    color: "var(--text)",
    fontSize: "12px"
  }}
>
  Jump to Latest
</button>

</div>
)}

</div>

{/* PARTY VIEW */}
{current?.name === "Overall" && view === "party" && (
<div
  style={{
    marginTop: "5px",
    display: "flex",
    gap: "14px",
    flexDirection:
      typeof window !== "undefined" &&
      window.innerWidth < 900
        ? "column"
        : "row"
  }}
>

{/* VOTE SHARE */}
<div
  style={{
    flex: 2,
    padding: "12px",
    borderRadius: "12px",
    background: "var(--panel)",
    border: "1px solid var(--border)"
  }}
>

<div
  style={{
    fontSize: "11px",
    fontWeight: "600",
    marginBottom: "8px",
    color: "var(--text-subtle)"
  }}
>
Vote Share
</div>

{nationalResults.parties.map((p: any, index: number) => (

<div
  key={p.party}
  style={{
    position: "relative",
    padding: "6px 10px",
    marginBottom: "4px",
    borderRadius: "6px",
    overflow: "hidden",
    background: "var(--panel-2)",
    transition: "background 0.15s ease"
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = "var(--panel-2)";
  }}
>

{/* FULL ROW BAR */}
<div
  style={{
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: `${Math.min(Number(p.percent) * 2, 100)}%`,
    background: PARTY_COLORS[p.party] || "#888",
    opacity: 0.25
  }}
/>

{/* CONTENT */}
<div
  style={{
    position: "relative",
    display: "flex",
    alignItems: "center"
  }}
>

{/* RANK */}
<div
  style={{
    width: "22px",
    fontSize: "11px",
    opacity: 0.4
  }}
>
{index + 1}
</div>

{/* PARTY STRIP */}
<div
  style={{
    width: "3px",
    height: "16px",
    background: PARTY_COLORS[p.party] || "#888",
    marginRight: "8px",
    borderRadius: "2px"
  }}
/>

{/* PARTY */}
<div
  style={{
    width: "60px",
    fontWeight: "600",
    fontSize: "12px"
  }}
>
{p.party}
</div>

<div style={{ flex: 1 }} />

{/* VOTES */}
<div
  style={{
    width: "90px",
    textAlign: "right",
    fontSize: "12px",
    fontWeight: "500"
  }}
>
{p.votes.toLocaleString()}
</div>

{/* PERCENT */}
<div
  style={{
    width: "60px",
    textAlign: "right",
    fontSize: "12px",
    opacity: 0.8
  }}
>
{p.percent}%
</div>

</div>

</div>

))}

</div>

{/* SWING */}
<div
  style={{
    flex: 1,
    padding: "12px",
    borderRadius: "12px",
    background: "var(--panel)",
    border: "1px solid var(--border)"
  }}
>

<div
  style={{
    fontSize: "11px",
    fontWeight: "600",
    marginBottom: "8px",
    color: "var(--text-subtle)"
  }}
>
Swing
</div>

{nationalResults.parties.map((p: any) => (

<div
  key={p.party}
  style={{
    position: "relative",
    padding: "6px 10px",
    marginBottom: "4px",
    borderRadius: "6px",
    overflow: "hidden",
    background: "var(--panel-2)",
    transition: "background 0.15s ease"
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = "var(--panel-2)";
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
    background: "#555",
    zIndex: 1
  }}
/>

{/* SWING BAR */}
<div
  style={{
    position: "absolute",
    top: 0,
    bottom: 0,
    left:
      p.voteChange > 0
        ? "50%"
        : `${50 + p.voteChange * 4}%`,
    width: `${Math.abs(p.voteChange) * 4}%`,
    background: PARTY_COLORS[p.party] || "#888",
    opacity: 0.25
  }}
/>

{/* CONTENT */}
<div
  style={{
    position: "relative",
    display: "flex",
    alignItems: "center"
  }}
>

{/* PARTY STRIP */}
<div
  style={{
    width: "3px",
    height: "16px",
    background: PARTY_COLORS[p.party] || "#888",
    marginRight: "8px",
    borderRadius: "2px"
  }}
/>

{/* PARTY */}
<div
  style={{
    width: "60px",
    fontWeight: "600",
    fontSize: "12px"
  }}
>
{p.party}
</div>

<div style={{ flex: 1 }} />

{/* SWING */}
<div
  style={{
    width: "60px",
    textAlign: "right",
    fontSize: "12px",
    color: "var(--text-muted)"
  }}
>
{p.voteChange > 0 ? "+" : ""}
{p.voteChange.toFixed(1)}
</div>

</div>

</div>

))}

</div>

</div>
)}

</>
  );
  
})()}

{/* COUNT NARRATION */}

{current?.name === "Overall" && view === "count" && (() => {

const counts = current?.data?.counts || {};

const currentCountData =
  counts[count] || [];

const prevCountData =
  counts[count - 1] || [];

/*
  Elections on this count
*/

const electedThisCount =
  currentCountData.filter((c: any) => {

    /*
      Count 1:
      already elected
    */

    if (count === 1) {
      return c.status === "elected";
    }

    /*
      Later counts:
      newly elected only
    */

    const prevCandidate = prevCountData.find(
      (p: any) =>
        p.name === c.name &&
        p.party === c.party
    );

    return (
      c.status === "elected" &&
      prevCandidate?.status !== "elected"
    );

});

/*
  Eliminations on this count
*/

const eliminatedThisCount =
  currentCountData.filter((c: any) => {

    if (count === 1) {
      return c.status === "eliminated";
    }

    const prevCandidate = prevCountData.find(
      (p: any) =>
        p.name === c.name &&
        p.party === c.party
    );

    return (
      c.status === "eliminated" &&
      prevCandidate?.status !== "eliminated"
    );

});

/*
  Synthetic Count 1 event
*/

const syntheticCountOneEvent =
  count === 1
    ? {
        description: [
          "First preference votes counted.",

          electedThisCount.length
            ? electedThisCount
                .map(
                  (c: any) =>
                    `${c.name} elected`
                )
                .join(", ") + "."
            : null,

          eliminatedThisCount.length
            ? eliminatedThisCount
                .map(
                  (c: any) =>
                    `${c.name} eliminated`
                )
                .join(", ") + "."
            : null

        ]
          .filter(Boolean)
          .join(" "),

        sources: [
          ...electedThisCount.map((c: any) => ({
            ...c,
            sourceType: "election"
          })),

          ...eliminatedThisCount.map((c: any) => ({
            ...c,
            sourceType: "elimination"
          }))
        ]
      }
    : countTimeline?.[count];

/*
  Final event object
*/

const event = syntheticCountOneEvent;

if (!event) return null;

/*
  Sources
*/

const sources = [
  ...(event.sources || []),

  ...((event.elected || []).map((c: any) => ({
    ...c,
    sourceType: "election"
  })))
];

/*
  Event chips
*/

const hasSurplus =
  sources.some(
    (s: any) => s.sourceType === "surplus"
  );

const hasElimination =
  sources.some(
    (s: any) => s.sourceType === "elimination"
  );

const hasRedistribution =
  sources.some(
    (s: any) =>
      s.sourceType === "elimination-redistribution"
  );

const hasElection =
  electedThisCount.length > 0;

/*
  Hide narration while awaiting results
*/

const totalVotesThisCount =
  currentCountData.reduce(
    (sum: number, c: any) =>
      sum + (c.votes || 0),
    0
  );

if (totalVotesThisCount === 0) {
  return null;
}

return (

<div
  style={{
    marginTop: "14px",
    marginBottom: "12px",
    padding: "10px 12px",
  }}
>

{/* HEADER */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
    gap: "10px",
    flexWrap: "wrap"
  }}
>

{/* LEFT */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }}
>

<div
  style={{
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "0.5px",
  }}
>
  On This Count
</div>

</div>

{/* EVENT CHIPS */}
<div
  style={{
    display: "flex",
    gap: "6px",
    flexWrap: "wrap"
  }}
>

{count === 1 && (
<div
  style={{
    padding: "3px 7px",
    borderRadius: "999px",
    background: "rgba(33,150,243,0.12)",
    border: "1px solid rgba(33,150,243,0.28)",
    fontSize: "10px",
    fontWeight: "700",
    color: "#2196f3",
    textTransform: "uppercase"
  }}
>
  First Preferences Received
</div>
)}

{hasElection && (
<div
  style={{
    padding: "3px 7px",
    borderRadius: "999px",
    background: "rgba(76,175,80,0.12)",
    border: "1px solid rgba(76,175,80,0.28)",
    fontSize: "10px",
    fontWeight: "700",
    color: "#4caf50",
    textTransform: "uppercase"
  }}
>
  Election
</div>
)}

{hasSurplus && (
<div
  style={{
    padding: "3px 7px",
    borderRadius: "999px",
        background: "rgba(255,193,7,0.12)",
    border: "1px solid rgba(255,193,7,0.28)",
    fontSize: "10px",
    fontWeight: "700",
    color: "#ffc107",
    textTransform: "uppercase"
  }}
>
  Surplus Distribution
</div>
)}

{hasElimination && (
<div
  style={{
    padding: "3px 7px",
    borderRadius: "999px",
    background: "rgba(244,67,54,0.12)",
    border: "1px solid rgba(244,67,54,0.28)",
    fontSize: "10px",
    fontWeight: "700",
    color: "#f44336",
    textTransform: "uppercase"
  }}
>
  Elimination
</div>
)}

{hasRedistribution && (
<div
  style={{
    padding: "3px 7px",
    borderRadius: "999px",
        background: "rgba(255,193,7,0.12)",
    border: "1px solid rgba(255,193,7,0.28)",
    fontSize: "10px",
    fontWeight: "700",
    color: "#ffc107",
    textTransform: "uppercase"
  }}
>
  Redistribution
</div>
)}

</div>

</div>

{/* DESCRIPTION */}
<div
  style={{
    fontSize: "13px",
    lineHeight: 1.5,
    fontWeight: "500",
    color: "var(--text)"
  }}
>
  {event.description}
</div>

{/* SOURCE ROW */}
{sources.length > 0 && (
<div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "10px"
  }}
>

{sources.map((source: any) => {

const sourceColor =
    source.sourceType === "election"
    ? "#4caf50"
  : source.sourceType === "surplus"
    ? "#ffc107"
    : source.sourceType === "elimination"
    ? "#f44336"
    : source.sourceType === "elimination-redistribution"
    ? "#ffc107"
    : "#777";

return (

<div
  key={`${source.name}-${source.sourceType}`}
  style={{
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 8px",
    borderRadius: "8px",
    background: `${sourceColor}14`,
    border: `1px solid ${sourceColor}22`
  }}
>

<div
  style={{
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: sourceColor
  }}
/>

<div
  style={{
    fontSize: "11px",
    fontWeight: "600"
  }}
>
  {source.name}
</div>

<div
  style={{
    fontSize: "10px",
    opacity: 0.65
  }}
>
  {source.party}
</div>

</div>

);

})}

</div>
)}

</div>

);

})()}

{/* COUNT PANEL */}

{view === "count" && (
<div>

{/* RESULT TABLE */}
<div style={{
  marginTop: "20px",
  padding: "15px",
  borderRadius: "12px",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  position: "relative",
maxHeight: window.innerWidth < 900
  ? "none"
  : "calc(100vh - 420px)",
overflowY: window.innerWidth < 900
  ? "visible"
  : "auto"
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
  color: "var(--text-muted)"
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
width:
  typeof window !== "undefined" &&
  window.innerWidth < 900
    ? "calc(100% - 300px)"
    : "calc(100% - 420px)",
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
  (sum: number, c: any) => sum + (c.votes || 0),
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
running.sort((a: any, b: any) => b.votes - a.votes);

// 👇 determine elimination order
const counts = current.data.counts;

const eliminatedWithOrder = eliminated.map((c: any) => {
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

const maxVotes = Math.max(
  ...orderedCandidates.map(c => c.votes)
);

const scaledPercent =
  current?.name === "Overall"
    ? quotaPercent
      ? (percent / quotaPercent) * 70
      : 0
    : maxVotes
    ? (c.votes / maxVotes) * 70
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
  <div style={{ margin: "12px 0 8px 0" }}>
  <div
  style={{
  borderTop: "2px dotted var(--border)",
  marginBottom: "6px"
  }}
  />
  
  <div
  style={{
  fontSize: "10px",
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
  padding: "6px 10px",
  marginBottom: "4px",
  borderRadius: "6px",
  color: "var(--text)",
  position: "relative",
  overflow: "hidden",
  background: "var(--panel-2)",
  transition: "background 0.15s ease"
  }}
  onMouseEnter={(e) => {
  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
  }}
  onMouseLeave={(e) => {
  e.currentTarget.style.background = "var(--panel-2)";
  }}
  >
  
  {/* FULL ROW VOTE BACKGROUND */}
  <div
  style={{
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: `${scaledPercent}%`,
  background: PARTY_COLORS[c.party] || "#888",
  opacity: c.status === "elected" ? 0.35 : 0.22,
  zIndex: 1
  }}
  />
  
  {/* SURPLUS */}
  {showSurplus && (
  <div
  style={{
  position: "absolute",
  left: `${scaledQuotaPercent}%`,
  top: 0,
  bottom: 0,
  width: `${Math.max(0, scaledPercent - scaledQuotaPercent)}%`,
  background:
  "repeating-linear-gradient(45deg, rgba(255,255,255,0.35), rgba(255,255,255,0.35) 4px, transparent 4px, transparent 8px)",
  zIndex: 2
  }}
  />
  )}
  
  {/* ELIMINATED */}
  {justEliminated && (
  <div
  style={{
  position: "absolute",
  inset: 0,
  background:
  "repeating-linear-gradient(45deg, rgba(255,82,82,0.25), rgba(255,82,82,0.25) 6px, transparent 6px, transparent 12px)",
  zIndex: 2
  }}
  />
  )}
  
  {/* QUOTA LINE */}
{!selected && (
<div
style={{
position: "absolute",
left: `${scaledQuotaPercent}%`,
top: 0,
bottom: 0,
width: "0px",
borderLeft: "2px dotted var(--quota-line)",
pointerEvents: "none",
zIndex: 6
}}
/>
)}
  
  {/* FLASH */}
  {highlighted === c.id && (
  <div
  style={{
  position: "absolute",
  top: 0,
  left: "-100%",
  width: "100%",
  height: "100%",
  background:
  "linear-gradient(90deg, transparent, rgba(0, 223, 239, 0.28), transparent)",
  animation: "flashSweep 1s ease-out",
  zIndex: 8
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
fontSize:
  typeof window !== "undefined" &&
  window.innerWidth < 900
    ? "14px"
    : "25px",
  fontWeight: "700",
  fontStyle: "italic",
  color: "rgba(255,255,255,0.81)",
  backdropFilter: "blur(3px)",
  animation: "fadeOverlay 1s ease-in-out forwards",
  zIndex: 9,
  pointerEvents: "none",
letterSpacing:
  typeof window !== "undefined" &&
  window.innerWidth < 900
    ? "0.5px"
    : "2px",
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
  background: "var(--elected-strip)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 7
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
  stroke="var(--elected-check)"
  strokeWidth="2.8"
  />
  </svg>
  </div>
  )}
  
  {/* Spacer */}
  <div style={{ width: "26px", flexShrink: 0 }} />
  
  {/* PARTY STRIP */}
  <div
  style={{
  width: "3px",
  alignSelf: "stretch",
  background: PARTY_COLORS[c.party] || "#888",
  marginRight: "8px",
  borderRadius: "2px",
  zIndex: 7
  }}
  />
  
{/* IMAGE / AVATAR */}
<div
  style={{
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: PARTY_COLORS[c.party] || "#444",
    border: "1px solid var(--border)",
    marginRight: "8px",
    flexShrink: 0,
    overflow: "hidden",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }}
>

<img
  src={getCandidateImage(c.name)}
  alt={c.name}
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover"
  }}
  onError={(e) => {
    const img = e.currentTarget;
    img.style.display = "none";

    const fallback = img.nextSibling as HTMLElement;
    if (fallback) fallback.style.display = "block";
  }}
/>

{/* FALLBACK SVG */}
<svg
  viewBox="0 0 24 24"
  preserveAspectRatio="xMidYMid slice"
  style={{
    display: "none",
    position: "absolute",
    width: "110%",
    height: "110%",
    opacity: 0.35
  }}
  fill="white"
>
  <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/>
</svg>

</div>
  
  {/* NAME */}
  <div
  style={{
  flex: 1,
  minWidth: 0,
  zIndex: 7
  }}
  >
  
  <div
  style={{
  display: "flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0
  }}
  >
  
  {/* CANDIDATE NAME */}
  <div
  style={{
  fontWeight: "600",
  fontSize: "13px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
  }}
  >
  {c.name}
  </div>
  
  {/* INCUMBENT */}
  {c.incumbent && (
  <div
  style={{
  fontSize: "10px",
  opacity: 0.85,
  whiteSpace: "nowrap"
  }}
  >
  ★
  </div>
  )}
  
  </div>
  
  {/* PARTY */}
  <div
  style={{
  fontSize: "11px",
  color: "var(--text-subtle)"
  }}
  >
  {c.party}
  </div>
  
  </div>
  
  {/* PERCENT (FIRST COUNT ONLY) */}
  {count === 1 && (
  <div
  style={{
  width:
  typeof window !== "undefined" &&
  window.innerWidth < 900
    ? "42px"
    : "60px",
  textAlign: "right",
  fontSize: "12px",
  opacity: 0.8,
  zIndex: 7
  }}
  >
  {percent.toFixed(1)}%
  </div>
  )}
  
  {/* VOTES */}
  <div
  style={{
width:
  typeof window !== "undefined" &&
  window.innerWidth < 900
    ? "64px"
    : "90px",
  textAlign: "right",
  fontSize: "13px",
  fontWeight: "500",
  zIndex: 7
  }}
  >
  <AnimatedNumber
  value={c.votes}
  previousValue={
  prevData.find(
  (p: any) =>
  p.name === c.name &&
  p.party === c.party
  )?.votes || 0
  }
  />
  </div>
  
  {/* GAIN */}
  {count > 1 && (
  <div
  style={{
width:
  typeof window !== "undefined" &&
  window.innerWidth < 900
    ? "46px"
    : "60px",
  textAlign: "right",
  fontSize: "11px",
  fontWeight: isTopGainer ? "700" : "500",
  color:
  gain > 0 ? "#4caf50" :
  gain < 0 ? "#f44336" :
  "#aaa",
  zIndex: 7
  }}
  >
  {gain > 0 ? "↑ " : gain < 0 ? "↓ " : "→ "}
  {gain > 0 ? `+${gain}` : gain}
  </div>
  )}
  
  </div>
  
  </Fragment>
);
});
})()}
</div>
</div>
</div>
)}

</div>

{/* END OF LEFT PANEL */}

{/* RIGHT MAP */}
<div
  className="election-map-panel"
  style={{
    position: "relative",
    background: "var(--panel)",
    overflow: "hidden",
    touchAction: "pan-y",
  }}
>

{/* MAP TOGGLE */}
{!selected && (
<div
  style={{
    position: "absolute",
    top: "10px",
    right: "10px",
    zIndex: 1000
  }}
>
<MapViewToggle
  value={mapView}
  onChange={setMapView}
  options={[
    { label: "Winner", value: "winner" },
    { label: "Margin", value: "margin" },
    { label: "Turnout", value: "turnout" },
    { label: "Spoilt", value: "spoilt" }
  ]}
/>
</div>

)}
<Map
key="election_map"
  election={{
    country,
    type,
    year,
    slug
  }}
  selected={selected}
  onLoadOfficialResults={setOfficialResults}
  view={mapView}
 onSelect={(item: any) => {
  setSelected(item);

  // RESET → go back to /40th
  if (!item) {
    router.replace(window.location.pathname, { scroll: false });
    return;
  }

  // SELECT → update URL
  const slug = normalizeSlug(
    item.slug || item.name || item.id
  );

  router.replace(`?c=${slug}`, { scroll: false });
}}
  onLoadTotal={setTotal}
  onLoadList={setList}
  onLoadResults={setResults}
  resetTrigger={resetTrigger}
  results={results}
  count={count}
  onLoadPreviousResults={setPreviousResults}
  onLoadProjection={setProjection}
/>
      </div>
      </div>

<style jsx global>{`

@media (max-width: 900px) {

  .election-map-panel {
    touch-action: pan-y !important;
  }

  .election-map-panel canvas {
    touch-action: pan-y !important;
  }

  .view-header {
    flex-direction: column !important;
    align-items: flex-start !important;
  }

  .count-controls {
    width: fit-content;
    margin-left: 0 !important;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

}

`}</style>

      </div>
  );
}