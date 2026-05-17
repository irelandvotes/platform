import AboutSection from "../AboutSection";

export default function MethodologyPage() {
return (

<AboutSection
title="Methodology"
subtitle="How Ireland Votes crunches the numbers."
>

<div
style={{
marginBottom:"60px",
padding:"18px 22px",
borderRadius:"16px",
background:"var(--glass-bg)",
border:"1px solid var(--border)"
}}
>

<div
style={{
fontWeight:700,
marginBottom:"8px"
}}
>
Important
</div>

<div
style={{
opacity:.8,
fontSize:"15px",
lineHeight:1.8
}}
>
Ireland Votes methodology is periodically reviewed and may evolve over time as new electoral,
constituency and polling data becomes available.
</div>

</div>

<h2
style={{
fontSize:"32px",
fontWeight:800,
marginTop:0,
marginBottom:"22px"
}}
>
1. Notional Changes
</h2>


For some elections, direct comparisons with previous results
can become misleading because constituency boundaries or seat
allocations changed between elections.



Ireland Votes thus produces <b>notional estimates</b> to create a
more meaningful baseline for comparison.


<div
style={{
margin:"26px 0",
padding:"20px",
borderRadius:"16px",
background:"var(--glass-bg)",
border:"1px solid var(--border)",
fontStyle:"italic",
fontSize:"18px"
}}
>
“If the previous election had been fought under the revised
electoral arrangements, what would the likely result have been?”
</div>


These figures are analytical estimates rather than official
historical results. For the official result of a previous election, where available,
you can view the results of that election on irelandvotes.com.



{/* TIMELINE SECTION */}

<div
style={{
position:"relative",
marginTop:"40px",
marginLeft:"10px",
paddingLeft:"36px"
}}
>

{/* vertical rail */}

<div
style={{
position:"absolute",
left:0,
top:0,
bottom:0,
width:"2px",
borderRadius:"999px",
background:
`linear-gradient(
180deg,
rgba(0,223,239,.7),
rgba(0,223,239,.15)
)`
}}
/>


{/* ITEM 1 */}

<div
style={{
position:"relative",
paddingBottom:"52px"
}}
>

<div
style={{
position:"absolute",
left:"-42px",
top:"10px",

width:"14px",
height:"14px",
marginTop: "7px",
borderRadius:"50%",

background:"#00dfef",

boxShadow:
"0 0 18px rgba(0,223,239,.5)"
}}
/>

<h3
style={{
fontSize:"24px",
fontWeight:700,
marginTop:0,
marginBottom:"14px"
}}
>
Where constituency boundaries have been redrawn
</h3>

Where constituency boundaries change, Ireland Votes estimates
how votes from previous elections would likely have translated
into the revised constituency map.

<br /><br />

Areas transferred between constituencies are identified and
mapped to their historical electoral geography where possible.
Past voting patterns are then redistributed into the new
constituency structure.

<br /><br />

Using these estimates, the previous election is effectively
re-run under the revised map and seat totals to generate
a projected notional outcome.

<br /><br />

As revised constituencies can combine areas with differing
political characteristics, these estimates should be viewed
as informed approximations rather than exact reconstructions.


</div>


{/* ITEM 2 */}

<div
style={{
position:"relative"
}}
>

<div
style={{
position:"absolute",
left:"-42px",
top:"10px",

width:"14px",
height:"14px",
marginTop: "7px",
borderRadius:"50%",

background:"#00dfef",

boxShadow:
"0 0 18px rgba(0,223,239,.5)"
}}
/>

<h3
style={{
fontSize:"24px",
fontWeight:700,
marginTop:0,
marginBottom:"14px"
}}
>
Where boundaries remain unchanged but seat totals change
</h3>


In some elections, constituency boundaries remain identical
while the number of representatives elected changes.

<br /><br />

One example is the 2017 Northern Ireland Assembly election,
where constituencies remained geographically unchanged but
moved from electing six members to five.

<br /><br />

In these situations, Ireland Votes retains the original vote
totals but re-runs the election using the revised seat
allocation.

<br /><br />

For Single Transferable Vote elections, quota and seat totals
are recalculated before estimating how candidates and parties
would likely have performed under the revised structure.

<br /><br />

This creates a baseline reflecting the electoral conditions
actually used at the subsequent election.


</div>

</div>


<h2
style={{
fontSize:"32px",
fontWeight:800,
marginTop:"80px",
marginBottom:"22px"
}}
>
2. The Ireland Votes Aggregate
</h2>

The Ireland Votes Aggregate is a rolling polling model designed
to estimate the underlying level of support for political parties
and electoral blocs at a given point in time.

<br /><br />

Individual polls provide snapshots of opinion, but each survey
contains unavoidable statistical noise arising from sampling
variation, fieldwork timing, methodology and random error.
As a result, individual polls can occasionally overstate or
understate underlying support. Thus, rather than treating any one survey as determinative, the
aggregate combines multiple publicly available polls to identify
the broader signal within the polling environment.

<br /><br />

Polls enter the model on a rolling basis, with observations
weighted according to recency. More recent fieldwork carries
greater influence than older surveys, allowing the aggregate
to respond to genuine shifts in public opinion while reducing
the effect of temporary volatility.

<br /><br />

The model is designed to smooth short-term fluctuations and
limit the influence of isolated outlier polls which may arise
through sampling variation or methodological effects. This
produces a more stable estimate of trend movement over time.

<br /><br />

No explicit turnout assumptions, constituency-level modelling
or seat projections are incorporated into the aggregate itself.
Its purpose is to estimate current vote intention rather than
forecast electoral outcomes.

<br /><br />

As new polling becomes available, historical estimates may
adjust modestly as additional information enters the rolling
series.

</AboutSection>
);
}