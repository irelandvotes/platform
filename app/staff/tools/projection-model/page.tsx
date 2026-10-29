import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff/auth";
import StaffHeader from "../../StaffHeader";
import "../../staff.css";

const projectionModels = [
  { number: "01", title: "House of Commons (NI)", method: "FPTP", detail: "Westminster constituency projections", href: "/staff/tools/seat-projection", available: true },
  { number: "02", title: "NI Assembly", method: "STV", detail: "Constituency projections and simulated counts", href: "/staff/tools/ni-assembly-projection", available: true },
  { number: "03", title: "Dáil Éireann", method: "STV", detail: "Irish general election projections", href: "", available: false },
];

export default async function ProjectionModelLandingPage() {
  const { user, role, membershipError } = await getStaffContext();

  if (!user) redirect("/staff/login?next=%2Fstaff%2Ftools%2Fprojection-model");

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
          <p className="staff-eyebrow">IRELAND VOTES / ANALYSIS</p>
          <h1>Projection model</h1>
          <p>Select an election model to build and explore a projection scenario.</p>
        </header>
        <section className="staff-tool-catalog-grid staff-projection-model-grid" aria-label="Projection models">
          {projectionModels.map((model) => {
            const content = <>
              <div className="staff-launchpad-card-top"><span>{model.number} / {model.method}</span><span className={`staff-projection-model-status${model.available ? " is-live" : ""}`}>{model.available ? "AVAILABLE" : "COMING SOON"}</span></div>
              <div className="staff-projection-model-art" aria-hidden="true">
                <span className="staff-projection-model-method">{model.method}</span>
                <span className="staff-projection-model-art-caption">IRELAND VOTES <i /> ELECTORAL MODELLING</span>
                <div className="staff-projection-model-art-bars"><i /><i /><i /><i /><i /><i /><i /></div>
              </div>
              <div className="staff-launchpad-card-copy">
                <div><h2>{model.title}</h2><p>{model.detail}</p></div>
                <span className="staff-launchpad-card-cta">{model.available ? "Open model" : "Model in development"}<b aria-hidden="true">{model.available ? "→" : "·"}</b></span>
              </div>
            </>;

            return model.available
              ? <Link key={model.number} className="staff-launchpad-card staff-projection-model-card" href={model.href}>{content}</Link>
              : <article key={model.number} className="staff-launchpad-card staff-projection-model-card is-unavailable" aria-disabled="true">{content}</article>;
          })}
        </section>
      </main>
    </div>
  );
}
