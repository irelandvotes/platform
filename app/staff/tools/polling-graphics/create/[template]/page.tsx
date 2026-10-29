import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff/auth";
import { loadPollingGraphicOptions } from "@/lib/staff/pollingGraphicData";
import type { GraphicTemplateKey } from "@/lib/staff/pollingGraphicCatalog";
import GraphicTemplateWorkspace from "../../../../GraphicTemplateWorkspace";
import StaffHeader from "../../../../StaffHeader";
import "../../../../staff.css";

const availableTemplates = new Set<GraphicTemplateKey>(["breaking-news", "on-this-day", "election-results", "explainer"]);

export default async function GraphicTemplatePage({ params }: { params: Promise<{ template: string }> }) {
  const { template } = await params;
  if (!availableTemplates.has(template as GraphicTemplateKey)) notFound();

  const { user, role, membershipError } = await getStaffContext();
  if (!user) redirect(`/staff/login?next=%2Fstaff%2Ftools%2Fpolling-graphics%2Fcreate%2F${template}`);
  if (membershipError) {
    return <main className="staff-setup-message"><h1>Staff access needs setup</h1><p>Apply the staff membership migration in Supabase, then add your account to the staff_members table.</p></main>;
  }
  if (!role) redirect("/staff/login?error=not-staff");

  const userName = user.user_metadata?.full_name ?? user.email ?? "Staff";
  const options = loadPollingGraphicOptions(true);
  return <div className="staff-workspace"><StaffHeader userName={userName} /><GraphicTemplateWorkspace elections={options.electionArchive} template={template as GraphicTemplateKey} /></div>;
}
