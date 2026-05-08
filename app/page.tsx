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
background: "var(--panel)"
}}
>


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
fontSize: "18px",
fontWeight: "600"
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
title="Presidential Election"
type="President"
result="Connolly (IND) 63.4%"
date="24 Oct 2025"
/>

<RecentElection
title="Dáil Éireann"
type="General Election"
result="FF 48 • SF 39 • FG 38"
date="29 Nov 2024"
link="/elections/ireland/dail/2024"
/>

<RecentElection
title="House of Commons (NI)"
type="General Election"
result="SF 7 • DUP 5 • SDLP 2"
date="4 Jul 2024"
/>

<RecentElection
title="Local Authorities (ROI)"
type="Local Elections"
result="FF 248 • FG 245 • SF 102"
date="7 Jun 2024"
/>

<RecentElection
title="European Parliament"
type="European Election"
result="FG 4 • FF 4 • SF 2"
date="7 Jun 2024"
/>

<RecentElection
title="Limerick Mayor"
type="Mayoral Election"
result="Moran (IND) 35.7%"
date="7 Jun 2024"
/>

<RecentElection
title="39th Amendment"
type="Referendum"
result="No 67.7%"
date="8 Mar 2024"
/>

<RecentElection
title="40th Amendment"
type="Referendum"
result="No 73.9%"
date="8 Mar 2024"
/>

<RecentElection
title="Local Authorities (NI)"
type="Local Elections"
result="SF 144 • DUP 122 • AP 67"
date="18 May 2023"
/>

<RecentElection
title="NI Assembly"
type="Assembly Election"
result="SF 27 • DUP 25 • AP 17"
date="5 May 2022"
/>

<RecentElection
title="Dublin Bay South"
type="By-Election"
result="Bacik (LAB) 30.2%"
date="8 Jul 2021"
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
borderRight: "1px solid var(--border)"
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
title="Galway West By-Election"
subtitle="Dáil Éireann"
date="Friday 22 May 2026"
targetDate="2026-05-22"
/>

<UpcomingRace
title="Dublin Central By-Election"
subtitle="Dáil Éireann"
date="Friday 22 May 2026"
targetDate="2026-05-22"
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
padding: "20px"
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
fontSize: "18px",
fontWeight: "600"
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
minWidth: "280px",
flexShrink: 0,
padding: "14px",
borderRadius: "8px",
border: "1px solid var(--border)",
background: "var(--panel)",
cursor: "pointer",
position: "relative",
display: "flex",
flexDirection: "column",
justifyContent: "space-between",
height: "108px",
transition: "all 0.18s ease",
boxShadow: "0 0 0 rgba(0,223,239,0)"
}}
onMouseEnter={(e) => {
const el = e.currentTarget;

el.style.borderColor = "rgba(0,223,239,0.45)";
el.style.boxShadow = "0 0 18px rgba(0,223,239,0.12)";
}}
onMouseLeave={(e) => {
const el = e.currentTarget;

el.style.borderColor = "var(--border)";
el.style.boxShadow = "0 0 0 rgba(0,223,239,0)";
}}
>

{/* TYPE */}

<div
style={{
position: "absolute",
top: "8px",
left: "10px",
fontSize: "9px",
opacity: 0.5,
textTransform: "uppercase",
letterSpacing: "0.04em",
marginLeft: "5px"
}}
>
{type}
</div>

{/* TITLE */}

<div
style={{
fontWeight: 600,
marginBottom: "6px",
marginTop: "14px",
fontSize: "18px"
}}
>
{title}
</div>


{/* RESULT */}

<div
style={{
fontSize: "12px",
opacity: 0.8
}}
>
{result}
</div>


{/* DATE */}

<div
style={{
position: "absolute",
bottom: "8px",
right: "10px",
fontSize: "10px",
opacity: 0.5
}}
>
{date}
</div>

</div>

);

if (link) return <Link href={link}>{content}</Link>;

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
targetDate
}: {
title: string;
subtitle: string;
date: string;
targetDate: string;
}) {

const daysUntil = getDaysUntil(targetDate);

return (

   <div
style={{
padding: "12px 14px",
borderRadius: "8px",
border: "1px solid var(--border)",
cursor: "pointer",
position: "relative",
display: "flex",
flexDirection: "column",
justifyContent: "space-between",
height: "110px",
transition: "all 0.18s ease",
boxShadow: "0 0 0 rgba(0,223,239,0)"
}}
onMouseEnter={(e) => {
const el = e.currentTarget;

el.style.borderColor = "rgba(0,223,239,0.45)";
el.style.boxShadow = "0 0 18px rgba(0,223,239,0.12)";
}}
onMouseLeave={(e) => {
const el = e.currentTarget;

el.style.borderColor = "var(--border)";
el.style.boxShadow = "0 0 0 rgba(0,223,239,0)";
}}
>

{/* TOP ROW */}
<div
style={{
display: "flex",
justifyContent: "space-between",
alignItems: "flex-start",
marginBottom: "8px"
}}
>

<div
style={{
fontSize: "10px",
fontWeight: "600",
opacity: 0.55,
textTransform: "uppercase",
letterSpacing: "0.04em",
}}
>
{subtitle}
</div>

<div
style={{
fontSize: "10px",
padding: "4px 8px",
borderRadius: "999px",
background: "rgba(0,223,239,0.08)",
color: "#00dfef",
border: "1px solid rgba(0,223,239,0.16)"
}}
>
in {daysUntil} days
</div>

</div>

{/* TITLE */}
<div
style={{
fontWeight: 700,
fontSize: "18px",
lineHeight: 1.2,
marginBottom: "10px"
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
marginTop: "auto"
}}
>

<div
style={{
fontSize: "12px",
opacity: 0.6
}}
>
{date}
</div>

<div
style={{
fontSize: "12px",
color: "#00dfef",
fontWeight: "600",
opacity: 0.9
}}
>
View race →
</div>

</div>

</div>

);

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