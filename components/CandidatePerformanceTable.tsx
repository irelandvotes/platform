import HelpTooltip
from "./HelpTooltip";

export default function CandidatePerformanceTable({
  advancedMetrics,
  count,
  current
}: any) {

  return (
    <>
{/* ADVANCED ANALYTICS TABLE */}
{advancedMetrics && (
<div
  style={{
    marginTop: "12px",
    padding: "12px",
    borderRadius: "12px",
    background: "var(--panel)",
    border: "1px solid var(--border)"
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
Candidate Performance
</div>

<div
  style={{
    display: "flex",
    fontSize: "11px",
    color: "var(--text-subtle)",
    marginBottom: "6px"
  }}
>
<div style={{ width: "200px" }}>Candidate</div>
<div style={{ width: "110px", textAlign: "left" }}>Votes this Count</div>
<div style={{ width: "120px", textAlign: "left" }}>Distance from Quota</div>

<div style={{ width: "110px", textAlign: "left" }}>
Transfer Capture
<HelpTooltip text="Percentage of transferable votes captured by this candidate across redistributions." />
</div>

<div style={{ width: "110px", textAlign: "left" }}>
Dependency
<HelpTooltip text="How reliant this candidate was on transfers rather than first preferences." />
</div>

</div>

{advancedMetrics.map((c: any) => {

const prev = current?.data?.counts?.[count - 1]
  ?.find((p: any) => p.name === c.name && p.party === c.party);

const disableScores =
  prev?.status === "elected" ||
  prev?.status === "eliminated";

return (

<div
  key={c.id}
  style={{
    display: "flex",
    alignItems: "center",
    padding: "6px 0",
    borderTop: "1px solid var(--border)",
    fontSize: "11px"
  }}
>

<div
  style={{
    width: "200px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  }}
>

{/* Avatar */}
<div
  style={{
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    background: "var(--panel-2)",
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: "600",
    color: "var(--text-muted)"
  }}
>
{c.name.split(" ").map((n: any) => n[0]).slice(0,2).join("")}
</div>

{/* Name + Party + Status */}
<div style={{ lineHeight: "1.1" }}>

<div>
{c.name}
</div>

<div
  style={{
    fontSize: "10px",
    opacity: 0.6,
    display: "flex",
    gap: "6px"
  }}
>

<span>{c.party || "Ind"}</span>

{c.status === "elected" && (
<span style={{ color: "#4caf50" }}>
Elected
</span>
)}

{c.status === "eliminated" && (
<span style={{ color: "#f44336" }}>
Eliminated
</span>
)}

</div>

</div>

</div>

<div style={{ width: "110px", textAlign: "left" }}>
{c.votes.toLocaleString()}
</div>

<div
  style={{
    width: "120px",
    textAlign: "left",
    color: c.quotaDistance > 0 ? "#4caf50" : "#aaa"
  }}
>
{c.quotaDistance > 0 ? "+" : ""}
{Math.round(c.quotaDistance)}
</div>

<div
  style={{
    width: "110px",
    textAlign: "left"
  }}
>
  {c.transferCaptureRate.toFixed(1)}%
</div>

<div
  style={{
    width: "110px",
    textAlign: "left"
  }}
>
  {c.transferDependency.toFixed(1)}%
</div>

</div>

);

})}

</div>
)}
    </>
  );

}