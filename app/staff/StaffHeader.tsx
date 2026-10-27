"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StaffHeader({ userName }: { userName: string }) {
  const pathname = usePathname();
  const onStaffHome = pathname === "/staff";
  const onPollingTool = pathname.startsWith("/staff/tools/polling");
  const onSeatProjection = pathname.startsWith("/staff/tools/seat-projection")
    || pathname.startsWith("/staff/tools/ni-assembly-projection");

  return (
    <header className="staff-topbar">
      <Link className="staff-topbar-brand" href="/staff" aria-label="Ireland Votes staff home">
        <img src="/landscape.png" alt="Ireland Votes" />
        <span>Staff workspace</span>
      </Link>
      <nav className="staff-topbar-nav" aria-label="Staff navigation">
        <Link className={onStaffHome ? "active" : ""} href="/staff">Home</Link>
        <Link className={onPollingTool ? "active" : ""} href="/staff/tools/polling-graphics">Polling graphics</Link>
        <Link className={onSeatProjection ? "active" : ""} href="/staff/tools/seat-projection">Seat projection</Link>
      </nav>
      <div className="staff-topbar-actions">
        <span>{userName}</span>
        <button
          type="button"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.assign("/staff/login");
          }}
        >Sign out</button>
      </div>
    </header>
  );
}
