"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 900);
    };

    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}

/* ===============================
   ELECTION PAGES
=============================== */

const electionPages = [
{
label: "President 2025",
href: "/elections/ireland/president/2025"
},
{
label: "Dáil Éireann 2024",
href: "/elections/ireland/dail/2024"
},
{
label: "Dáil Éireann 2020",
href: "/elections/ireland/dail/2020"
}
];


export default function ElectionsLayout({ children }) {

const pathname = usePathname();
const isMobile = useIsMobile();

return (

<div
style={{
display: "flex",
height: "100%",
width: "100%",
flexDirection: "row"
}}
>

{/* SIDEBAR */}

{!isMobile && (
<div
style={{
width: "260px",
flexShrink: 0,
borderRight: "1px solid #333",
background: "#1a1a1a",
padding: "12px",
overflowY: "auto"
}}
>

<div
style={{
fontSize: "16px",
fontWeight: "700",
marginBottom: "12px",
opacity: 0.9,
marginLeft: "5px"
}}
>
Featured
</div>

{electionPages.map((election) => (

<ElectionLink
key={election.href}
href={election.href}
label={election.label}
pathname={pathname}
/>

))}

</div>
)}


{/* MAIN CONTENT */}

<div
style={{
flex: 1,
overflow: "auto",
width: "100%"
}}
>

{children}

</div>

</div>

);

}


/* ===============================
   ELECTION LINK
=============================== */

function ElectionLink({
href,
label,
pathname
}) {

const active = pathname.startsWith(href);

return (

<Link
href={href}
style={{
display: "block",
padding: "12px",
borderRadius: "10px",
marginBottom: "8px",
background: active ? "#2a2a2a" : "#1f1f1f",
border: "1px solid #333",
fontSize: "13px",
fontWeight: active ? "600" : "500",
cursor: "pointer",
transition: "0.15s"
}}
>

{label}

</Link>

);

}