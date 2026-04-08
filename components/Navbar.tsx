"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
const pathname = usePathname();

if (pathname.startsWith("/broadcast")) {
  return null;
}

const linkStyle = (path: string, exact = false) =>
  `flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
    exact
      ? pathname === path
        ? "bg-gray-800 text-white"
        : "text-gray-300 hover:text-white hover:bg-gray-800"
      : pathname.startsWith(path)
      ? "bg-gray-800 text-white"
      : "text-gray-300 hover:text-white hover:bg-gray-800"
  }`;

return (

<div className="h-[60px] flex items-center px-5 border-b border-gray-800 bg-[#1f1f1f] sticky top-0 z-50 shadow-md">

{/* LEFT */}
<div className="flex items-center">

<Link
href="/"
className="flex items-center gap-3 text-white no-underline"
>

<img
src="/landscape.png"
alt="Ireland Votes"
style={{
height: "45px",
width: "auto"
}}
/>

<div className="flex items-center gap-2">

<span
className="text-xs px-2 py-0.5 rounded-full"
style={{
background: "rgba(255,255,255,0.08)",
color: "#aaa",
fontWeight: 600
}}
>
BETA
</span>

</div>

</Link>

</div>


{/* SPACER */}
<div className="flex-1" />


{/* CENTER */}
<div className="flex items-center gap-3 text-sm font-medium">

<Link href="/" className={linkStyle("/", true)}>
Home
</Link>

<Link 
href="/polling/ireland/dail" 
className={linkStyle("/polling")}
>
Polling
</Link>

<Link 
href="/elections/ireland/dail/2024" 
className={linkStyle("/elections")}
>
Elections
</Link>

<Link 
href="/elections/ireland/dail/2024" 
className={linkStyle("/elections")}
>
Store
</Link>

</div>


{/* SPACER */}
<div className="flex-1" />


{/* RIGHT */}
<div>

<button
className="
w-9 h-9 
rounded-full 
border border-gray-700 
bg-gray-800 
hover:bg-gray-700 
transition 
flex items-center 
justify-center
overflow-hidden
"
>

<svg
viewBox="0 0 24 24"
width="25"
height="25"
fill="#aaa"
>
<path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/>
</svg>

</button>

</div>

</div>

);

}