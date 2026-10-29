import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff/auth";
import Link from "next/link";
import StaffHeader from "./StaffHeader";
import "./staff.css";

export default async function StaffPage() {
  const { user, role, membershipError } = await getStaffContext();

  if (!user) {
    redirect("/staff/login?next=%2Fstaff");
  }

  if (membershipError) {
    return (
      <main className="staff-setup-message">
        <h1>Staff access needs setup</h1>
        <p>
          Apply the staff membership migration in Supabase, then add your account
          to the staff_members table.
        </p>
      </main>
    );
  }

  if (!role) {
    redirect("/staff/login?error=not-staff");
  }

  const userName = user.user_metadata?.full_name ?? user.email ?? "Staff";

  return (
    <div className="staff-workspace">
      <StaffHeader userName={userName} />
      <main className="staff-home-content staff-launchpad">
        <header className="staff-launchpad-welcome"><p className="staff-eyebrow">IRELAND VOTES / STAFF</p><h1>Welcome, {userName}</h1></header>

        <section className="staff-launchpad-section" aria-labelledby="staff-tools-heading">
          <div className="staff-launchpad-section-heading"><h2 id="staff-tools-heading">Your tools</h2><span>01 — 02</span></div>
          <div className="staff-launchpad-grid">
            <Link className="staff-launchpad-card staff-launchpad-content-card" href="/staff/tools/polling-graphics">
              <div className="staff-launchpad-card-top"><span>01 / CONTENT</span><span className="staff-launchpad-arrow" aria-hidden="true">↗</span></div>
              <div className="staff-launchpad-content-art" aria-hidden="true">
                <div className="staff-launchpad-art-brand">IRELAND<br />VOTES</div>
                <div className="staff-launchpad-art-bars"><i /><i /><i /><i /><i /></div>
                <div className="staff-launchpad-art-caption">POLLING GRAPHIC <span>2026</span></div>
              </div>
              <div className="staff-launchpad-card-copy"><div><h3>Content</h3><p>Create polling graphics and prepare social posts in the Ireland Votes house style.</p></div><span className="staff-launchpad-card-cta">Open content studio <b aria-hidden="true">→</b></span></div>
            </Link>

            <Link className="staff-launchpad-card staff-launchpad-model-card" href="/staff/tools/projection-model">
              <div className="staff-launchpad-card-top"><span>02 / ANALYSIS</span><span className="staff-launchpad-arrow" aria-hidden="true">↗</span></div>
              <div className="staff-launchpad-model-art" aria-hidden="true">
                <div className="staff-launchpad-model-art-label">SEAT PROJECTION <span>LIVE MODEL</span></div>
                <div className="staff-launchpad-model-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><b /></div>
                <div className="staff-launchpad-model-axis"><span>SCENARIO</span><span>OUTCOME</span></div>
              </div>
              <div className="staff-launchpad-card-copy"><div><h3>Projection model</h3><p>Explore Westminster and Assembly scenarios, constituency outcomes and uncertainty.</p></div><span className="staff-launchpad-card-cta">Open projection model <b aria-hidden="true">→</b></span></div>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
