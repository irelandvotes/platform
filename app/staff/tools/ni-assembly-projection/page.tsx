import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff/auth";
import { loadNiAssemblyProjectionData } from "@/lib/staff/niAssemblyProjectionData";
import StaffHeader from "../../StaffHeader";
import NiAssemblyProjectionWorkspace from "../../NiAssemblyProjectionWorkspace";
import "../../staff.css";

export default async function NiAssemblyProjectionPage() {
  const { user, role, membershipError } = await getStaffContext();

  if (!user) redirect("/staff/login?next=%2Fstaff%2Ftools%2Fni-assembly-projection");
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
  const data = loadNiAssemblyProjectionData();
  return (
    <div className="staff-workspace">
      <StaffHeader userName={userName} />
      <NiAssemblyProjectionWorkspace data={data} />
    </div>
  );
}
