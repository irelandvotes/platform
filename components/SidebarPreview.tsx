"use client";

import {
ResponsiveContainer,
ComposedChart,
Line,
YAxis
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
IND: "#9e9e9e",

SDLP: "#1a5c1d",
PBP: "#da1498",

DUP: "#dd5454",
UUP: "#3676c0",
TUV: "#061730",

AP: "#fdd835",
};

export default function SidebarPreview({ data, tracker }: { data: any[]; tracker: string }) {

if (!data || !data.length) return null;

const latest =
data[data.length - 1];

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

const topThree =
sorted.slice(0,3).map(p => p.party);

const lastUpdated =
new Date(latest.date)
.toLocaleDateString("en-IE", {
day: "2-digit",
month: "short"
});

const values = data.flatMap((d: any) =>
topThree.map(p => d[p]).filter(v => v !== null)
);

const min = Math.min(...values);
const max = Math.max(...values);

const padding = 1;

const yMin = Math.max(0, min - padding);
const yMax = max + padding;

return (

<div>

<div
style={{
fontSize: "11px",
marginBottom: "4px"
}}
>
{leader?.party} +{margin}
</div>


<div
style={{
height: "34px",
width: "100%"
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