"use client";

import { useState, useEffect } from "react";

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

  SDLP: "#1a5c1d",
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

export default function BroadcastTopBar({
scene,
results
}:{
scene:any;
results:any;
}){

const [isFullscreen,setIsFullscreen]=
useState(false);

useEffect(()=>{

const handler=()=>{

setIsFullscreen(
!!document.fullscreenElement
);

};

document.addEventListener(
"fullscreenchange",
handler
);

return()=>{

document.removeEventListener(
"fullscreenchange",
handler
);

};

},[]);

function toggleFullscreen(){

if(!document.fullscreenElement){

document.documentElement
.requestFullscreen()
.catch(()=>{});

}else{

document.exitFullscreen();

}

}

const isNational=
scene.type==="national";

const name=
isNational
?"National Overview"
:scene.name;

const counts=
results?.[scene.name]?.counts;

const count=
counts
?Math.max(
...Object.keys(counts)
.map(Number)
)
:1;

const latest=
counts?.[count]||[];

const seats=
latest?.[0]?.seats || "–";

const elected=
latest.filter(
(c:any)=>
c.status==="elected"
).length;

const leader=
latest.length
?[...latest]
.sort(
(a:any,b:any)=>
b.votes-a.votes
)[0]
:null;

const accent=
leader
?PARTY_COLORS[
leader.party
] || "#00dfef"
:"#00dfef";

return(

<div
style={{

height:"82px",
minHeight:"82px",
flexShrink:0,

padding:"0 34px",

display:"flex",
alignItems:"center",
justifyContent:"space-between",

background:`
linear-gradient(
90deg,
rgba(15,15,15,.96),
rgba(15,15,15,.85)
)
`,

borderBottom:
"1px solid rgba(255,255,255,.08)",

backdropFilter:
"blur(18px)",

position:"relative",

overflow:"hidden"
}}
>

{/* accent glow */}

<div
style={{
position:"absolute",
top:-50,
right:-120,
width:500,
height:200,
borderRadius:"50%",
background:
`radial-gradient(circle,
${accent}33,
transparent 70%)`,
pointerEvents:"none"
}}
/>

{/* LEFT */}

<div
style={{
display:"flex",
alignItems:"center",
gap:"18px",
zIndex:2
}}
>

<div
style={{
display:"flex",
alignItems:"center",
gap:"8px"
}}
>

<div
style={{
width:"11px",
height:"11px",
borderRadius:"50%",
background:"#ff5252",
animation:
"blink 2s infinite",
marginTop: "4px"
}}
/>

</div>

<div>

<div
style={{
fontSize:"40px",
fontWeight:800,
letterSpacing:"-1px",
lineHeight:1
}}
>
{name}
</div>

</div>

</div>


{/* RIGHT */}

<div
style={{
display:"flex",
alignItems:"center",
gap:"14px",
zIndex:2
}}
>

<Card
label="LATEST COUNT"
value={count}
/>

{!isNational && (

<Card
label="SEATS DECLARED"
value={`${elected}/${seats}`}
/>

)}

<button
onClick={toggleFullscreen}
style={{

height:"60px",
padding:"0 18px",

borderRadius:"14px",

background: "rgba(255,255,255,.04)",

border: "1px solid rgba(255,255,255,.08)",

backdropFilter:
"blur(12px)",

boxShadow:
"0 8px 24px rgba(0,0,0,.25)",

color:"#fff",

fontSize:"12px",
fontWeight:800,

letterSpacing:"1px",

cursor:"pointer",

transition:"all .25s ease"
}}

onMouseEnter={(e)=>{

e.currentTarget.style.transform=
"translateY(-1px)";

}}

onMouseLeave={(e)=>{

e.currentTarget.style.transform=
"translateY(0px)";

}}
>

<div
style={{
display:"flex",
flexDirection:"column",
alignItems:"center",
justifyContent:"center",
gap:"2px"
}}
>

<div
style={{
fontSize:"18px",
lineHeight:1
}}
>
{isFullscreen ? "⤢" : "⛶"}
</div>

</div>

</button>

</div>

</div>

);

}


function Card({
label,
value
}:{
label:string;
value:string|number;
}){

return(

<div
style={{

minWidth:"90px",
height:"60px",

padding:"10px 16px",

borderRadius:"14px",

background:
"rgba(255,255,255,.04)",

border:
"1px solid rgba(255,255,255,.08)",

backdropFilter:
"blur(12px)",

boxShadow:
"0 8px 24px rgba(0,0,0,.25)"
}}
>

<div
style={{
fontSize:"10px",
letterSpacing:"1.5px",
opacity:.55
}}
>
{label}
</div>

<div
style={{
fontSize:"20px",
fontWeight:800,
marginTop: "-4px"
}}
>
{value}
</div>

</div>

);

}