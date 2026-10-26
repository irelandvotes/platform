import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff/auth";
import StaffHeader from "../../StaffHeader";
import "../../staff.css";

export default async function PollingGraphicsPage() {
  const { user, role, membershipError } = await getStaffContext();

  if (!user) {
    redirect("/staff/login?next=%2Fstaff%2Ftools%2Fpolling-graphics");
  }

  if (membershipError) {
    return (
      <main className="staff-setup-message">
        <h1>Staff access needs setup</h1>
        <p>Apply the staff membership migration in Supabase, then add your account to the staff_members table.</p>
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
      <main className="staff-home-content staff-graphics-home">
        <div className="staff-graphics-heading">
          <div>
            <p className="staff-eyebrow">PUBLISHING &middot; POLLING</p>
            <h1>Polling Graphics</h1>
            <p>Create and prepare Ireland Votes polling visuals from one workspace.</p>
          </div>
          <span className="staff-format-badge">TWITTER / X &middot; 2:1</span>
        </div>

        <section className="staff-home-section" aria-labelledby="graphics-tools-heading">
          <div className="staff-home-section-heading">
            <div>
              <p className="staff-eyebrow">WORKFLOW</p>
              <h2 id="graphics-tools-heading">Graphics and publishing</h2>
            </div>
          </div>

          <div className="staff-graphics-grid">
            <article className="staff-graphics-card">
              <div className="staff-graphics-card-topline">
                <span className="staff-graphics-icon" aria-hidden="true">01</span>
                <span className="staff-tool-status">AVAILABLE</span>
              </div>
              <h3>Create a polling graphic</h3>
              <p>Choose a comparison, enter poll figures and details, then export a high-resolution graphic.</p>
              <div className="staff-graphics-card-meta">
                <span>Twitter / X</span><span>4000 &times; 2000 PNG</span>
              </div>
              <Link className="staff-graphics-action" href="/staff/tools/polling-graphics/create">
                Open graphic editor <span aria-hidden="true">&rarr;</span>
              </Link>
            </article>

            <article className="staff-graphics-card">
              <div className="staff-graphics-card-topline">
                <span className="staff-graphics-icon" aria-hidden="true">X</span>
                <span className="staff-tool-status">AVAILABLE</span>
              </div>
              <h3>Publish directly to X</h3>
              <p>Connect the Ireland Votes account, review the house-template post and publish it with the generated polling graphic attached.</p>
              <div className="staff-posting-steps" aria-label="X publishing workflow">
                <span>Connect account</span><i aria-hidden="true">·</i>
                <span>Review post</span><i aria-hidden="true">·</i>
                <span>Publish</span>
              </div>
              <Link className="staff-graphics-action" href="/staff/tools/polling-graphics/create">
                Open post generator <span aria-hidden="true">Post</span>
              </Link>
            </article>
          </div>
        </section>

        <p className="staff-graphics-footnote">
          Connect X once in the post generator, then publish the post text and generated PNG together from the graphic editor.
        </p>
      </main>
    </div>
  );
}
