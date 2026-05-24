"use client";

import Link from "next/link";
import { useRef } from "react";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import SidebarPreview from "@/components/SidebarPreview";
import { buildPollingAverage } from "@/lib/pollingAggregate";

export default function Home() {
const [dailData, setDailData] = useState<any[]>([]);
const [niData, setNiData] = useState<any[]>([]);
const carouselRef = useRef<HTMLDivElement | null>(null);

const scrollLeft = () => {
carouselRef.current?.scrollBy({
left: -300,
behavior: "smooth"
});
};

const scrollRight = () => {
carouselRef.current?.scrollBy({
left: 300,
behavior: "smooth"
});
};

useEffect(() => {

fetch("/data/polling/ireland/dail/polls.csv")
.then(res => res.text())
.then(text => {

const result = Papa.parse(text, {
header: true,
dynamicTyping: true,
skipEmptyLines: true
});

const parsed = (result.data as any[])
.filter(p => p.date)
.map(p => ({
...p,
date: new Date(p.date)
}));

const aggregated =
buildPollingAverage(parsed, "dail");

setDailData(aggregated);

});

}, []);

useEffect(() => {

fetch("/data/polling/northern-ireland/assembly/polls.csv")
.then(res => res.text())
.then(text => {

const result = Papa.parse(text, {
header: true,
dynamicTyping: true,
skipEmptyLines: true
});

const parsed = (result.data as any[])
.filter((p) => p.date)
.map((p) => ({
...p,
date: new Date(p.date)
}));

const aggregated =
buildPollingAverage(parsed, "ni");

setNiData(aggregated);

});

}, []);

return (
<>
<div
className="home-page"
style={{
display: "flex",
flexDirection: "column",
height: "100%",
width: "100%",
overflow: "auto",
}}
>

{/* ===============================
   HERO
=============================== */}

<div
style={{
position: "relative",
overflow: "hidden",
padding: "42px 28px 34px 28px",
borderBottom: "1px solid var(--border)",
isolation: "isolate"
}}
>

{/* BACKGROUND GLASS */}
<div
style={{
position: "absolute",
inset: 0,
background: "var(--sidebar-bg)",
backdropFilter: "blur(12px)",
zIndex: 0
}}
/>

{/* LARGE GLOW */}
<div
style={{
position: "absolute",
top: "-220px",
right: "-120px",
width: "680px",
height: "680px",
borderRadius: "50%",
background:
  "radial-gradient(circle, var(--hero-glow-strong), transparent 72%)",
pointerEvents: "none",
zIndex: 1
}}
/>

{/* SECONDARY GLOW */}
<div
style={{
position: "absolute",
bottom: "-340px",
left: "-220px",
width: "820px",
height: "820px",
borderRadius: "50%",
background:
  "radial-gradient(circle, var(--hero-glow), transparent 72%)",
pointerEvents: "none",
zIndex: 1
}}
/>

{/* CONTENT */}
<div
style={{
position: "relative",
zIndex: 2,
maxWidth: "860px"
}}
>

<div
style={{
fontSize: "52px",
fontWeight: "800",
lineHeight: 1,
letterSpacing: "-2px",
marginBottom: "18px"
}}
>
Welcome to Ireland Votes
</div>

<div
style={{
fontSize: "18px",
lineHeight: 1.6,
opacity: 0.78,
maxWidth: "760px"
}}
>
The new home for Irish political data.
</div>

<div
style={{
display: "flex",
gap: "12px",
marginTop: "26px",
flexWrap: "wrap"
}}
>

<Link
href="/elections"
style={{
padding: "10px 16px",
borderRadius: "10px",
background:
  "linear-gradient(180deg, var(--soft-highlight), transparent)",
border: "1px solid var(--hover-border)",
color: "var(--text)",
fontSize: "13px",
fontWeight: "700"
}}
>
Explore Elections
</Link>

<Link
href="/polling/ireland/dail"
style={{
padding: "10px 16px",
borderRadius: "10px",
border: "1px solid var(--border)",
backdropFilter: "blur(10px)",
fontSize: "13px",
fontWeight: "600"
}}
>
View Polling Aggregates
</Link>

</div>

</div>

</div>

{/* ===============================
   RECENT ELECTIONS
=============================== */}

<div
className="home-section"
style={{
padding: "20px",
borderBottom: "1px solid var(--border)"
}}
>

<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
marginBottom: "12px"
}}
>

