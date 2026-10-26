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
      <main className="staff-home-content staff-dashboard">
        <section className="staff-home-hero staff-dashboard-hero">
          <div>
            <p className="staff-eyebrow">IRELAND VOTES / STAFF</p>
            <h1>Staff workspace</h1>
            <p>Polling analysis and publishing tools, gathered in one place.</p>
          </div>
          <div className="staff-dashboard-welcome">
            <span>Signed in as</span>
            <strong>{user.user_metadata?.full_name || user.email || "Staff"}</strong>
          </div>
        </section>

        <section className="staff-home-section staff-dashboard-tools" aria-labelledby="staff-tools-heading">
          <div className="staff-home-section-heading">
            <div>
              <p className="staff-eyebrow">WORKSPACE</p>
              <h2 id="staff-tools-heading">Tools</h2>
            </div>
            <span>2 available</span>
          </div>

          <div className="staff-tool-cards">
            <article className="staff-tool-card staff-tool-card-live">
              <div className="staff-tool-card-icon" aria-hidden="true">01</div>
              <div className="staff-tool-card-copy">
                <span className="staff-tool-status">AVAILABLE</span>
                <h3>Polling graphics</h3>
                <p>Create polling graphics, prepare the house-template post and publish both to X from the editor.</p>
                <div className="staff-tool-tags"><span>Graphic editor</span><span>X publishing</span></div>
                <Link href="/staff/tools/polling-graphics">Open tool <span aria-hidden="true">-&gt;</span></Link>
              </div>
            </article>

            <article className="staff-tool-card staff-tool-card-live">
              <div className="staff-tool-card-icon" aria-hidden="true">02</div>
              <div className="staff-tool-card-copy">
                <span className="staff-tool-status">EARLY MODEL</span>
                <h3>Seat projection model</h3>
                <p>Explore how a change in NI-wide party support could alter the Westminster constituency results.</p>
                <div className="staff-tool-tags"><span>NI Westminster</span><span>Uniform swing</span></div>
                <Link href="/staff/tools/seat-projection">Open early model <span aria-hidden="true">-&gt;</span></Link>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
