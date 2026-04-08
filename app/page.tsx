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

<div
style={{
display: "flex",
flexDirection: "column",
height: "100%",
width: "100%",
overflow: "auto",
background: "#171717"
}}
>


{/* ===============================
   RECENT ELECTIONS
=============================== */}

<div
style={{
padding: "20px",
borderBottom: "1px solid #333"
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
border: "1px solid #333",
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
border: "1px solid #333",
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
ref={carouselRef}
style={{
display: "flex",
gap: "14px",
overflow: "hidden",
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

<div
style={{
display: "grid",
gridTemplateColumns: "2fr 1fr",
height: "100%"
}}
>


{/* UPCOMING */}

<div
style={{
padding: "20px",
borderRight: "1px solid #333"
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
date="May 2026 (TBC)"
/>

<UpcomingRace
title="Dublin Central By-Election"
subtitle="Dáil Éireann"
date="May 2026 (TBC)"
/>

<UpcomingRace
title="NI Assembly"
subtitle="Assembly Election"
date="First Half 2027"
/>

<UpcomingRace
title="Local Authorities"
subtitle="Northern Ireland"
date="First Half 2027"
/>

</div>

</div>



{/* POLLING */}

<div
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
}) {

const content = (

<div
style={{
minWidth: "260px",
padding: "14px",
borderRadius: "8px",
border: "1px solid #333",
background: "#1a1a1a",
cursor: "pointer",
position: "relative",
display: "flex",
flexDirection: "column",
justifyContent: "space-between",
height: "110px"
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

function UpcomingRace({ title, subtitle, date }) {

return (

<div
style={{
padding: "12px 0",
borderBottom: "1px solid #2a2a2a"
}}
>

<div
style={{
fontWeight: 600
}}
>
{title}
</div>

<div
style={{
fontSize: "12px",
opacity: 0.6
}}
>
{subtitle}
</div>

<div
style={{
fontSize: "11px",
opacity: 0.5
}}
>
{date}
</div>

</div>

);

}



/* ===============================
   POLL LINK
=============================== */

function PollLink({ title, link, comingSoon, data, tracker }) {

const content = (

<div
style={{
padding: "12px 0",
borderBottom: "1px solid #2a2a2a"
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