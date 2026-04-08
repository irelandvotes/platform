"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";

import {
ComposedChart,
Line,
Area,
ResponsiveContainer,
XAxis,
YAxis,
Tooltip,
CartesianGrid,
ReferenceLine
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
INDIRL: "#9be736",
IND: "#7a7a7a",

SDLP: "#1a5c1d",
PBP: "#da1498",

DUP: "#dd5454",
UUP: "#3676c0",
TUV: "#061730",

AP: "#fdd835",

};


export default function PollPage({ country, election, tracker = "dail" }) {

const [polls, setPolls] = useState([]);
const [range, setRange] = useState("all");
const defaultVisible =
tracker === "ni"
? {
SF: true,
SDLP: true,
AON: true,
PBP: true,
DUP: true,
UUP: true,
TUV: true,
AP: true,
GP: true,
IND: true
}
: {
FF: true,
FG: true,
SF: true,
SD: true,
LAB: true,
GP: true,
AON: true,
INDIRL: true,
PBPS: true,
IND: true
};

const [visible, setVisible] = useState(defaultVisible);
const [hovered, setHovered] = useState(null);
const [showConfidence, setShowConfidence] = useState(false);
const [showAllPolls, setShowAllPolls] = useState(false);

/* ===============================
   LOAD CSV
=============================== */

useEffect(() => {

fetch(`/data/polling/${country}/${election}/polls.csv`)
.then((res) => res.text())
.then((text) => {

const result = Papa.parse(text, {
header: true,
dynamicTyping: true,
skipEmptyLines: true
});

const cleaned = result.data
.filter(p => p.date)
.map(p => {

const parsed = {
...p,
date: new Date(p.date)
};

Object.keys(parsed).forEach(key => {

if (key !== "date" && key !== "pollster") {

const value = parsed[key];

parsed[key] =
value === "" || value === null || value === undefined
? null
: Number(value);

}

});

return parsed;

})
.filter(p => !isNaN(p.date));

setPolls(cleaned);

});

}, [country, election, tracker]);


/* ===============================
   SORT POLLS
=============================== */

const sortedPolls = [...polls].sort(
(a, b) => a.date - b.date
);


/* ===============================
   WEIGHTED ROLLING AVERAGE
=============================== */

const rollingAverage = (() => {

if (!sortedPolls.length) return [];

const halfLife = 30; // days

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

const data = [];

for (let i = 0; i < sortedPolls.length; i++) {

const currentDate = sortedPolls[i].date;

const slice = sortedPolls.slice(
Math.max(0, i - 30),
i + 1
);

const avg = {
date: currentDate
};

parties.forEach((party) => {

let weightedSum = 0;
let weightTotal = 0;
const weightedValues = [];

slice.forEach(p => {

const days =
(currentDate - p.date) / (1000 * 60 * 60 * 24);

const weight = Math.exp(-days / halfLife);

if (typeof p[party] === "number") {

weightedSum += p[party] * weight;
weightTotal += weight;

weightedValues.push({
value: p[party],
weight
});

}

});

if (weightTotal > 0) {

const mean = weightedSum / weightTotal;

// Weighted variance
const variance =
weightedValues.reduce(
(sum, v) =>
sum +
v.weight *
Math.pow(v.value - mean, 2),
0
) / weightTotal;

const sd = Math.sqrt(variance);

avg[party] = mean;

const upper = mean + sd;
const lower = mean - sd;

avg[`${party}_upper`] = upper;
avg[`${party}_lower`] = lower;
avg[`${party}_range`] = upper - lower;

} else {

avg[party] = null;

avg[`${party}_upper`] = null;
avg[`${party}_lower`] = null;

}

});

data.push(avg);

}

return data;

})();

/* ===============================
   TREND SMOOTHING
=============================== */

const smoothedAverage = (() => {

if (!rollingAverage.length) return [];

const window = 7; // smoothing strength

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

return rollingAverage.map((row, i) => {

const slice = rollingAverage.slice(
Math.max(0, i - window),
Math.min(rollingAverage.length, i + window)
);

const smoothed = {
date: row.date
};

parties.forEach(party => {

const values = slice
.map(r => r[party])
.filter(v => typeof v === "number");

smoothed[party] = values.length
? values.reduce((a,b) => a+b, 0) / values.length
: null;

// Smooth confidence bands too

const upperValues = slice
.map(r => r[`${party}_upper`])
.filter(v => typeof v === "number");

const lowerValues = slice
.map(r => r[`${party}_lower`])
.filter(v => typeof v === "number");

smoothed[`${party}_upper`] =
upperValues.length
? upperValues.reduce((a,b)=>a+b,0)/upperValues.length
: null;

smoothed[`${party}_lower`] =
lowerValues.length
? lowerValues.reduce((a,b)=>a+b,0)/lowerValues.length
: null;

if (
smoothed[`${party}_upper`] !== null &&
smoothed[`${party}_lower`] !== null
) {

smoothed[`${party}_range`] =
smoothed[`${party}_upper`] -
smoothed[`${party}_lower`];

} else {

smoothed[`${party}_range`] = null;

}

});

return smoothed;

});

})();

/* ===============================
   RANGE FILTER
=============================== */

const getCutoff = () => {

const now = new Date();

if (range === "1y") {
const d = new Date();
d.setFullYear(now.getFullYear() - 1);
return d;
}

if (range === "5y") {
const d = new Date();
d.setFullYear(now.getFullYear() - 5);
return d;
}

if (range === "10y") {
const d = new Date();
d.setFullYear(now.getFullYear() - 10);
return d;
}

if (range === "since-election") {
return new Date("2024-11-29");
}

return null;

};

const cutoff = getCutoff();


const filteredData = cutoff
? smoothedAverage.filter(d => new Date(d.date) > cutoff)
: smoothedAverage;

const filteredPolls = cutoff
? sortedPolls.filter(d => d.date > cutoff)
: sortedPolls;

/* ===============================
   COALITION CONFIG
=============================== */

const coalitionStart = new Date("2024-11-29");

const coalitionParties = ["FF", "FG"];

const oppositionParties = [
"SF",
"SD",
"LAB",
"AON",
"PBPS",
"GP",
"INDIRL"
];

/* ===============================
   NI BLOC CONFIG
=============================== */

const nationalistParties = [
"SF",
"SDLP",
"AON",
"PBP"
];

const unionistParties = [
"DUP",
"UUP",
"TUV"
];

const nonAlignedParties = [
"AP",
"GP",
"IND"
];

/* ===============================
   COALITION DATA
=============================== */

const coalitionData = filteredData
.filter(row => new Date(row.date) >= coalitionStart)
.map(row => {

const Coalition = coalitionParties.reduce(
(sum, party) => sum + (row[party] || 0),
0
);

const Opposition = oppositionParties.reduce(
(sum, party) => sum + (row[party] || 0),
0
);

const Independents = row["IND"] || 0;

return {
date: new Date(row.date).getTime(),
Coalition,
Opposition,
Independents
};

});

/* ===============================
   NI BLOC DATA
=============================== */

const blocData = filteredData.map(row => {

const nationalist = nationalistParties.reduce(
(sum, party) => sum + (row[party] || 0),
0
);

const unionist = unionistParties.reduce(
(sum, party) => sum + (row[party] || 0),
0
);

const nonAligned = nonAlignedParties.reduce(
(sum, party) => sum + (row[party] || 0),
0
);

return {
date: new Date(row.date).getTime(),
nationalist,
unionist,
nonAligned
};

});

/* ===============================
   COALITION DATE RANGE
=============================== */

const coalitionStartDate = coalitionData.length
? coalitionData[0].date
: null;

const coalitionEndDate = coalitionData.length
? coalitionData[coalitionData.length - 1].date
: null;


const coalitionTicks = (() => {

if (!coalitionStartDate || !coalitionEndDate) return [];

const start = new Date(coalitionStartDate);
const end = new Date(coalitionEndDate);

const ticks = [];

const d = new Date(start);
d.setMonth(d.getMonth() < 6 ? 0 : 6);
d.setDate(1);

while (d <= end) {

ticks.push(new Date(d).getTime());

d.setMonth(d.getMonth() + 6);

}

return ticks;

})();

/* ===============================
   COMBINED CHART DATA
=============================== */

const chartData = filteredData.map(row => {

const poll = filteredPolls.find(
p => p.date.getTime() === new Date(row.date).getTime()
);

return {
...row,

FF_poll: poll?.FF ?? null,
FG_poll: poll?.FG ?? null,
SF_poll: poll?.SF ?? null,
LAB_poll: poll?.LAB ?? null,
SD_poll: poll?.SD ?? null,
GP_poll: poll?.GP ?? null,
PBPS_poll: poll?.PBPS ?? null,
AON_poll: poll?.AON ?? null,
INDIRL_poll: poll?.INDIRL ?? null,
IND_poll: poll?.IND ?? null

};

});

const xTicks = (() => {

if (!filteredData.length) return [];

const start = new Date(filteredData[0].date);
const end = new Date(filteredData[filteredData.length - 1].date);

const ticks = [];

const d = new Date(start);
d.setMonth(d.getMonth() < 6 ? 0 : 6);
d.setDate(1);

while (d <= end) {

ticks.push(new Date(d).getTime());

d.setMonth(d.getMonth() + 6);

}

return ticks;

})();

/* ===============================
   ELECTION MARKERS
=============================== */

const elections =
tracker === "ni"
? [
{ date: "2007-03-07", label: "2007 Election" },
{ date: "2011-05-05", label: "2011 Election" },
{ date: "2016-05-05", label: "2016 Election" },
{ date: "2017-03-02", label: "2017 Election" },
{ date: "2022-05-05", label: "2022 Election" }
]
: [
{ date: "2007-05-24", label: "2007 Election" },
{ date: "2011-02-25", label: "2011 Election" },
{ date: "2016-02-26", label: "2016 Election" },
{ date: "2020-02-08", label: "2020 Election" },
{ date: "2024-11-29", label: "2024 Election" }
];

const PollTooltip = ({ active, payload, label, visible }) => {

if (!active || !payload || !payload.length) return null;

/* Rolling average parties */
const rollingParties =
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

/* Filter rolling averages only */
const rolling = payload.filter(
p => rollingParties.includes(p.dataKey)
);

const allVisible = Object.values(visible || {}).every(v => v === true);

const combined = rolling
.filter(entry => visible?.[entry.dataKey])
.reduce((sum, entry) => sum + (entry.value || 0), 0);

/* Sort highest → lowest */
rolling.sort((a, b) => b.value - a.value);

return (

<div
style={{
background: "#1f1f1f",
border: "1px solid #333",
borderRadius: "8px",
padding: "10px",
fontSize: "12px",
minWidth: "120px",
opacity: 0.95
}}
>

{/* DATE */}
<div
style={{
fontWeight: 600,
marginBottom: "6px"
}}
>
{new Date(label).toLocaleDateString("en-IE", {
day: "2-digit",
month: "long",
year: "numeric"
})}
</div>

{/* PARTY VALUES */}
{rolling.map((entry) => (

<div
key={entry.dataKey}
style={{
display: "flex",
justifyContent: "space-between",
marginBottom: "2px"
}}
>

<span
style={{
color: entry.color,
fontWeight: 600
}}
>
{entry.dataKey}
</span>

<span>
{entry.value?.toFixed(1)}%
</span>

</div>

))}

{!allVisible && rolling.length > 1 && (

<div
style={{
marginTop: "6px",
paddingTop: "6px",
borderTop: "1px solid #333",
display: "flex",
justifyContent: "space-between",
fontWeight: 600
}}
>

<span>Combined</span>

<span>
{combined.toFixed(1)}%
</span>

</div>

)}

</div>

);

};

/* ===============================
   RAW POLL CHART DATA
=============================== */

const chartPolls = filteredPolls.map(p => ({
...p,
date: p.timestamp
}));


/* ===============================
   TABLE DATA
=============================== */

const dailParties = ["FF","FG","SF","SD","LAB","PBPS","GP","AON","INDIRL","IND"];
const niParties = ["DUP","UUP","TUV","SF","SDLP","AON","PBP","GP","AP","IND"];

const tableData = [...polls]
.filter(p => {

const parties =
tracker === "ni"
? niParties
: dailParties;

return parties.some(party => p[party] !== undefined);

})
.sort((a,b) => b.date - a.date);

/* ===============================
   PARTY TOGGLE ORDER
=============================== */

const toggleOrder =
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

/* ===============================
   TABLE PARTIES
=============================== */

const tableParties =
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

/* ===============================
   LATEST AGGREGATE
=============================== */

const latest = chartData.length
? chartData[chartData.length - 1]
: null;

const previous = chartData.length > 1
? chartData[chartData.length - 2]
: null;

const latestPoll = sortedPolls.length
? sortedPolls[sortedPolls.length - 1]
: null;

const latestParties = latest
? Object.keys(PARTY_COLORS)
.map(party => ({
party,
value: latest[party],
previous: previous?.[party],
lower: latest[`${party}_lower`],
upper: latest[`${party}_upper`]
}))
.filter(p => p.value !== null && p.value !== undefined)
.sort((a, b) => b.value - a.value)
: [];

/* ===============================
   DYNAMIC Y AXIS
=============================== */

const visibleParties = Object.keys(visible).filter(
(p) => visible[p]
);

const visibleValues = chartData.flatMap((row) =>
visibleParties
.map((party) => row[party])
.filter((v) => v !== null && v !== undefined)
);

const maxY = visibleValues.length
? Math.ceil(Math.max(...visibleValues) / 5) * 5
: 40;

const minY = visibleValues.length
? Math.floor(Math.min(...visibleValues) / 5) * 5
: 0;

/* ===============================
   HEATMAP HELPERS
=============================== */

const getHeatColor = (value) => {

if (value === null || value === undefined) return "transparent";

// stronger contrast
const intensity = Math.min(value / 30, 1);

// greyscale 30–80
const shade = Math.floor(40 + intensity * 120);

return `rgba(${shade}, ${shade}, ${shade}, 0.35)`;

};


/* ===============================
   LEADER HELPER
=============================== */

const getLeader = (poll) => {

const parties = Object.keys(PARTY_COLORS)
.filter(p => p !== "IND"); // Exclude IND


const sorted = parties
.map(p => ({
party: p,
value: poll[p]
}))
.filter(p => p.value !== null && p.value !== undefined)
.sort((a,b) => b.value - a.value);

if (sorted.length < 2) return null;

const leader = sorted[0];
const second = sorted[1];

if (leader.value === second.value) {
return {
text: "Tie",
party: null
};
}

return {
text: `${leader.party} +${Math.round(leader.value - second.value)}`,
party: leader.party
};

};

const formatDate = (date) => {

return new Date(date).toLocaleDateString("en-IE", {
day: "2-digit",
month: "long",
year: "numeric"
});

};

/* ===============================
   COALITION TOOLTIP
=============================== */

const CoalitionTooltip = ({ active, payload, label }) => {

if (!active || !payload || !payload.length) return null;

const sorted = [...payload].sort(
(a, b) => b.value - a.value
);

return (

<div
style={{
background: "#1f1f1f",
border: "1px solid #333",
borderRadius: "8px",
padding: "8px 10px",
fontSize: "12px",
opacity: 0.95
}}
>

<div
style={{
fontWeight: 600,
marginBottom: "6px"
}}
>
{new Date(label).toLocaleDateString("en-IE", {
day: "2-digit",
month: "long",
year: "numeric"
})}
</div>

{sorted.map(entry => (

<div
key={entry.name}
style={{
display: "flex",
justifyContent: "space-between",
marginBottom: "2px"
}}
>

<span
style={{
color: entry.color,
fontWeight: 600
}}
>
{entry.name}
</span>

<span>
{entry.value?.toFixed(1)}%
</span>

</div>

))}

</div>

);

};

return (

<div
style={{
width: "100%",
height: "100%",
display: "flex",
flexDirection: "column",
overflow: "hidden",
background: "#171717"
}}
>

<div
style={{
flex: 1,
overflow: "auto",
padding: "20px"
}}
>


{/* HEADER */}

<h1
style={{
fontSize: "26px",
fontWeight: "700",
marginBottom: "6px"
}}
>
{tracker === "ni"
? "NI Assembly Polling"
: "Dáil Éireann Polling"}
</h1>

<div
style={{
fontSize: "13px",
opacity: 0.6,
marginBottom: "20px"
}}
>
Since 2007 — {polls.length} polls available
</div>



{/* CHART CONTROLS */}

<div
style={{
background: "#1a1a1a",
border: "1px solid #333",
borderRadius: "10px",
padding: "12px 14px",
marginBottom: "14px"
}}
>

<div
style={{
display: "grid",
gridTemplateColumns: "auto 1fr auto",
gap: "14px",
alignItems: "start"
}}
>

{/* TIME RANGE */}

<div>

<div
style={{
fontSize: "10px",
opacity: 0.6,
marginBottom: "4px",
textTransform: "uppercase",
letterSpacing: "0.04em"
}}
>
Time Range
</div>

<div
style={{
display: "flex",
gap: "4px",
flexWrap: "wrap"
}}
>

{[
{label: "All", value: "all"},
{label: "1Y", value: "1y"},
{label: "5Y", value: "5y"},
{label: "10Y", value: "10y"},
{label: "Since Last Election", value: "since-election"}
].map(btn => (

<button
key={btn.value}
onClick={() => setRange(btn.value)}
style={{
padding: "3px 8px",
borderRadius: "6px",
border: "1px solid #333",
background: range === btn.value ? "#444" : "transparent",
color: "#fff",
fontSize: "11px",
cursor: "pointer"
}}
>
{btn.label}
</button>

))}

</div>

</div>

{/* PARTIES */}

<div>

<div
style={{
fontSize: "10px",
opacity: 0.6,
marginBottom: "4px",
textTransform: "uppercase",
letterSpacing: "0.04em"
}}
>
Toggle Parties
</div>

<div
style={{
display: "flex",
gap: "4px",
flexWrap: "wrap"
}}
>

{toggleOrder.map((party) => (

<button
key={party}
onClick={() =>
setVisible({
...visible,
[party]: !visible[party]
})
}
style={{
padding: "3px 7px",
borderRadius: "6px",
border: "1px solid #333",
background: visible[party] ? "#2a2a2a" : "transparent",
color: visible[party] ? "#fff" : "#666",
fontSize: "10px",
cursor: "pointer"
}}
>
{party}
</button>

))}

</div>

</div>


{/* DISPLAY */}

<div>

<div
style={{
fontSize: "10px",
opacity: 0.6,
marginBottom: "4px",
textTransform: "uppercase",
letterSpacing: "0.04em"
}}
>
Display
</div>

<button
onClick={() => setShowConfidence(!showConfidence)}
style={{
padding: "3px 8px",
borderRadius: "6px",
border: "1px solid #333",
background: showConfidence ? "#444" : "transparent",
fontSize: "11px",
cursor: "pointer"
}}
>
Confidence Intervals
</button>

</div>

</div>

</div>

{/* CHART */}

<div
style={{
marginBottom: "20px",
padding: "15px",
borderRadius: "12px",
background: "#1f1f1f",
border: "1px solid #333",
width: "100%"
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
The Ireland Votes Aggregate
</div>

<div
style={{
height: "500px",
width: "100%",
display: "flex",
flexDirection: "column"
}}
>

{latest && (

<div
style={{
marginBottom: "14px",
padding: "10px 12px",
background: "#1f1f1f",
border: "1px solid #333",
borderRadius: "10px"
}}
>

{latestPoll && (

<div
style={{
fontSize: "11px",
opacity: 0.7,
marginBottom: "8px",
display: "flex",
gap: "12px",
flexWrap: "wrap"
}}
>

<div>
Last Updated:{" "}
<b>
{latest?.date
? new Date(latest.date).toLocaleDateString()
: "—"}
</b>
</div>

</div>

)}

<div
style={{
display: "flex",
gap: "14px",
flexWrap: "wrap",
fontSize: "13px",
fontWeight: "600"
}}
>

{latestParties.map(({ party, value, previous, lower, upper }) => {

const change =
previous !== undefined && previous !== null
? value - previous
: 0;

return (

<div
key={party}
onMouseEnter={() => setHovered(party)}
onMouseLeave={() => setHovered(null)}
style={{
padding: "5px 9px",
borderRadius: "6px",
background: `${PARTY_COLORS[party]}22`,
border: `1px solid ${PARTY_COLORS[party]}`,
display: "flex",
flexDirection: "column",
gap: "1px",
cursor: "pointer"
}}
>

{/* MAIN ROW */}

<div
style={{
display: "flex",
gap: "6px",
alignItems: "center",
fontWeight: 700
}}
>

<span>
{party}
</span>

<span>
{value?.toFixed(1)}
</span>

<span
style={{
fontSize: "9px",
opacity: 0.7,
color:
change > 0
? "#4caf50"
: change < 0
? "#f44336"
: "#666"
}}
>
{change > 0 ? "▲" : change < 0 ? "▼" : "▶"}
</span>

</div>

{/* CONFIDENCE INTERVAL */}

{lower !== null && upper !== null && (

<div
style={{
fontSize: "10px",
opacity: 0.6,
fontWeight: 500
}}
>
{lower.toFixed(1)} – {upper.toFixed(1)}
</div>

)}

</div>

);

})}

</div>

</div>

)}

<div
style={{
height: "460px",
width: "100%",
display: "flex",
flexDirection: "column"
}}
>

<div style={{ flex: 1 }}>

<ResponsiveContainer width="100%" height="100%">
<ComposedChart
data={chartData}
onMouseMove={(state) => {
if (state && state.activePayload && state.activePayload.length) {
setHovered(state.activePayload[0].dataKey);
}
}}
onMouseLeave={() => setHovered(null)}
margin={{
top: 30,
right: 20,
left: 0,
bottom: 30
}}
>

<CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />

{/* CONFIDENCE BANDS */}

{showConfidence && visible.FF && (
<Area
type="monotone"
dataKey="FF_lower"
stroke="none"
fill="transparent"
stackId="FF"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.FF && (
<Area
type="monotone"
dataKey="FF_range"
stroke="none"
fill="#66bb6a"
fillOpacity={0.08}
stackId="FF"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.FG && (
<Area
type="monotone"
dataKey="FG_lower"
stroke="none"
fill="transparent"
stackId="FG"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.FG && (
<Area
type="monotone"
dataKey="FG_range"
stroke="none"
fill="#5c6bc0"
fillOpacity={0.08}
stackId="FG"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.SF && (
<Area
type="monotone"
dataKey="SF_lower"
stroke="none"
fill="transparent"
stackId="SF"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.SF && (
<Area
type="monotone"
dataKey="SF_range"
stroke="none"
fill="#124940"
fillOpacity={0.18}
stackId="SF"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.SD && (
<Area
type="monotone"
dataKey="SD_lower"
stroke="none"
fill="transparent"
stackId="SD"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.SD && (
<Area
type="monotone"
dataKey="SD_range"
stroke="none"
fill="#741d83"
fillOpacity={0.08}
stackId="SD"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.LAB && (
<Area
type="monotone"
dataKey="LAB_lower"
stroke="none"
fill="transparent"
stackId="LAB"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.LAB && (
<Area
type="monotone"
dataKey="LAB_range"
stroke="none"
fill="#e53935"
fillOpacity={0.08}
stackId="LAB"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.GP && (
<Area
type="monotone"
dataKey="GP_lower"
stroke="none"
fill="transparent"
stackId="GP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.GP && (
<Area
type="monotone"
dataKey="GP_range"
stroke="none"
fill="#43a047"
fillOpacity={0.08}
stackId="GP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.AON && (
<Area
type="monotone"
dataKey="AON_lower"
stroke="none"
fill="transparent"
stackId="AON"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.AON && (
<Area
type="monotone"
dataKey="AON_range"
stroke="none"
fill="#53660e"
fillOpacity={0.08}
stackId="AON"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.PBPS && (
<Area
type="monotone"
dataKey="PBPS_lower"
stroke="none"
fill="transparent"
stackId="PBPS"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.PBPS && (
<Area
type="monotone"
dataKey="PBPS_range"
stroke="none"
fill="#da1498"
fillOpacity={0.08}
stackId="PBPS"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.INDIRL && (
<Area
type="monotone"
dataKey="INDIRL_lower"
stroke="none"
fill="transparent"
stackId="INDIRL"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.INDIRL && (
<Area
type="monotone"
dataKey="INDIRL_range"
stroke="none"
fill="#9be736"
fillOpacity={0.08}
stackId="INDIRL"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.IND && (
<Area
type="monotone"
dataKey="IND_lower"
stroke="none"
fill="transparent"
stackId="IND"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.IND && (
<Area
type="monotone"
dataKey="IND_range"
stroke="none"
fill="#7a7a7a"
fillOpacity={0.08}
stackId="IND"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.DUP && (
<Area
type="monotone"
dataKey="DUP_lower"
stroke="none"
fill="transparent"
stackId="DUP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.DUP && (
<Area
type="monotone"
dataKey="DUP_range"
stroke="none"
fill="#dd5454"
fillOpacity={0.08}
stackId="DUP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.UUP && (
<Area
type="monotone"
dataKey="UUP_lower"
stroke="none"
fill="transparent"
stackId="UUP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.UUP && (
<Area
type="monotone"
dataKey="UUP_range"
stroke="none"
fill="#3676c0"
fillOpacity={0.08}
stackId="UUP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.TUV && (
<Area
type="monotone"
dataKey="TUV_lower"
stroke="none"
fill="transparent"
stackId="TUV"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.TUV && (
<Area
type="monotone"
dataKey="TUV_range"
stroke="none"
fill="#061730"
fillOpacity={0.18}
stackId="TUV"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.SDLP && (
<Area
type="monotone"
dataKey="SDLP_lower"
stroke="none"
fill="transparent"
stackId="SDLP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.SDLP && (
<Area
type="monotone"
dataKey="SDLP_range"
stroke="none"
fill="#1a5c1d"
fillOpacity={0.08}
stackId="SDLP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.PBP && (
<Area
type="monotone"
dataKey="PBP_lower"
stroke="none"
fill="transparent"
stackId="PBP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.PBP && (
<Area
type="monotone"
dataKey="PBP_range"
stroke="none"
fill="#da1498"
fillOpacity={0.08}
stackId="PBP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.AP && (
<Area
type="monotone"
dataKey="AP_lower"
stroke="none"
fill="transparent"
stackId="AP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{showConfidence && visible.AP && (
<Area
type="monotone"
dataKey="AP_range"
stroke="none"
fill="#fdd835"
fillOpacity={0.08}
stackId="AP"
connectNulls
dot={false}
activeDot={false}
isAnimationActive={false}
/>
)}

{/* Election Lines */}

{elections.map((e) => (

<ReferenceLine
key={e.date}
x={new Date(e.date).getTime()}
stroke="#555"
strokeDasharray="3 3"
label={{
value: e.label,
position: "top",
fill: "#888",
fontSize: 10
}}
/>

))}

<XAxis
dataKey="date"
type="number"
scale="time"
ticks={xTicks}
stroke="#aaa"
tick={{ fontSize: 10 }}
tickFormatter={(value) => {

const d = new Date(value);
const month = d.getMonth();
const year = d.getFullYear();

return month === 0
? `Jan ${year}`
: `Jul ${year}`;

}}
/>

<YAxis
stroke="#aaa"
tick={{ fontSize: 10 }}
domain={[minY, maxY]}
allowDecimals={false}
tickFormatter={(value) => `${Math.round(value)}%`}
/>

<Tooltip content={<PollTooltip visible={visible} />} />


{/* RAW POLL DOTS */}

{visible.FF && (<Line type="monotone" dataKey="FF_poll" stroke="none" dot={{ r: 2, fill: "#66bb6a", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.FG && (<Line type="monotone" dataKey="FG_poll" stroke="none" dot={{ r: 2, fill: "#5c6bc0", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.SF && (<Line type="monotone" dataKey="SF_poll" stroke="none" dot={{ r: 2, fill: "#124940", fillOpacity: 0.35 }} activeDot={false}/> )}

{visible.LAB && (<Line type="monotone" dataKey="LAB_poll" stroke="none" dot={{ r: 2, fill: "#e53935", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.SD && (<Line type="monotone" dataKey="SD_poll" stroke="none" dot={{ r: 2, fill: "#741d83", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.GP && (<Line type="monotone" dataKey="GP_poll" stroke="none" dot={{ r: 2, fill: "#43a047", fillOpacity: 0.35 }} activeDot={false}/> )}

{visible.PBPS && (<Line type="monotone" dataKey="PBPS_poll" stroke="none" dot={{ r: 2, fill: "#da1498", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.AON && (<Line type="monotone" dataKey="AON_poll" stroke="none" dot={{ r: 2, fill: "#53660e", fillOpacity: 0.35 }} activeDot={false}/> )}

{visible.INDIRL && (<Line type="monotone" dataKey="INDIRL_poll" stroke="none" dot={{ r: 2, fill: "#9be736", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.IND && (<Line type="monotone" dataKey="IND_poll" stroke="none" dot={{ r: 2, fill: "#7a7a7a", fillOpacity: 0.35 }} activeDot={false}/> )}

{visible.DUP && (<Line type="monotone" dataKey="DUP_poll" stroke="none" dot={{ r: 2, fill: "#dd5454", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.UUP && (<Line type="monotone" dataKey="UUP_poll" stroke="none" dot={{ r: 2, fill: "#3676c0", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.TUV && (<Line type="monotone" dataKey="TUV_poll" stroke="none" dot={{ r: 2, fill: "#061730", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.SDLP && (<Line type="monotone" dataKey="SDLP_poll" stroke="none" dot={{ r: 2, fill: "#1a5c1d", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.PBP && (<Line type="monotone" dataKey="PBP_poll" stroke="none" dot={{ r: 2, fill: "#da1498", fillOpacity: 0.35 }} activeDot={false}/> )}
{visible.AP && (<Line type="monotone" dataKey="AP_poll" stroke="none" dot={{ r: 2, fill: "#fdd835", fillOpacity: 0.35 }} activeDot={false}/> )}

{/* ROLLING AVERAGE */}

{visible.FF && (<Line type="monotone" dataKey="FF" stroke="#66bb6a" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "FF" ? 0.15 : 1}/> )}
{visible.FG && (<Line type="monotone" dataKey="FG" stroke="#5c6bc0" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "FG" ? 0.15 : 1}/> )}
{visible.SF && (<Line type="monotone" dataKey="SF" stroke="#124940" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "SF" ? 0.15 : 1}/> )}
{visible.SD && (<Line type="monotone" dataKey="SD" stroke="#741d83" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "SD" ? 0.15 : 1}/> )}
{visible.LAB && (<Line type="monotone" dataKey="LAB" stroke="#e53935" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "LAB" ? 0.15 : 1}/> )}
{visible.GP && (<Line type="monotone" dataKey="GP" stroke="#43a047" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "GP" ? 0.15 : 1}/> )}
{visible.AON && (<Line type="monotone" dataKey="AON" stroke="#53660e" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "AON" ? 0.15 : 1}/> )}
{visible.INDIRL && (<Line type="monotone" dataKey="INDIRL" stroke="#9be736" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "INDIRL" ? 0.15 : 1}/> )}
{visible.PBPS && (<Line type="monotone" dataKey="PBPS" stroke="#da1498" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "PBPS" ? 0.15 : 1}/> )}
{visible.IND && (<Line type="monotone" dataKey="IND" stroke="#7a7a7a" dot={false} strokeWidth={2} connectNulls strokeDasharray="3 3" strokeOpacity={hovered && hovered !== "IND" ? 0.15 : 1}/> )}

{visible.DUP && (<Line type="monotone" dataKey="DUP" stroke="#dd5454" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "DUP" ? 0.15 : 1}/> )}
{visible.UUP && (<Line type="monotone" dataKey="UUP" stroke="#3676c0" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "UUP" ? 0.15 : 1}/> )}
{visible.TUV && (<Line type="monotone" dataKey="TUV" stroke="#061730" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "TUV" ? 0.15 : 1}/> )}
{visible.SDLP && (<Line type="monotone" dataKey="SDLP" stroke="#1a5c1d" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "SDLP" ? 0.15 : 1}/> )}
{visible.PBP && (<Line type="monotone" dataKey="PBP" stroke="#da1498" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "PBP" ? 0.15 : 1}/> )}
{visible.AP && (<Line type="monotone" dataKey="AP" stroke="#fdd835" dot={false} strokeWidth={3} connectNulls strokeOpacity={hovered && hovered !== "AP" ? 0.15 : 1}/> )}

</ComposedChart>

</ResponsiveContainer>

</div>

</div>

</div>

</div>

{/* SECONDARY CHARTS */}

<div
style={{
display: "grid",
gridTemplateColumns: "1fr 1fr",
gap: "16px",
marginTop: "16px"
}}
>

{/* COALITION TRACKER */}

<div
style={{
background: "#1f1f1f",
border: "1px solid #333",
borderRadius: "12px",
padding: "14px"
}}
>

<div
style={{
fontSize: "13px",
fontWeight: "600",
marginBottom: "4px",
opacity: 0.85
}}
>
{tracker === "ni"
? "Community Tracker"
: "Coalition Tracker"}
</div>

<div
style={{
fontSize: "11px",
opacity: 0.6,
marginBottom: "8px"
}}
>
{tracker === "ni"
? "Support by community designation over time"
: "Support for the FF-FG coalition since the last election"}
</div>

<div style={{ height: "260px" }}>

<ResponsiveContainer width="100%" height="100%">

<ComposedChart
data={
tracker === "ni"
? blocData
: coalitionData
}
>

<CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />

<ReferenceLine
y={50}
stroke="#666"
strokeDasharray="3 3"
/>

<XAxis
dataKey="date"
type="number"
scale="time"
domain={[coalitionStartDate, coalitionEndDate]}
ticks={coalitionTicks}
stroke="#aaa"
tick={{ fontSize: 10 }}
tickFormatter={(value) => {

const d = new Date(value);
const month = d.getMonth();
const year = d.getFullYear();

return month === 0
? `Jan ${year}`
: `Jul ${year}`;

}}
/>

<YAxis
stroke="#aaa"
tick={{ fontSize: 10 }}
allowDecimals={false}
/>

<Tooltip content={<CoalitionTooltip />} />

{tracker === "dail" && (

<>

<Line
type="monotone"
dataKey="Coalition"
stroke="#4caf50"
strokeWidth={3}
dot={false}
/>

<Line
type="monotone"
dataKey="Opposition"
stroke="#f44336"
strokeWidth={3}
dot={false}
/>

<Line
type="monotone"
dataKey="Independents"
stroke="#9e9e9e"
strokeWidth={2}
strokeDasharray="4 4"
dot={false}
/>

</>

)}

{tracker === "ni" && (

<>

<Line
type="monotone"
dataKey="nationalist"
name="Nationalist"
stroke="#0c4257"
strokeWidth={3}
dot={false}
/>

<Line
type="monotone"
dataKey="unionist"
name="Unionist"
stroke="#d65f30"
strokeWidth={3}
dot={false}
/>

<Line
type="monotone"
dataKey="nonAligned"
name="Non-Aligned"
stroke="#e4ad15"
strokeWidth={2}
strokeDasharray="4 4"
dot={false}
/>

</>

)}

</ComposedChart>

</ResponsiveContainer>

</div>

</div>

{/* SUB SAMPLE PLACEHOLDER */}

<div
style={{
background: "#1f1f1f",
border: "1px solid #333",
borderRadius: "12px",
padding: "14px"
}}
>

<div
style={{
fontSize: "13px",
fontWeight: "600",
marginBottom: "8px",
opacity: 0.85
}}
>
Sub-Sample Aggregates
</div>

<div
style={{
height: "260px",
display: "flex",
alignItems: "center",
justifyContent: "center",
fontSize: "12px",
opacity: 0.6
}}
>
Regional and demographic polling coming soon
</div>

</div>
</div>

{/* TABLE */}

<div
style={{
marginTop: "20px",
background: "#1f1f1f",
border: "1px solid #333",
borderRadius: "12px",
overflow: "hidden",
width: "100%"
}}
>

<div
style={{
maxHeight: "500px",
overflowY: "auto"
}}
>

{/* HEADER */}

<div
style={{
display: "grid",
position: "sticky",
top: 0,
zIndex: 5,
background: "#1f1f1f",
borderBottom: "1px solid #333",
boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
width: "100%",
gridTemplateColumns:
`140px 160px 90px 70px repeat(${tableParties.length}, minmax(45px, 1fr)) 90px`,
fontSize: "11px",
fontWeight: "600",
opacity: 0.95
}}
>

<div style={{ padding: "8px" }}>Date</div>
<div style={{ padding: "8px" }}>Pollster</div>
<div style={{ padding: "8px" }}>Sample</div>
<div style={{ padding: "8px" }}>MoE</div>

{tableParties.map(party => (

<div
key={party}
style={{
padding: "8px",
textAlign: "center",
background: `${PARTY_COLORS[party]}22`,
borderLeft: "1px solid #333"
}}
>
{party}
</div>

))}

<div
style={{
padding: "8px",
textAlign: "center",
borderLeft: "1px solid #333"
}}
>
Lead
</div>

</div>


{/* ROWS */}

{(showAllPolls ? tableData : tableData.slice(0,10)).map((poll,i) => {

const leader = getLeader(poll);

return (

<div
key={i}
style={{
display: "grid",
width: "100%",
gridTemplateColumns:
`140px 160px 90px 70px repeat(${tableParties.length}, minmax(45px, 1fr)) 90px`,
borderTop: "1px solid #2a2a2a",
fontSize: "11px"
}}
>

<div style={{ padding: "8px" }}>
{formatDate(poll.date)}
</div>

<div style={{ padding: "8px" }}>
{poll.pollster}
</div>

<div style={{ padding: "8px" }}>
{poll["sample"] ?? "—"}
</div>

<div style={{ padding: "8px" }}>
{poll["moe"] ?? "—"}
</div>


{tableParties.map(party => (

<div
key={party}
style={{
padding: "8px",
textAlign: "center",
background: getHeatColor(poll[party]),
borderLeft: "1px solid #2a2a2a",
fontWeight: poll[party] > 20 ? 600 : 400
}}
>
{poll[party] !== null && poll[party] !== undefined
? poll[party].toFixed(0)
: "—"}
</div>

))}


<div
style={{
padding: "8px",
textAlign: "center",
borderLeft: "1px solid #2a2a2a",
fontWeight: 600,
background: leader?.party
? `${PARTY_COLORS[leader.party]}33`
: "#333"
}}
>
{leader?.text ?? "—"}
</div>

</div>

);

})}

</div>
</div>

{/* TABLE TOGGLE */}

<div
style={{
padding: "12px",
textAlign: "center",
borderTop: "1px solid #333"
}}
>

<button
onClick={() => setShowAllPolls(!showAllPolls)}
style={{
padding: "6px 14px",
borderRadius: "8px",
border: "1px solid #333",
background: "#2a2a2a",
color: "#fff",
fontSize: "12px",
cursor: "pointer"
}}
>
{showAllPolls
? "Show Less"
: `Show All Polls (${tableData.length})`}
</button>

</div>

</div>
</div>

);
}