export function buildPollingAverage(polls, tracker = "dail") {

const sortedPolls = [...polls].sort(
(a, b) => a.date - b.date
);

if (!sortedPolls.length) return [];

const halfLife = 30;

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


/* ===============================
   WEIGHTED ROLLING AVERAGE
=============================== */

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
(currentDate - p.date) /
(1000 * 60 * 60 * 24);

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

} else {

avg[party] = null;
avg[`${party}_upper`] = null;
avg[`${party}_lower`] = null;

}

});

data.push(avg);

}


/* ===============================
   TREND SMOOTHING
=============================== */

const window = 7;

const smoothed = data.map((row, i) => {

const slice = data.slice(
Math.max(0, i - window),
Math.min(data.length, i + window)
);

const smoothedRow = {
date: row.date
};

parties.forEach(party => {

const values = slice
.map(r => r[party])
.filter(v => typeof v === "number");

smoothedRow[party] = values.length
? values.reduce((a,b)=>a+b,0)/values.length
: null;

const upperValues = slice
.map(r => r[`${party}_upper`])
.filter(v => typeof v === "number");

const lowerValues = slice
.map(r => r[`${party}_lower`])
.filter(v => typeof v === "number");

smoothedRow[`${party}_upper`] =
upperValues.length
? upperValues.reduce((a,b)=>a+b,0)/upperValues.length
: null;

smoothedRow[`${party}_lower`] =
lowerValues.length
? lowerValues.reduce((a,b)=>a+b,0)/lowerValues.length
: null;

});

return smoothedRow;

});

return smoothed;

}