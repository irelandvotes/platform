"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "../staff.css";

export default function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    searchParams.get("error") === "not-staff"
      ? "This account does not have staff access."
      : "",
  );
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError("Those login details could not be verified.");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("We could not verify your account. Please try again.");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("staff_members")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (membershipError) {
        setError("Staff access is not configured yet. Please contact an administrator.");
        return;
      }

      if (!membership) {
        setError("This account does not have staff access.");
        return;
      }

      const requestedPath = searchParams.get("next");
      const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/staff";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("We could not sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="staff-login-page">
      <section className="staff-login-card">
        <img className="staff-login-logo" src="/portrait.png" alt="Ireland Votes: Psychological & Electoral Analysis" />
        <p className="staff-eyebrow">INTERNAL WORKSPACE</p>
        <h1>Staff sign in</h1>
        <p className="staff-login-copy">Sign in with your Ireland Votes staff account.</p>

        <form onSubmit={handleSubmit} className="staff-login-form">
          <label htmlFor="staff-email">Email address</label>
          <input
            id="staff-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="staff-password">Password</label>
          <input
            id="staff-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="staff-form-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in to staff"}
          </button>
        </form>

        <Link className="staff-back-link" href="/forgot-password">Forgot your password?</Link>

        <Link className="staff-back-link" href="/">Back to Ireland Votes</Link>
      </section>
    </main>
  );
}
