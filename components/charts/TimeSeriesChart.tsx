"use client";

import {
ComposedChart,
Line,
ResponsiveContainer,
XAxis,
YAxis,
Tooltip,
CartesianGrid,
ReferenceLine
} from "recharts";

interface LineConfig {
key: string;
color: string;
strokeWidth?: number;
dashed?: boolean;
name?: string;
}

interface Props {
data: any[];
lines: LineConfig[];
ticks?: number[];
tooltip?: any;
referenceLine?: number;
minY?: number;
maxY?: number;
height?: number;
}

export default function TimeSeriesChart({
data,
lines,
ticks,
tooltip,
referenceLine,
minY,
maxY,
height = 260
}: Props) {

return (

<div style={{ height }}>

<ResponsiveContainer width="100%" height="100%">

<ComposedChart data={data}>

<CartesianGrid
stroke="#2a2a2a"
strokeDasharray="3 3"
/>

{referenceLine !== undefined && (

<ReferenceLine
y={referenceLine}
stroke="#666"
strokeDasharray="3 3"
/>

)}

<XAxis
dataKey="date"
type="number"
scale="linear"
domain={[
(dataMin: number) => dataMin,
(dataMax: number) => dataMax
]}
ticks={ticks}
stroke="#aaa"
tick={{ fontSize: 10 }}
padding={{ left: 0, right: 0 }}
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
domain={
minY !== undefined && maxY !== undefined
? [minY, maxY]
: ["dataMin - 5", "dataMax + 5"]
}
tickFormatter={(value) => `${Math.round(value)}%`}
/>

{tooltip && (
<Tooltip content={tooltip} />
)}

{lines.map(line => (

<Line
key={line.key}
type="monotone"
dataKey={line.key}
name={line.name || line.key}
stroke={line.color}
strokeWidth={line.strokeWidth || 3}
strokeDasharray={line.dashed ? "4 4" : undefined}
dot={false}
connectNulls
isAnimationActive={false}
/>

))}

</ComposedChart>

</ResponsiveContainer>

</div>

);

}