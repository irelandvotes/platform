"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import { buildPollingAverage } from "../../lib/pollingAggregate";

import {
ResponsiveContainer,
ComposedChart,
Line,
YAxis
} from "recharts";


/* ===============================
   POLLING PAGES
=============================== */

const pollingPages = [
{
label: "Dáil Éireann",
href: "/polling/ireland/dail",
tracker: "dail"
},
{
label: "NI Assembly",
href: "/polling/northern-ireland/assembly",
tracker: "ni"
}
];

export default function ElectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {

const pathname = usePathname();

const [showMenu, setShowMenu] = useState(false);
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const check = () => setIsMobile(window.innerWidth < 900);
  check();
  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}, []);

const SidebarContent = (
  <>
    <div
      style={{
        fontSize: "16px",
        fontWeight: "700",
        marginBottom: "12px",
        opacity: 0.9,
        marginLeft: "5px"
      }}
    >
      Featured
    </div>

    {pollingPages.map((poll) => (
      <PollLink
        key={poll.href}
        href={poll.href}
        label={poll.label}
        tracker={poll.tracker}
        pathname={pathname}
      />
    ))}
  </>
);

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
    {showMenu && (
      <div
        onClick={() => setShowMenu(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 50
        }}
      />
    )}

    {/* DRAWER */}
    <div
      style={{
        position: "fixed",
        top: 0,
        left: showMenu ? 0 : "-280px",
        height: "100%",
        width: "260px",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
        backdropFilter: "blur(14px)",
        padding: "14px 12px",
        overflowY: "auto",
        overflowX: "hidden",
        zIndex: 60,
        transition: "left 0.25s ease",
        boxShadow:
          "0 0 40px rgba(0,0,0,0.45)"
      }}
    >

{/* LARGE GLOW */}
<div
  style={{
    position: "absolute",
    top: "-220px",
    right: "-140px",
    width: "680px",
    height: "680px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(0,223,239,0.12), transparent 72%)",
    pointerEvents: "none",
    zIndex: 0
  }}
/>

<div
style={{
position: "relative",
zIndex: 1
}}
>

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px"
        }}
      >
        <div
style={{
fontWeight: 700,
fontSize: "15px"
}}
>
Polling
</div>

<button
  onClick={() => setShowMenu(false)}
  style={{
    border: "none",
    background: "transparent",
    color: "var(--text)",
    fontSize: "16px",
    cursor: "pointer"
  }}
>
✕
</button>

      </div>

      {SidebarContent}

</div>

    </div>
  </>
) : (
  /* DESKTOP SIDEBAR */
<div
  style={{
    width: "260px",
    borderRight: "1px solid rgba(255,255,255,0.05)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
    backdropFilter: "blur(12px)",
    padding: "14px 12px",
    overflowY: "auto",
    overflowX: "hidden",
    position: "relative",
    boxShadow:
      "inset -1px 0 rgba(255,255,255,0.03)"
  }}
>

{/* LARGE GLOW */}
<div
  style={{
    position: "absolute",
    top: "-220px",
    right: "-140px",
    width: "680px",
    height: "680px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(0,223,239,0.12), transparent 72%)",
    pointerEvents: "none",
    zIndex: 0
  }}
/>

<div
  style={{
    position: "relative",
    zIndex: 1
  }}
>
  {SidebarContent}
</div>

</div>
)}


{/* MAIN CONTENT */}

<div
  style={{
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column"
  }}
>

  {/* MOBILE HEADER */}
  {isMobile && (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--panel)",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}
    >
      <div style={{ fontWeight: 600 }}>
        Ireland Votes Polling Aggregates
      </div>

      <button
        onClick={() => setShowMenu(true)}
        style={{
          padding: "6px 10px",
          fontSize: "12px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "var(--panel-2)",
          cursor: "pointer"
        }}
      >
        ☰ Browse all polling
      </button>
    </div>
  )}

  {children}
</div>

</div>

);

}