<div
style={{
fontSize: "22px",
fontWeight: "750",
letterSpacing: "-0.4px"
}}
>
Recent Elections
</div>


<div
style={{
display: "flex",
alignItems: "center",
gap: "8px"
}}
>

<button
onClick={scrollLeft}
style={{
background: "transparent",
border: "1px solid var(--border)",
borderRadius: "6px",
padding: "4px 8px",
cursor: "pointer"
}}
>
‹
</button>

<button
onClick={scrollRight}
style={{
background: "transparent",
border: "1px solid var(--border)",
borderRadius: "6px",
padding: "4px 8px",
cursor: "pointer"
}}
>
›
</button>

<Link
href="/elections"
style={{
fontSize: "12px",
opacity: 0.7,
marginLeft: "8px"
}}
>
See all →
</Link>

</div>

</div>


<div
className="recent-carousel"
ref={carouselRef}
style={{
display: "flex",
gap: "14px",
overflowX: "auto",
scrollBehavior: "smooth"
}}
>

<RecentElection
title="Dublin Central"
type="By-Election"
result="Daniel Ennis (SD) won the race"
date="22 May 2026"
link="/elections/ireland/dail/2026/dublin-central"
/>

<RecentElection
title="Galway West"
type="By-Election"
result="Former TD Seán Kyne (FG) won the race"
date="22 May 2026"
link="/elections/ireland/dail/2026/galway-west"
/>

<RecentElection
title="Presidential Election"
type="President"
result="Connolly won with 63.4% of the vote"
date="24 Oct 2025"
link="/elections/ireland/president/2025"
/>

<RecentElection
title="Dáil Éireann"
type="General Election"
result="FF emerged as the largest party"
date="29 Nov 2024"
link="/elections/ireland/dail/2024"
/>

<RecentElection
title="House of Commons (NI)"
type="General Election"
result="Sinn Féin won 7 seats, DUP retained 5"
date="4 Jul 2024"
link="/elections/northern-ireland/house-of-commons/2024"
/>

<RecentElection
title="39th Amendment"
type="Referendum"
result="Proposal rejected by 67.7% of voters"
date="8 Mar 2024"
link="/elections/ireland/referendum/39th"
/>

<RecentElection
title="40th Amendment"
type="Referendum"
result="Proposal rejected by 73.9% of voters"
date="8 Mar 2024"
link="/elections/ireland/referendum/40th"
/>

<RecentElection
title="NI Assembly"
type="Assembly Election"
result="SF became the largest party at Stormont"
date="5 May 2022"
link="/elections/northern-ireland/assembly/2022"
/>

<RecentElection
title="Dublin Bay South"
type="By-Election"
result="Ivana Bacik won the seat for Labour"
date="8 Jul 2021"
link="/elections/ireland/dail/2021/dublin-bay-south"
/>

</div>

</div>



{/* ===============================
   MAIN GRID
=============================== */}

<div className="home-grid">


{/* UPCOMING */}

<div
className="home-main-column"
style={{
padding: "20px",
borderRight: "1px solid var(--border)",
background: "var(--background)",
backdropFilter: "blur(12px)"
}}
>

<div
style={{
fontSize: "25px",
fontWeight: "600",
marginBottom: "14px"
}}
>
Upcoming Elections
</div>


<div
style={{
display: "flex",
flexDirection: "column",
gap: "12px"
}}
>

<UpcomingRace
title="Cultural and Educational Panel By-Education"
subtitle="Seanad Éireann"
date="On or before 21 December 2026"
targetDate="2026-12-21"
/>

<UpcomingRace
title="NI Assembly"
subtitle="Assembly Election"
date="On or before Thursday 6 May 2027"
targetDate="2027-05-06"
/>

<UpcomingRace
title="Local Authorities"
subtitle="Northern Ireland"
date="On or before Thursday 6 May 2027"
targetDate="2027-05-06"
/>

</div>

</div>



{/* POLLING */}

<div
className="home-sidebar"
style={{
padding: "20px",
background: "var(--background)",
backdropFilter: "blur(12px)"
}}
>

