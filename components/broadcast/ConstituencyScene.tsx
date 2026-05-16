"use client";

import { useState, useEffect } from "react";

const PARTY_COLORS: Record<string,string> = {
  FF:"#66bb6a",
  FG:"#5c6bc0",
  SF:"#124940",
  LAB:"#e53935",
  GP:"#43a047",
  SD:"#741d83",
  PBPS:"#da1498",
  AON:"#53660e",
  IFP:"#0b5a1c",
  INDIRL:"#9be736",
  IND:"#7a7a7a",
  IPP:"#0e9775"
};

type CandidateStatus =
  | "elected"
  | "running"
  | "eliminated";

type CandidateRow = {
  status: CandidateStatus;
} & Record<string, any>;

export default function ConstituencyScene({
  name,
  results,
  previousResults
}:{
  name:string;
  results:any;
  previousResults:any;
}) {

const [step,setStep]=useState(0);

const steps=[
  "party",
  "swing",
  "firstCount",
  "latestCount"
];

useEffect(()=>{

setStep(0);

const interval=setInterval(()=>{

setStep(prev=>
(prev+1)%steps.length
);

},9000);

return ()=>clearInterval(interval);

},[name]);

const counts=
results?.[name]?.counts||{};

const firstCount=
counts[1]||[];

const latestCountNumber=
Object.keys(counts).length
?Math.max(
...Object.keys(counts)
.map(Number)
)
:1;

const latestCount=
counts[latestCountNumber]||[];

const hasCounts=
firstCount.length>0;


/* PARTY SHARE */

const totals:
Record<string,number>={};

firstCount.forEach((c:any)=>{

const p=
c.party||"IND";

totals[p]=
(totals[p]||0)
+
(c.votes||0);

});

const totalVotes=
Object.values(totals)
.reduce((a,b)=>a+b,0);

const partyShare=
Object.entries(totals)

.map(([party,votes])=>({

party,

percent:
totalVotes
?(votes/totalVotes)*100
:0

}))

.sort(
(a,b)=>
b.percent-a.percent
);


/* SWING */

const previous:
Record<string,any>=
previousResults?.[name]
?? {};

const previousTotal=

Object.values(previous)

.reduce(
(a:number,b:any)=>
a+(b.votes||0),
0
);

const swing=

partyShare.map(p=>{

const previousVotes=

previous[p.party]
?.votes||0;

const previousPercent=

previousTotal
?(previousVotes/
previousTotal)*100
:0;

return{

...p,

change:
p.percent
-
previousPercent

};

});


function CandidateTable(
data:any[]
){

const ordered:
CandidateRow[]=
[...data]

.map((c:any)=>{

let status:
CandidateStatus=
"running";

if(
c.status===
"elected"
){
status=
"elected";
}

if(
c.status===
"eliminated"
){
status=
"eliminated";
}

return{
...c,
status
};

})

.sort((a,b)=>{

const order = {
  elected: 0,
  running: 1,
  eliminated: 2
} satisfies Record<CandidateStatus, number>;

return (
  order[a.status as CandidateStatus] -
  order[b.status as CandidateStatus]
);

})

.sort(
(a,b)=>
b.votes-a.votes
);

return(

<div
style={{
display:"flex",
flexDirection:"column",
gap:"8px"
}}
>

{ordered.map(c=>(

<div
key={c.id}
style={{

display:"flex",
alignItems:"center",

padding:"18px",

borderRadius:"20px",

position:"relative",

overflow:"hidden",

background:

c.status==="elected"

? `linear-gradient(
90deg,
${PARTY_COLORS[c.party]}33,
${PARTY_COLORS[c.party]}15
)`

: `linear-gradient(
180deg,
rgba(255,255,255,.05),
rgba(255,255,255,.02)
)`,

boxShadow:
"0 12px 35px rgba(0,0,0,.25)",

backdropFilter:
"blur(18px)",

opacity:
c.status==="eliminated"
?.35
:1,

filter:
c.status==="eliminated"
?"grayscale(.7)"
:"none"
}}
>

  {c.status==="elected" && (

<div
style={{
position:"absolute",
left:0,
top:0,
bottom:0,
width:"5px",

background:
PARTY_COLORS[c.party],

boxShadow:
`0 0 18px ${PARTY_COLORS[c.party]}`
}}
/>

)}

<div
style={{
width:"6px",
height:"46px",
marginRight:"14px",
borderRadius:"6px",
background:
PARTY_COLORS[
c.party
]
}}
/>

{c.status==="elected" && (

<div
style={{
width:"46px",
height:"46px",
borderRadius:"50%",
background:"#fff",
display:"flex",
alignItems:"center",
justifyContent:"center",
marginRight:"14px",
flexShrink:0
}}
>

<svg
width="18"
height="18"
viewBox="0 0 16 16"
fill="none"
>
<path
d="M4 8.5L7 11.5L12 5"
stroke={
PARTY_COLORS[c.party]
}
strokeWidth="2.8"
/>
</svg>

</div>

)}

<div style={{flex:1}}>

<div
style={{
fontSize:"22px",
fontWeight:700
}}
>
{c.name}
</div>

<div
style={{
opacity:.7
}}
>
{c.party}
</div>

</div>

<div
style={{
textAlign:"right"
}}
>

<div
style={{
fontSize:"24px",
fontWeight:700
}}
>
{c.votes.toLocaleString()}
</div>

<div
style={{
fontSize:"12px",
opacity:.7
}}
>
{c.status}
</div>

</div>

</div>

))}

</div>

);

}

return(

<div
style={{
height:"100%",
display:"flex",
flexDirection:"column",
padding:"40px 46px",
position:"relative",
overflow:"hidden"
}}
>

{!hasCounts&&(

<div
style={{
flex:1,
display:"flex",
alignItems:"center",
justifyContent:"center",
fontSize:"28px",
opacity:.5
}}
>
Awaiting results
</div>

)}

{hasCounts&&(

<>

<div
style={{
display:"flex",
alignItems:"center",
justifyContent:"space-between",
marginBottom:"32px"
}}
>

<div>

<div
style={{
fontSize:"11px",
letterSpacing:"2px",
textTransform:"uppercase",
opacity:.55,
marginBottom:"8px"
}}
>
Live Results
</div>

<div
style={{
fontSize:"52px",
fontWeight:800,
lineHeight:1,
letterSpacing:"-2px"
}}
>

{steps[step]==="party" &&
"Party Share"}

{steps[step]==="swing" &&
"Swing"}

{steps[step]==="firstCount" &&
"Count 1"}

{steps[step]==="latestCount" &&
`Count ${latestCountNumber}`}

</div>

</div>

<div
style={{
padding:"10px 16px",
borderRadius:"999px",
background:"rgba(255,255,255,.05)",
border:"1px solid rgba(255,255,255,.08)",
backdropFilter:"blur(12px)",
fontSize:"13px",
fontWeight:700
}}
>
{name}
</div>

</div>


{/* PARTY SHARE */}

{steps[step]==="party"&&(

<div
style={{
display:"flex",
flexDirection:"column",
gap:"14px"
}}
>

{partyShare.map(p=>(

<div
key={p.party}
style={{
display:"flex",
alignItems:"center",
gap:"16px",

padding:"14px",

borderRadius:"18px",

background: `
linear-gradient(
90deg,
rgba(255,255,255,.06),
rgba(255,255,255,.03)
)
`,

border:
"1px solid rgba(255,255,255,.08)",

backdropFilter:"blur(14px)",

boxShadow:
"0 10px 30px rgba(0,0,0,.25)"
}}
>

<div
style={{
width:"60px",
fontWeight:700,
fontSize:"22px"
}}
>
{p.party}
</div>

<div
style={{
flex:1,
height:"32px",
background:"rgba(255,255,255,.06)",
overflow:"hidden",
position:"relative"
}}
>

<div
style={{
height:"100%",
width:`${p.percent}%`,
background:
PARTY_COLORS[p.party],
transition:"width .8s ease"
}}
/>

</div>

<div
style={{
width:"90px",
textAlign:"right",
fontSize:"24px",
fontWeight:700
}}
>
{p.percent.toFixed(1)}%
</div>

</div>

))}

</div>

)}


{/* SWING */}

{steps[step]==="swing"&&(

<div
style={{
display:"flex",
flexDirection:"column",
gap:"14px"
}}
>

{swing.map(p=>{

const width=
Math.min(
Math.abs(p.change)*8,
50
);

return(

<div
key={p.party}
style={{
display:"flex",
alignItems:"center",
gap:"16px",

padding:"14px",

background: `
linear-gradient(
90deg,
rgba(255,255,255,.06),
rgba(255,255,255,.03)
)
`,

border:
"1px solid rgba(255,255,255,.08)",

backdropFilter:"blur(14px)",

boxShadow:
"0 10px 30px rgba(0,0,0,.25)"
}}
>

<div
style={{
width:"60px",
fontWeight:700,
fontSize:"22px"
}}
>
{p.party}
</div>

<div
style={{
flex:1,
height:"32px",
position:"relative",
background:
"rgba(255,255,255,.04)",
overflow:"hidden"
}}
>

{/* centre line */}

<div
style={{
position:"absolute",
left:"50%",
top:0,
bottom:0,
width:"2px",
background:
"rgba(255,255,255,.35)",
zIndex:5
}}
/>

<div
style={{
position:"absolute",
height:"100%",
width:`${width}%`,
background:
PARTY_COLORS[p.party],
left:
p.change>=0
?"50%"
:`${50-width}%`,
}}
/>

</div>

<div
style={{
width:"90px",
textAlign:"right",
fontSize:"24px",
fontWeight:700,
color:
p.change>0
?"#4caf50"
:"#f44336"
}}
>

{p.change>0?"+":""}
{p.change.toFixed(1)}

</div>

</div>

);

})}

</div>

)}

{steps[step]==="firstCount" &&
CandidateTable(firstCount)}

{steps[step]==="latestCount" &&
CandidateTable(latestCount)}

</>

)}

</div>

);

}