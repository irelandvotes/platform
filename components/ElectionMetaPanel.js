"use client";

export default function ElectionMetaPanel({ meta, showQuota = true }) {
  if (!meta) return null;

  const turnoutPercent = meta.turnoutPercent || 0;

  const validPercent =
    meta.turnout
      ? (meta.tvp / meta.turnout) * 100
      : 0;

  const spoiltPercent =
    meta.turnout
      ? (meta.spoilt / meta.turnout) * 100
      : 0;

  return (
<div
  style={{
    display: "flex",
    gap: "10px",
    flexWrap: "wrap"
  }}
>

{/* TURNOUT */}
<div
  style={{
    minWidth: "180px",
    flex: 1,
    background: "#2a2a2a",
    borderRadius: "10px",
    padding: "8px",
    fontSize: "11px"
  }}
>

<div
  style={{
    fontSize: "9px",
    opacity: 0.6,
    marginBottom: "3px"
  }}
>
Turnout
</div>

<div
  style={{
    height: "4px",
    background: "#333",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "4px"
  }}
>
<div
  style={{
    width: `${turnoutPercent}%`,
    height: "100%",
    background: "#4caf50"
  }}
/>
</div>

<div style={{ fontWeight: "600" }}>
{meta.turnout?.toLocaleString()} ({turnoutPercent.toFixed(1)}%)
<span
  style={{
    fontWeight: "400",
    opacity: 0.7,
    marginLeft: "4px"
  }}
>
of {meta.electorate?.toLocaleString()}
</span>
</div>

</div>


{/* BALLOTS */}
<div
  style={{
    minWidth: "220px",
    flex: 1,
    background: "#2a2a2a",
    borderRadius: "10px",
    padding: "8px",
    fontSize: "11px"
  }}
>

<div
  style={{
    fontSize: "9px",
    opacity: 0.6,
    marginBottom: "3px"
  }}
>
Ballots
</div>

<div
  style={{
    height: "4px",
    background: "#333",
    borderRadius: "4px",
    overflow: "hidden",
    display: "flex",
    marginBottom: "6px"
  }}
>
<div
  style={{
    width: `${validPercent}%`,
    background: "#2196f3"
  }}
/>

<div
  style={{
    width: `${spoiltPercent}%`,
    background: "#ff5252"
  }}
/>
</div>

<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    fontSize: "10px"
  }}
>

<div>
Valid <b>{meta.tvp?.toLocaleString()}</b>{" "}
({validPercent.toFixed(1)}%)
</div>

<div>
Spoilt <b>{meta.spoilt?.toLocaleString()}</b>{" "}
({spoiltPercent.toFixed(1)}%)
</div>

</div>

</div>


{/* QUOTA */}
{showQuota && (
<div
  style={{
    minWidth: "120px",
    background: "#2a2a2a",
    borderRadius: "10px",
    padding: "8px",
    fontSize: "11px"
  }}
>

<div
  style={{
    fontSize: "9px",
    opacity: 0.6
  }}
>
Quota
</div>

<div
  style={{
    fontWeight: "600",
    marginTop: "2px"
  }}
>
{meta.quota?.toLocaleString()}
</div>

</div>
)}

</div>
  );
}