<div
style={{
display: "flex",
justifyContent: "space-between",
marginBottom: "14px"
}}
>

<div
style={{
fontSize: "22px",
fontWeight: "750",
letterSpacing: "-0.4px"
}}
>
Polling
</div>

<Link
href="/polling"
style={{
fontSize: "12px",
opacity: 0.7
}}
>
See all →
</Link>

</div>


<div
style={{
display: "flex",
flexDirection: "column",
gap: "12px"
}}
>

<PollLink
title="Dáil Éireann"
link="/polling/ireland/dail"
data={dailData}
tracker="dail"
/>

<PollLink
title="NI Assembly"
link="/polling/northern-ireland/assembly"
data={niData}
tracker="ni"
/>

<PollLink
title="Taoiseach Approval"
comingSoon
/>

</div>

</div>


</div>


</div>

<style jsx global>{`

  .recent-carousel::-webkit-scrollbar {
    display: none;
  }

  .recent-carousel {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
.home-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  flex: 1;
  min-height: 0;
}

  @media (max-width: 900px) {

    .home-grid {
      grid-template-columns: 1fr;
      gap: 0;
    }

    .home-sidebar {
      border-top: none;
      background: var(--panel);
      padding: 18px 16px !important;
    }

    .home-main-column {
      border-right: none !important;
      border-bottom: 1px solid var(--border);
      padding: 18px 16px !important;
    }

    .home-main-column,
    .home-sidebar {
      width: 100%;
      max-width: 100%;
    }

    .recent-carousel {
      overflow-x: auto !important;
      padding-bottom: 4px;
      scroll-snap-type: x proximity;
    }

    .recent-carousel > * {
      scroll-snap-align: start;
    }

    .home-section {
      padding: 16px !important;
    }

  }

`}</style>

</>

);
}



/* ===============================
   RECENT ELECTION
=============================== */

function RecentElection({
title,
type,
result,
date,
link
}: {
title: string;
type: string;
result: string;
date: string;
link?: string;
}) {

const content = (

<div
style={{
minWidth: "300px",
flexShrink: 0,
padding: "18px",
borderRadius: "16px",
border: "1px solid var(--glass-border)",
background: "var(--sidebar-bg)",
backdropFilter: "blur(12px)",
cursor: link ? "pointer" : "default",
position: "relative",
display: "flex",
flexDirection: "column",
justifyContent: "space-between",
height: "132px",
overflow: "hidden",
transition: "all 0.16s ease",
boxShadow: "0 0 0 rgba(0,223,239,0)"
}}
onMouseEnter={(e) => {

const el = e.currentTarget;

el.style.borderColor = "var(--hover-border)";
el.style.boxShadow =
  "0 0 18px rgba(0,223,239,0.10)";

}}
onMouseLeave={(e) => {

const el = e.currentTarget;

el.style.borderColor = "var(--glass-border)";
el.style.boxShadow =
  "0 0 0 rgba(0,223,239,0)";

}}
>

{/* SUBTLE GLOW */}
<div
style={{
position: "absolute",
top: "-80px",
right: "-40px",
width: "180px",
height: "180px",
borderRadius: "50%",
background: "var(--hero-glow)",
filter: "blur(55px)",
opacity: 0.45,
pointerEvents: "none"
}}
/>

{/* TOP */}
<div
style={{
position: "relative",
zIndex: 1
}}
>

<div
style={{
fontSize: "10px",
fontWeight: "400",
textTransform: "uppercase",
opacity: 0.55,
marginBottom: "12px"
}}
>
{type}
</div>

<div
style={{
fontWeight: 750,
fontSize: "20px",
lineHeight: 1.1,
letterSpacing: "-0.5px",
marginBottom: "10px"
}}
>
{title}
</div>

<div
style={{
fontSize: "13px",
lineHeight: 1.45,
opacity: 0.78,
fontWeight: "500"
}}
>
{result}
</div>

</div>

{/* FOOTER */}
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
marginTop: "8px",
position: "relative",
zIndex: 1
}}
>

<div
style={{
fontSize: "11px",
opacity: 0.5,
fontWeight: "500"
}}
>
{date}
</div>

{link && (
<div
style={{
fontSize: "12px",
fontWeight: "700",
color: "#00dfef"
}}
>
View →
</div>
)}

