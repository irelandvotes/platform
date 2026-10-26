import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getStaffContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null, membershipError: null };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("staff_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    role: membership?.role ?? null,
    membershipError,
  };
}
