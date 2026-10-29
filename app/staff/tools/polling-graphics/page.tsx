import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff/auth";
import StaffHeader from "../../StaffHeader";
import "../../staff.css";

const graphicTemplates = [
  { number: "01", name: "Polling graphics", detail: "Turn polling figures into the Ireland Votes house-style graphic and X post.", href: "/staff/tools/polling-graphics/create", tag: "POLLING" },
  { number: "02", name: "Breaking news", detail: "Create a fast, clear news card with a headline, summary, source and optional image.", href: "/staff/tools/polling-graphics/create/breaking-news", tag: "NEWS" },
  { number: "03", name: "#OnThisDay", detail: "Bring an election from the archive back to the timeline with its original figures.", href: "/staff/tools/polling-graphics/create/on-this-day", tag: "ARCHIVE" },
  { number: "04", name: "Election results", detail: "Build constituency result cards from the election data already on the site.", href: "/staff/tools/polling-graphics/create/election-results", tag: "RESULTS" },
  { number: "05", name: "Explainers & stats", detail: "Make clear, branded graphics for key figures and electoral explainers.", href: "/staff/tools/polling-graphics/create/explainer", tag: "EXPLAINER" },
];

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
          <p>Choose a format, build a branded graphic and prepare its accompanying social post.</p>
        </header>
        <section className="staff-tool-catalog-grid staff-graphics-template-grid" aria-label="Graphic templates">
          {graphicTemplates.map((template) => <Link key={template.number} className="staff-launchpad-card staff-launchpad-content-card" href={template.href}>
            <div className="staff-launchpad-card-top"><span>{template.number} / {template.tag}</span><span className="staff-launchpad-arrow" aria-hidden="true">↗</span></div>
            <div className={`staff-launchpad-content-art staff-launchpad-art-${template.number}`} aria-hidden="true">
              {template.number === "01" && <>
                <div className="staff-launchpad-art-kicker">IRELAND VOTES <span>POLLING</span></div>
                <div className="staff-launchpad-poll-preview">
                  <strong>PARTY SUPPORT</strong>
                  <div><b>SF</b><i><span style={{ width: "78%" }} /></i><em>26%</em></div>
                  <div><b>FF</b><i><span style={{ width: "61%" }} /></i><em>20%</em></div>
                  <div><b>FG</b><i><span style={{ width: "53%" }} /></i><em>17%</em></div>
                </div>
              </>}
              {template.number === "02" && <div className="staff-launchpad-breaking-preview"><span>BREAK</span><span>ING</span><b>IRELAND<br />VOTES</b></div>}
              {template.number === "03" && <>
                <div className="staff-launchpad-art-kicker">FROM THE ARCHIVE <span>OCT 29</span></div>
                <div className="staff-launchpad-history-title">ON THIS<br /><b>DAY</b></div>
                <div className="staff-launchpad-history-result"><span>SF</span><strong>42.1%</strong><i /><span>1998</span></div>
              </>}
              {template.number === "04" && <>
                <div className="staff-launchpad-art-kicker">ELECTION RESULTS <span>CONSTITUENCY</span></div>
                <div className="staff-launchpad-result-preview"><div><strong>Foyle</strong><span>DECLARED</span></div><b>SF</b><strong>WIN</strong></div>
                <div className="staff-launchpad-result-lines"><i /><i /><i /></div>
              </>}
              {template.number === "05" && <>
                <div className="staff-launchpad-art-kicker">THE NUMBERS, EXPLAINED</div>
                <div className="staff-launchpad-explainer-preview"><strong>42<span>%</span></strong><div><b>VOTE<br />SHARE</b><i /><i /><i /></div></div>
              </>}
              <div className="staff-launchpad-art-caption">{template.tag} <span>4000 × 2000</span></div>
            </div>
            <div className="staff-launchpad-card-copy">
              <div><h2>{template.name}</h2><p>{template.detail}</p></div>
              <span className="staff-launchpad-card-cta">Create graphic <b aria-hidden="true">→</b></span>
            </div>
          </Link>)}
        </section>
      </main>
    </div>
  );
}