</div>

</div>

);

if (link) {
return (
<Link
href={link}
style={{
textDecoration: "none",
color: "inherit"
}}
>
{content}
</Link>
);
}

return content;

}

/* ===============================
   UPCOMING RACE
=============================== */

function getDaysUntil(dateString: string) {

const today = new Date();
const target = new Date(dateString);

today.setHours(0,0,0,0);
target.setHours(0,0,0,0);

const diff =
  target.getTime() - today.getTime();

return Math.ceil(
  diff / (1000 * 60 * 60 * 24)
);

}

function UpcomingRace({
title,
subtitle,
date,
targetDate,
link
}: {
title: string;
subtitle: string;
date: string;
targetDate: string;
link?: string;
}) {

const daysUntil = getDaysUntil(targetDate);

const content = (

<div
style={{
padding: "14px 16px",
borderRadius: "16px",
border: "1px solid var(--glass-border)",
background: "var(--glass-bg)",
backdropFilter: "blur(12px)",
cursor: link ? "pointer" : "default",
position: "relative",
display: "flex",
flexDirection: "column",
justifyContent: "space-between",
height: "118px",
overflow: "hidden",
transition: "all 0.18s ease",
boxShadow: "0 0 0 rgba(0,223,239,0)",
}}
onMouseEnter={(e) => {

if (!link) return;

const el = e.currentTarget;

el.style.borderColor = "var(--hover-border)";
el.style.boxShadow =
  "0 0 22px rgba(0,223,239,0.12)";

}}
onMouseLeave={(e) => {

if (!link) return;

const el = e.currentTarget;

el.style.borderColor = "var(--glass-border)";
el.style.boxShadow =
  "0 0 0 rgba(0,223,239,0)";

}}
>

{/* GLOW */}
<div
style={{
position: "absolute",
top: "-60px",
right: "-60px",
width: "180px",
height: "180px",
borderRadius: "50%",
background: "var(--hero-glow)",
filter: "blur(55px)",
opacity: 0.55,
pointerEvents: "none"
}}
/>

{/* TOP ROW */}
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "flex-start",
marginBottom: "10px",
position: "relative",
zIndex: 1
}}
>

<div
style={{
fontSize: "10px",
fontWeight: "400",
opacity: 0.58,
textTransform: "uppercase"
}}
>
{subtitle}
</div>

<div
style={{
fontSize: "10px",
padding: "4px 8px",
borderRadius: "999px",
background: "var(--soft-highlight)",
border: "1px solid var(--hover-border)",
fontWeight: "400",
backdropFilter: "blur(10px)"
}}
>
in {daysUntil} days
</div>

</div>

{/* TITLE */}
<div
style={{
fontWeight: 750,
fontSize: "20px",
lineHeight: 1.15,
letterSpacing: "-0.5px",
marginBottom: "12px",
position: "relative",
zIndex: 1
}}
>
{title}
</div>

{/* FOOTER */}
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "center",
marginTop: "auto",
position: "relative",
zIndex: 1
}}
>

<div
style={{
fontSize: "12px",
opacity: 0.6,
fontWeight: "500"
}}
>
{date}
</div>

{link && (
<div
style={{
fontSize: "12px",
fontWeight: "700",
color: "#00dfef"
}}
>
View race →
</div>
)}

</div>

</div>

);

if (link) {
return (
<Link
href={link}
style={{
textDecoration: "none",
color: "inherit"
}}
>
{content}
</Link>
);
}

return content;

}



/* ===============================
   POLL LINK
=============================== */

function PollLink({ title, link, comingSoon, data, tracker }: { title: string; link?: string; comingSoon?: boolean; data?: any; tracker?: any }) {

const content = (

<div
style={{
padding: "12px 0",
borderBottom: "1px solid var(--border)"
}}
>

<div
style={{
fontWeight: 600,
marginBottom: "4px"
}}
>
{title}
</div>

{data && (
<SidebarPreview
data={data}
tracker={tracker}
/>
)}

{comingSoon && (
<div
style={{
fontSize: "11px",
opacity: 0.5
}}
>
Coming soon
</div>
)}

</div>

);

if (link) return <Link href={link}>{content}</Link>;

return content;

}