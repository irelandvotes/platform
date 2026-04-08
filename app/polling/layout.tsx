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
borderRight: "1px solid #333",
background: "#1a1a1a",
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

</div>


{/* MAIN CONTENT */}

<div
style={{
flex: 1,
overflow: "auto"
}}
>

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

const [data, setData] = useState([]);

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

const parsed = result.data
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
padding: "10px",
borderRadius: "8px",
marginBottom: "8px",
background: active ? "#2a2a2a" : "#1f1f1f",
border: "1px solid #333",
fontSize: "13px",
fontWeight: active ? "600" : "500",
cursor: "pointer",
transition: "0.15s",
position: "relative"
}}
>

<div
style={{
marginBottom: "4px"
}}
>
{label}
</div>

<SidebarPreview data={data} tracker={tracker}/>

</Link>

);

}

/* ===============================
   PARTY COLOURS
=============================== */

const PARTY_COLORS = {
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

function SidebarPreview({ data, tracker }) {

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