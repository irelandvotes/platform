"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
const pathname = usePathname();

const [theme, setTheme] = useState("dark");

useEffect(() => {
  const saved = localStorage.getItem("theme");

  if (saved) {
    setTheme(saved);
    document.documentElement.classList.toggle(
      "dark",
      saved === "dark"
    );
  }
}, []);

const toggleTheme = () => {
  const newTheme =
    theme === "dark" ? "light" : "dark";

  setTheme(newTheme);

  localStorage.setItem("theme", newTheme);

  document.documentElement.classList.toggle(
    "dark",
    newTheme === "dark"
  );
};

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

<div
className="h-[60px] flex items-center px-5 sticky top-0 z-50 shadow-md"
style={{
  background: "var(--panel)",
  borderBottom: "1px solid var(--border)"
}}
>

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
width: "auto",
filter: "var(--logo-filter)"
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

</div>


{/* SPACER */}
<div className="flex-1" />


{/* RIGHT */}
<div className="flex items-center gap-2">

{/* THEME TOGGLE */}
<button
onClick={toggleTheme}
className="
w-9 h-9 
rounded-full 
border border-gray-700 
bg-gray-800 
hover:bg-gray-700 
transition 
flex items-center 
justify-center
"
title="Toggle theme"
>

{theme === "dark" ? (

/* Sun Icon */
<svg
viewBox="0 0 24 24"
width="18"
height="18"
fill="#aaa"
>
<path d="M12 4.5a1 1 0 011 1V7a1 1 0 11-2 0V5.5a1 1 0 011-1zm0 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm7.5-3.5a1 1 0 011 1 1 1 0 01-1 1H18a1 1 0 110-2h1.5zM6 12a1 1 0 11-2 0 1 1 0 012 0zm10.95-5.95a1 1 0 011.41 0 1 1 0 010 1.41l-1.06 1.06a1 1 0 11-1.41-1.41l1.06-1.06zM7.7 16.3a1 1 0 011.41 0 1 1 0 010 1.41l-1.06 1.06a1 1 0 11-1.41-1.41L7.7 16.3zM18.36 18.36a1 1 0 01-1.41 0l-1.06-1.06a1 1 0 011.41-1.41l1.06 1.06a1 1 0 010 1.41zM7.05 7.05a1 1 0 01-1.41 0L4.58 5.99a1 1 0 111.41-1.41l1.06 1.06a1 1 0 010 1.41z"/>
</svg>

) : (

/* Moon Icon */
<svg
viewBox="0 0 24 24"
width="18"
height="18"
fill="#aaa"
>
<path d="M21.64 13.65A9 9 0 1110.35 2.36 7 7 0 0021.64 13.65z"/>
</svg>

)}

</button>


{/* PROFILE BUTTON */}
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