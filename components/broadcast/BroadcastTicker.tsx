"use client";

export default function BroadcastTicker({
results
}:{
results:Record<string,any>
}) {

const items=[

"Ireland Votes Projection: Fianna Fáil to be the largest party, Sinn Féin second",
"Ireland Votes Projection: Social Democrats and Labour to double seats",
"Ireland Votes Projection: Greens to lose all seats but one, party leader Roderic O'Gorman in Dublin West",
"Visit www.irelandvotes.com for the full results"


];

return(

<div
style={{
height:"42px",
background:"#0b0b0b",
borderTop:
"1px solid rgba(255,255,255,.06)",
overflow:"hidden",
display:"flex",
alignItems:"center"
}}
>

<div
style={{
display:"flex",
gap:"60px",
whiteSpace:"nowrap",
animation:
"scroll 35s linear infinite"
}}
>

{[...items,...items].map(
(text,i)=>(

<div key={i}>
{text}
</div>

))

}

</div>

</div>

);

}