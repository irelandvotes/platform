"use client";

import { usePathname } from "next/navigation";

export default function ConditionalFooter() {
  const pathname = usePathname();

  if (pathname.startsWith("/broadcast")) {
    return null;
  }

return (
  <footer
    className="
      w-full
      border-t
      border-white/5
      bg-[#1f1f1f]
      text-gray-400
      text-[11px]
      sm:text-xs
      px-4
      sm:px-5
      py-3
    "
  >
    <div
      className="
        max-w-[1400px]
        mx-auto
        flex
        flex-col
        sm:flex-row
        sm:items-center
        gap-2
        sm:gap-1
        leading-relaxed
      "
    >
      <span>
        © {new Date().getFullYear()} Ireland Votes. All rights reserved.
      </span>
    </div>
  </footer>
);
}