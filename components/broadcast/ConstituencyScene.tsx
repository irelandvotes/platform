"use client";

import { useState, useEffect } from "react";

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

  export default function ConstituencyScene({
  name,
  results,
  previousResults,
  onComplete
}: {
  name: any;
  results: any;
  previousResults: string;
  onComplete: any;
}) {

const [step, setStep] = useState(0);

const counts = results?.[name]?.counts || {};

const hasCounts =
Object.keys(counts).length > 0;

/* STEP ROTATION */

const steps: any = [
"firstPreference",
"swing",
"firstCount",
"latestCount"
];

useEffect(() => {

setStep(0);

const interval = setInterval(() => {

setStep(prev => {

const next = prev + 1;

if (next >= steps.length) {
onComplete?.();
return 0;
}

return next;

});

}, 6000);

return () => clearInterval(interval);

}, [name]);


/* COUNT DATA */

const firstCount = counts[1] || [];

const latestCountNumber =
Object.keys(counts).length
? Math.max(...Object.keys(counts).map(Number))
: 1;

const latestCount =
counts[latestCountNumber] || [];

const prevCount =
counts[latestCountNumber - 1] || [];


/* PARTY SHARE */

const partyTotals: Record<string, number> = {};

firstCount.forEach((c: any) => {
const party = c.party || "IND";
partyTotals[party] =
(partyTotals[party] || 0) + c.votes;
});

const totalVotes =
Object.values(partyTotals)
.reduce((a,b)=>a+b,0);

const partyShare =
Object.entries(partyTotals)
.map(([party,votes])=>({
party,
percent:
totalVotes
? (votes/totalVotes)*100
:0
}))
.sort((a,b)=>b.percent-a.percent);


/* SWING */

const previous: any =
previousResults?.[name] || {};

const partySwing =
partyShare.map(p=>{

const prevVotes =
previous?.[p.party]?.votes || 0;

const prevTotal: any =
Object.values(previous)
.reduce((a: any,b: any)=>a+(b.votes||0),0);

const prevPercent =
prevTotal
? (prevVotes/prevTotal)*100
:0;

return {
...p,
swing:p.percent-prevPercent
};

});


/* STATUS */

function getStatus({
candidate,
prev,
}: {
candidate: any;
prev: any;
}) {

if(candidate.status==="elected"){
return "elected";
}

if(
candidate.status==="eliminated" &&
prev?.find(
(p: any) => p.name===candidate.name &&
p.status==="eliminated"
)
){
return "eliminated";
}

return "running";

}


/* RENDER */

return (

<div
style={{
height:"100%",
display:"flex",
flexDirection:"column",
padding:"30px",
overflow:"hidden"
}}
>


{/* CONTENT AREA */}

{!hasCounts && (
<div
style={{
flex:1,
display:"flex",
alignItems:"center",
justifyContent:"center",
fontSize:"24px",
opacity:0.6
}}
>
Awaiting count data…
</div>
)}

<div
style={{
flex:1,
display:"flex",
flexDirection:"column",
overflow:"hidden"
}}
>


{/* FIRST PREFERENCE */}

{steps[step]==="firstPreference" && (

<>

<div
style={{
fontSize:"36px",
fontWeight:"700",
marginBottom:"20px"
}}
>
FIRST PREFERENCE
</div>

<div
style={{
flex:1,
display:"flex",
alignItems:"flex-end",
gap:"30px"
}}
>

{(()=>{

const max =
Math.max(...partyShare.map(p=>p.percent));

return partyShare.map(p=>{

const height =
max ? (p.percent/max)*100 : 0;

return(

<div
key={p.party}
style={{
flex:1,
display:"flex",
flexDirection:"column",
alignItems:"center",
height:"100%",
justifyContent:"flex-end"
}}
>

<div
style={{
fontSize:"24px",
fontWeight:"700",
marginBottom:"8px"
}}
>
{p.percent.toFixed(1)}%
</div>

<div
style={{
width:"100%",
height:`${height}%`,
background:PARTY_COLORS[p.party],
borderRadius:"6px 6px 0 0"
}}
/>

<div
style={{
marginTop:"12px",
fontSize:"18px",
fontWeight:"700"
}}
>
{p.party}
</div>

</div>

);

});

})()}

</div>

</>

)}


{/* SWING */}

{steps[step]==="swing" && (

<>
<div
style={{
fontSize:"36px",
fontWeight:"700",
marginBottom:"20px"
}}
>
SWING
</div>

<div
style={{
flex:1,
display:"flex",
gap:"30px"
}}
>

{(()=>{

const max =
Math.max(
...partySwing.map(p=>Math.abs(p.swing))
);

return partySwing.map(p=>{

const height =
max ? (Math.abs(p.swing)/max)*50 : 0;

return(

<div
key={p.party}
style={{
flex:1,
display:"flex",
flexDirection:"column",
alignItems:"center"
}}
>

<div
style={{
fontSize:"22px",
fontWeight:"700",
marginBottom:"8px"
}}
>
{p.swing>0?"+":""}
{p.swing.toFixed(1)}
</div>

<div
style={{
flex:1,
width:"100%",
position:"relative"
}}
>

<div
style={{
position:"absolute",
top:"50%",
left:0,
right:0,
height:"2px",
background:"#555"
}}
/>

<div
style={{
position:"absolute",
left:0,
right:0,
background:PARTY_COLORS[p.party],
height:`${height}%`,
bottom:p.swing>0?"50%":"auto",
top:p.swing<0?"50%":"auto"
}}
/>

</div>

<div
style={{
marginTop:"12px",
fontSize:"18px",
fontWeight:"700"
}}
>
{p.party}
</div>

</div>

);

});

})()}

</div>

</>

)}


{/* CANDIDATES */}

{(steps[step]==="firstCount" ||
steps[step]==="latestCount") && (

<>

<div
style={{
fontSize:"36px",
fontWeight:"700",
marginBottom:"20px",
flexShrink:0
}}
>
{steps[step]==="firstCount"
?"FIRST COUNT"
:"LATEST COUNT"}
</div>

{(() => {

const data =
steps[step]==="firstCount"
? firstCount
: latestCount;

const candidates =
data.map((c: any) => {

const status =
getStatus({
  candidate: c,
  prev:
    steps[step] === "firstCount"
      ? firstCount
      : prevCount
});

return {
...c,
status
};

});

const elected =
candidates.filter((c: any)=>c.status==="elected");

const running =
candidates.filter((c: any)=>c.status==="running");

const eliminated =
candidates.filter((c: any)=>c.status==="eliminated");

const ordered = [
...elected,
...running,
...eliminated
];

const rowHeight =
`calc((100% - 20px) / ${ordered.length})`;

return (

<div
style={{
flex:1,
display:"flex",
flexDirection:"column",
gap:"8px"
}}
>

{ordered.map(c => (

<div
key={c.id}
style={{
height: rowHeight,
borderRadius: "10px",
overflow: "hidden",
display: "flex",
background:
c.status === "elected"
? PARTY_COLORS[c.party]
: "#2a2a2a",
color:
c.status === "elected"
? "#fff"
: "#fff",
opacity:
c.status === "eliminated"
? 0.5
: 1
}}
>

{/* ELECTED CHECK STRIP */}

{c.status === "elected" && (
<div
style={{
width: "36px",
background: "#fff",
display: "flex",
alignItems: "center",
justifyContent: "center"
}}
>

<svg
width="16"
height="16"
viewBox="0 0 16 16"
fill="none"
>
<path
d="M4 8.5L7 11.5L12 5"
stroke={PARTY_COLORS[c.party]}
strokeWidth="2.8"
strokeLinecap="square"
/>
</svg>

</div>
)}

{/* PARTY STRIP (non-elected only) */}

{c.status !== "elected" && (
<div
style={{
width: "12px",
background: PARTY_COLORS[c.party]
}}
/>
)}

{/* CONTENT */}

<div
style={{
flex: 1,
padding: "0 18px",
display: "flex",
alignItems: "center",
justifyContent: "space-between"
}}
>

{/* LEFT */}

<div>

<div
style={{
fontSize: "20px",
fontWeight: "700"
}}
>
{c.name}
</div>

<div
style={{
opacity: c.status === "elected" ? 0.9 : 0.7,
fontSize: "14px"
}}
>
{c.party}
</div>

</div>


{/* RIGHT */}

<div
style={{
textAlign: "right"
}}
>

<div
style={{
fontSize: "22px",
fontWeight: "700"
}}
>
{c.votes.toLocaleString()}
</div>

<div
style={{
fontSize: "12px",
opacity: c.status === "elected" ? 0.9 : 0.7
}}
>
{c.status.toUpperCase()}
</div>

</div>

</div>

</div>

))}

</div>

);

})()}

</>

)}

</div>

</div>

);

}