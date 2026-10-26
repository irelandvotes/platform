import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff/auth";
import { loadPollingGraphicOptions } from "@/lib/staff/pollingGraphicData";
import StaffHeader from "../../../StaffHeader";
import StaffWorkspace from "../../../StaffWorkspace";
import "../../../staff.css";

export default async function CreatePollingGraphicPage() {
  const { user, role, membershipError } = await getStaffContext();

  if (!user) {
    redirect("/staff/login?next=%2Fstaff%2Ftools%2Fpolling-graphics%2Fcreate");
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
  const options = loadPollingGraphicOptions();

  return (
    <div className="staff-workspace">
      <StaffHeader userName={userName} />
      <StaffWorkspace options={options} />
    </div>
  );
}
