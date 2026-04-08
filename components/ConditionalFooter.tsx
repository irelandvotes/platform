"use client";

import { usePathname } from "next/navigation";

export default function ConditionalFooter() {
  const pathname = usePathname();

  if (pathname.startsWith("/broadcast")) {
    return null;
  }

  return (
    <div className="h-[28px] flex items-center px-5 border-t border-gray-800 bg-[#1f1f1f] text-xs text-gray-400">
      © {new Date().getFullYear()} Ireland Votes — Data sourced from official or
      original sources. Ireland Votes is an independent entity and is not
      affiliated with any pollster or electoral authority. For more information
      see
      <a
        href="/disclaimer"
        className="px-1 underline hover:text-gray-200 transition-colors"
      >
        irelandvotes.com/disclaimer.
      </a>
    </div>
  );
}