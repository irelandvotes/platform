"use client";

const PARTY_COLORS: Record<string,string> = {
  FF: "#66bb6a",
  FG: "#5c6bc0",
  SF: "#124940",
  LAB: "#e53935",
  GP: "#43a047",
  SD: "#741d83",
  PBPS: "#da1498",
  AON: "#53660e",
  INDIRL: "#9be736",
  I4C: "#e2a8a8",
  IND: "#7a7a7a",
  IPP: "#0e9775",
  REN: "#d6960b",

  SDLP: "#fd281b",
  PBP: "#da1498",
  INDN: "#0c4257",

  DUP: "#dd5454",
  UUP: "#3676c0",
  TUV: "#0a244b",
  INDU: "#d65f30",

  AP: "#fdd835",
  CON: "#0a3f8f",
  PUP: "#090ca8",
  WP: "#580707",
  UKIP: "#580454",
  IFP: "#095f18",
  NP: "#052e1d",
  RTC: "#db2f2f",
  RED: "#7a7a7a"
};

export default function NationalScene({
title,
results
}:{
title:string;
results:any;
}){

const partyVotes:Record<string,number>={};
const partySeats:Record<string,number>={};

Object.values(results||{}).forEach(
(constituency:any)=>{

const counts=
constituency?.counts||{};

const first=
counts[1]||[];

const latest=
counts[
Math.max(
...Object.keys(counts).map(Number),
1
)
]||[];

first.forEach((c:any)=>{

partyVotes[c.party]=
(partyVotes[c.party]||0)
+(c.votes||0);

});

latest.forEach((c:any)=>{

if(c.status==="elected"){

partySeats[c.party]=
(partySeats[c.party]||0)+1;

}

});

});

const totalVotes=
Object.values(partyVotes)
.reduce((a,b)=>a+b,0);

const rows=

Object.keys(partyVotes)

.map(party=>({

party,

votes:
partyVotes[party],

seats:
partySeats[party]||0,

percent:
totalVotes
?(
partyVotes[party]/
totalVotes
)*100
:0

}))

.sort(
(a,b)=>
b.votes-a.votes
)

.slice(0,8);


return(

<div
style={{
height:"100%",
display:"flex",
flexDirection:"column"
}}
>

<div
style={{
fontSize:"42px",
fontWeight:700
}}
>
{title}
</div>

<div
style={{
opacity:.6,
marginBottom:"28px"
}}
>
National Overview
</div>


{/* HEADLINE NUMBERS */}

<div
style={{
display:"grid",
gridTemplateColumns:"repeat(3,1fr)",
gap:"12px",
marginBottom:"25px"
}}
>

{[
{
label:"PARTIES",
value:rows.length
},
{
label:"SEATS CALLED",
value:Object.values(
partySeats
).reduce((a,b)=>a+b,0)
},
{
label:"CONSTITUENCIES",
value:Object.keys(results).length
}
].map(card=>(

<div
key={card.label}
style={{
background:"#191919",
borderRadius:"14px",
padding:"18px"
}}
>

<div
style={{
fontSize:"11px",
opacity:.5
}}
>
{card.label}
</div>

<div
style={{
fontSize:"32px",
fontWeight:700
}}
>
{card.value}
</div>

</div>

))}

</div>


{/* PARTY TABLE */}

<div
style={{
display:"flex",
flexDirection:"column",
gap:"12px"
}}
>

{rows.map(row=>{

return(

<div
key={row.party}
style={{
background:"#181818",
padding:"14px",
borderRadius:"14px"
}}
>

<div
style={{
display:"flex",
justifyContent:"space-between",
marginBottom:"8px"
}}
>

<div
style={{
display:"flex",
gap:"10px",
alignItems:"center"
}}
>

<div
style={{
width:"10px",
height:"10px",
borderRadius:"50%",
background:
PARTY_COLORS[row.party]
}}
/>

<div
style={{
fontSize:"20px",
fontWeight:700
}}
>
{row.party}
</div>

</div>

<div
style={{
display:"flex",
gap:"18px"
}}
>

<div>
{row.percent.toFixed(1)}%
</div>

<div>
{row.seats} seats
</div>

</div>

</div>


<div
style={{
height:"10px",
background:"#222",
borderRadius:"999px",
overflow:"hidden"
}}
>

<div
style={{
height:"100%",
width:`${row.percent}%`,
background:
PARTY_COLORS[row.party]
}}
/>

</div>

</div>

);

})}

</div>

</div>

);

}