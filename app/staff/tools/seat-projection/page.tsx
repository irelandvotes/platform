import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff/auth";
import { loadNiWestminsterProjectionData } from "@/lib/staff/seatProjectionData";
import { loadNiProjectionSupportPresets } from "@/lib/staff/projectionSupportPresets";
import StaffHeader from "../../StaffHeader";
import SeatProjectionWorkspace from "../../SeatProjectionWorkspace";
import "../../staff.css";

export default async function SeatProjectionPage() {
  const { user, role, membershipError } = await getStaffContext();

  if (!user) {
    redirect("/staff/login?next=%2Fstaff%2Ftools%2Fseat-projection");
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
  const data = loadNiWestminsterProjectionData();
  const supportPresets = loadNiProjectionSupportPresets(data.parties.map((party) => party.code));

  return (
    <div className="staff-workspace">
      <StaffHeader userName={userName} />
      <SeatProjectionWorkspace data={data} supportPresets={supportPresets} />
    </div>
  );
}
