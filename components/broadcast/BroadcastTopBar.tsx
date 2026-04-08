"use client";

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
  IND: "#7a7a7a"
};

export default function BroadcastTopBar({
  name,
  results
}) {

/* Get First Count Data */

const data = results?.[name]?.counts?.[1] || [];

/* Calculate Leading Party */

const totals = {};

data.forEach(c => {
const party = c.party || "IND";
totals[party] = (totals[party] || 0) + (c.votes || 0);
});

const leader =
Object.keys(totals).length
? Object.entries(totals)
.sort((a,b) => b[1] - a[1])[0][0]
: null;

const seats = data?.[0]?.seats || "";

/* Fallback Colour */

const background =
leader && PARTY_COLORS[leader]
? PARTY_COLORS[leader]
: "#333";

return (

<div
style={{
height: "70px",
background,
display: "flex",
alignItems: "center",
justifyContent: "space-between",
padding: "0 30px",
fontWeight: "700",
letterSpacing: "1px",
transition: "background 0.6s ease"
}}
>

{/* LEFT — CONSTITUENCY */}

<div
style={{
fontSize: "26px",
textTransform: "uppercase"
}}
>
{name || ""}
</div>


{/* RIGHT — SEATS */}

<div
style={{
fontSize: "20px",
opacity: 0.9
}}
>
{seats ? `${seats} SEATS` : ""}
</div>

</div>

);

}