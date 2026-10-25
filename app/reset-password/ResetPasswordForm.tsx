"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import "../login/login.css";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("We couldn't update your password. Request a new reset link and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="register-page">
      <div className="register-glow glow-1" />
      <div className="register-glow glow-2" />

      <section className="register-left">
        <h1>Choose a new password.</h1>
        <p className="hero-text">Use a password you haven’t used for another Ireland Votes account.</p>
      </section>

      <section className="register-right">
        <div className="register-card">
          <div className="card-glow" />
          <div className="card-content">
            <h2>Set a new password</h2>
            <p>Choose a new password with at least 8 characters.</p>

            {success ? (
              <>
                <p role="status" style={{ color: "#00dfef" }}>Your password has been updated.</p>
                <Link href="/account" className="signin-link"><strong>Continue to your account</strong></Link>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <label className="sr-only" htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  placeholder="New password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />

                <label className="sr-only" htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />

                {error && <p role="alert" style={{ color: "#ff6b6b" }}>{error}</p>}

                <button type="submit" disabled={loading}>
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