/* ===============================
   POLL LINK
=============================== */

 function PollLink({
  href,
  label,
  pathname,
  tracker
}: {
  href: string;
  label: string;
  pathname: string;
   tracker: string;
}) {

const active = pathname.startsWith(href);

const [data, setData] = useState<any[]>([]);

useEffect(() => {

const path =
tracker === "ni"
? "/data/polling/northern-ireland/assembly/polls.csv"
: "/data/polling/ireland/dail/polls.csv";

fetch(path)
.then(res => res.text())
.then(text => {

const result = Papa.parse(text, {
header: true,
dynamicTyping: true,
skipEmptyLines: true
});

const parsed = (result.data as any[])
.filter(p => p.date)
.map(p => ({
...p,
date: new Date(p.date)
}))
.sort((a,b)=>a.date-b.date);

const aggregated =
buildPollingAverage(parsed, tracker);

const filtered =
tracker === "ni"
? aggregated
: aggregated.filter(
d => d.date >= new Date("2024-11-29")
);

setData(filtered);

});

}, [tracker]);

return (

<Link
href={href}
style={{
display: "block",
position: "relative",
padding: "11px 12px 10px 14px",
borderRadius: "12px",
marginBottom: "8px",
background: active
  ? "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))"
  : "rgba(255,255,255,0.015)",
border: active
  ? "1px solid rgba(255,255,255,0.08)"
  : "1px solid transparent",
overflow: "hidden",
transition: "all 0.16s ease",
transform: active
  ? "translateX(2px)"
  : "translateX(0)"
}}
onMouseEnter={(e) => {

if (active) return;

e.currentTarget.style.background =
  "rgba(255,255,255,0.035)";

e.currentTarget.style.border =
  "1px solid rgba(255,255,255,0.05)";

}}
onMouseLeave={(e) => {

if (active) return;

e.currentTarget.style.background =
  "rgba(255,255,255,0.015)";

e.currentTarget.style.border =
  "1px solid transparent";

}}
>

{/* ACTIVE STRIP */}
{active && (
<div
style={{
position: "absolute",
left: 0,
top: 0,
bottom: 0,
width: "3px",
background:
  "linear-gradient(180deg, #00dfef, #80deea)"
}}
/>
)}

<div
style={{
display: "flex",
alignItems: "center",
justifyContent: "space-between",
marginBottom: "6px"
}}
>

<div
style={{
fontSize: "13px",
fontWeight: active ? "700" : "550",
letterSpacing: "-0.1px",
color: "var(--text)"
}}
>
{label}
</div>

{active && (
<div
style={{
fontSize: "9px",
fontWeight: "800",
letterSpacing: "0.7px",
textTransform: "uppercase",
color: "#80deea"
}}
>
VIEWING
</div>
)}

</div>

<SidebarPreview data={data} tracker={tracker}/>

</Link>

);

}

/* ===============================
   PARTY COLOURS
=============================== */

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
IND: "#9e9e9e",

SDLP: "#1a5c1d",
PBP: "#da1498",

DUP: "#dd5454",
UUP: "#3676c0",
TUV: "#061730",

AP: "#fdd835",

};

/* ===============================
   SIDEBAR PREVIEW
=============================== */

function SidebarPreview({ data, tracker }: { data?: any[]; tracker?: string }) {

if (!data || !data.length) return null;

const latest =
data.length
? data[data.length - 1]
: null;

const parties =
tracker === "ni"
? [
"SF",
"SDLP",
"AON",
"PBP",
"DUP",
"UUP",
"TUV",
"AP",
"GP",
"IND"
]
: [
"FF",
"FG",
"SF",
"SD",
"LAB",
"GP",
"AON",
"INDIRL",
"PBPS",
"IND"
];

const sorted = parties
.map(p => ({
party: p,
value: latest[p]
}))
.filter(p => p.value !== null)
.sort((a,b) => b.value - a.value);

const leader = sorted[0];
const second = sorted[1];

const margin =
leader && second
? (leader.value - second.value).toFixed(1)
: null;

const topThree = sorted
.slice(0,3)
.map(p => p.party);


/* LAST UPDATED */

const lastUpdated = new Date(
latest.date
).toLocaleDateString("en-IE", {
day: "2-digit",
month: "short"
});

const values = data.flatMap(d =>
topThree.map(p => d[p]).filter(v => v !== null)
);

const min = Math.min(...values);
const max = Math.max(...values);

const padding = 1;

const yMin = Math.max(0, min - padding);
const yMax = max + padding;

return (

<div>

{/* LEADER */}

<div
style={{
display: "inline-flex",
alignItems: "center",
gap: "4px",
padding: "2px 6px",
borderRadius: "6px",
background: `${PARTY_COLORS[leader?.party]}22`,
border: `1px solid ${PARTY_COLORS[leader?.party]}`,
fontSize: "11px",
fontWeight: "600",
marginBottom: "4px"
}}
>
<span>
{leader?.party}
</span>

<span>
+{margin}
</span>

</div>


{/* MINI CHART */}

<div
style={{
height: "38px",
width: "100%",
marginBottom: "4px"
}}
>

<ResponsiveContainer width="100%" height="100%">

<ComposedChart data={data}>

<YAxis
domain={[yMin, yMax]}
hide
/>

{topThree.map((party) => (

<Line
key={party}
type="monotone"
dataKey={party}
stroke={PARTY_COLORS[party]}
strokeWidth={1.5}
dot={false}
isAnimationActive={false}
/>

))}

</ComposedChart>

</ResponsiveContainer>

</div>


{/* LAST UPDATED */}

<div
style={{
fontSize: "9px",
opacity: 0.5,
textAlign: "right"
}}
>
Updated {lastUpdated}
</div>

</div>

);

}