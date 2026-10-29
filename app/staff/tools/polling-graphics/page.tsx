import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff/auth";
import StaffHeader from "../../StaffHeader";
import "../../staff.css";

export default async function PollingGraphicsPage() {
  const { user, role, membershipError } = await getStaffContext();

  if (!user) redirect("/staff/login?next=%2Fstaff%2Ftools%2Fpolling-graphics");

  if (membershipError) {
    return (
      <main className="staff-setup-message">
        <h1>Staff access needs setup</h1>
        <p>Apply the staff membership migration in Supabase, then add your account to the staff_members table.</p>
      </main>
    );
  }

  if (!role) redirect("/staff/login?error=not-staff");

  const userName = user.user_metadata?.full_name ?? user.email ?? "Staff";

  return (
    <div className="staff-workspace">
      <StaffHeader userName={userName} />
      <main className="staff-home-content staff-tool-catalog">
        <header className="staff-tool-catalog-heading">
          <p className="staff-eyebrow">IRELAND VOTES / CONTENT</p>
          <h1>Content</h1>
          <p>Create and prepare branded polling graphics and their accompanying social post.</p>
        </header>
        <section className="staff-tool-catalog-grid staff-tool-catalog-content-grid" aria-label="Content tools">
          <Link className="staff-launchpad-card staff-launchpad-content-card" href="/staff/tools/polling-graphics/create">
            <div className="staff-launchpad-card-top"><span>01 / POLLING</span><span className="staff-launchpad-arrow" aria-hidden="true">↗</span></div>
            <div className="staff-launchpad-content-art" aria-hidden="true">
              <div className="staff-launchpad-art-brand">IRELAND<br />VOTES</div>
              <div className="staff-launchpad-art-bars"><i /><i /><i /><i /><i /></div>
              <div className="staff-launchpad-art-caption">POLLING GRAPHIC <span>4000 × 2000</span></div>
            </div>
            <div className="staff-launchpad-card-copy">
              <div><h2>Create a polling graphic</h2><p>Choose an election comparison, enter poll details and create the branded graphic and X post.</p></div>
              <span className="staff-launchpad-card-cta">Open graphic creator <b aria-hidden="true">→</b></span>
            </div>
          </Link>
        </section>
      </main>
    </div>
  );
}
