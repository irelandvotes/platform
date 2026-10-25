"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

async function handleLogout() {
  setLoading(true);
  setError("");

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/");
    router.refresh();
  } catch {
    setError("We couldn't log you out. Please try again.");
  } finally {
    setLoading(false);
  }
}

return (
  <>
  <button
    onClick={handleLogout}
    disabled={loading}
    style={{
      width: "100%",
      textAlign: "left",
      padding: "12px 16px",
      background: "transparent",
      border: "none",
      color: "#ff7a7a",
      cursor: "pointer",
      fontSize: "14px",
      transition: "background .18s ease",
    }}
  >
    {loading ? "Logging out…" : "Log Out"}
  </button>
  {error && <p role="alert" style={{ color: "#ff7a7a", padding: "0 16px", fontSize: 13 }}>{error}</p>}
  </>
);
}
