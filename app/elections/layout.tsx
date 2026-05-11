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

const electionGroups = [

{
  title: "President",
  pages: [
    {
      label: "President 2025",
      href: "/elections/ireland/president/2025"
    }
  ]
},

{
  title: "Dáil Éireann",
  pages: [
    {
      label: "Dublin Central 2026",
      href: "/elections/ireland/dail/2026/dublin-central"
    },
    {
      label: "Galway West 2026",
      href: "/elections/ireland/dail/2026/galway-west"
    },
    {
      label: "Dáil Éireann 2024",
      href: "/elections/ireland/dail/2024"
    },
    {
      label: "Dublin Bay South 2021",
      href: "/elections/ireland/dail/2021/dublin-bay-south"
    }
  ]
},

{
  title: "House of Commons",
  pages: [
    {
      label: "House of Commons 2024",
      href: "/elections/northern-ireland/house-of-commons/2024"
    }
  ]
},

{
  title: "NI Assembly",
  pages: [
    {
      label: "NI Assembly 2022",
      href: "/elections/northern-ireland/assembly/2022"
    }
  ]
},

{
  title: "Referendums",
  pages: [
    {
      label: "40th Amendment Referendum",
      href: "/elections/ireland/referendums/40th"
    },
    {
      label: "39th Amendment Referendum",
      href: "/elections/ireland/referendums/39th"
    }
  ]
}

];

export default function ElectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {

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
borderRight: "1px solid rgba(255,255,255,0.05)",
background: "var(--background)",
backdropFilter: "blur(12px)",
padding: "14px 12px",
overflowY: "auto",
overflowX: "hidden",
position: "relative",
boxShadow: "var(--sidebar-shadow)"
}}
>

{/* LARGE GLOW */}
<div
  style={{
    position: "absolute",
    top: "-50px",
    right: "-150px",
    width: "680px",
    height: "850px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, var(--hero-glow), transparent 72%)",
    pointerEvents: "none",
    zIndex: 0
  }}
/>

{/* CONTENT */}
<div
style={{
position: "relative",
zIndex: 1
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

{electionGroups.map((group) => (

<div
  key={group.title}
  style={{
    marginBottom: "18px"
  }}
>

{/* GROUP TITLE */}
<div
  style={{
display: "flex",
alignItems: "center",
gap: "8px",
fontSize: "12px",
fontWeight: "700",
letterSpacing: "0.5px",
opacity: 0.75,
marginBottom: "10px",
paddingLeft: "4px"
  }}
>
<div
style={{
height: "1px",
width: "14px",
background: "rgb(100, 100, 100)"
}}
/>

{group.title}
</div>

{/* LINKS */}
{group.pages.map((election) => (

<ElectionLink
  key={election.href}
  href={election.href}
  label={election.label}
  pathname={pathname}
/>

))}

</div>

))}

</div>

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
}: {
  href: string;
  label: string;
  pathname: string;
}) {

const active = pathname.startsWith(href);

return (

<Link
href={href}
style={{
display: "block",
position: "relative",
padding: "11px 12px 11px 14px",
borderRadius: "12px",
marginBottom: "8px",
background: active
  ? "var(--glass-active)"
  : "var(--glass-bg)",
border: active
  ? "1px solid var(--glass-border-strong)"
  : "1px solid transparent",
overflow: "hidden",
transition: "all 0.16s ease",
transform: active
  ? "translateX(2px)"
  : "translateX(0)"
}}
onMouseEnter={(e) => {

if (active) return;

e.currentTarget.style.background =
  "var(--glass-hover)";

e.currentTarget.style.border =
  "1px solid var(--glass-border)";

}}
onMouseLeave={(e) => {

if (active) return;

e.currentTarget.style.background =
  "rgba(255,255,255,0.015)";

e.currentTarget.style.border =
  "1px solid transparent";

}}
>

{/* ACTIVE STRIP */}
{active && (
<div
style={{
position: "absolute",
left: 0,
top: 0,
bottom: 0,
width: "3px",
background:
  "linear-gradient(180deg, #00dfef, #80deea)"
}}
/>
)}

<div
style={{
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: "8px"
}}
>

<div
style={{
fontSize: "13px",
fontWeight: active ? "700" : "550",
letterSpacing: "-0.1px",
color: "var(--text)"
}}
>
{label}
</div>

{active && (
<div
style={{
fontSize: "9px",
fontWeight: "800",
letterSpacing: "0.7px",
textTransform: "uppercase",
color: "#80deea"
}}
>
VIEWING
</div>
)}

</div>

</Link>

);

}