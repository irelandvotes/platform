"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AUTH_REDIRECT_BASE_URL } from "@/lib/authRedirect";
import "../login/login.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [invalidLink, setInvalidLink] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setInvalidLink(new URLSearchParams(window.location.search).get("error") === "invalid-link");
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const callbackUrl = new URL("/auth/callback", AUTH_REDIRECT_BASE_URL);
      callbackUrl.searchParams.set("next", "/reset-password");

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: callbackUrl.toString(),
      });

      if (error) {
        setError(error.message);
        return;
      }

      setMessage("If an account exists for that email, we've sent a password reset link. Check your inbox and spam folder.");
    } catch {
      setError("We couldn't send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="register-page">
      <div className="register-glow glow-1" />
      <div className="register-glow glow-2" />

      <section className="register-left">
        <h1>Reset your password.</h1>
        <p className="hero-text">
          Enter the email address on your Ireland Votes account and we’ll send you a secure link to choose a new password.
        </p>
      </section>

      <section className="register-right">
        <div className="register-card">
          <div className="card-glow" />
          <div className="card-content">
            <h2>Forgot password?</h2>
            <p>We’ll email you a link to reset it.</p>

            {invalidLink && (
              <p role="alert" style={{ color: "#ff6b6b" }}>
                That reset link is invalid or has expired. Request a new one below.
              </p>
            )}

            {message && <p role="status" style={{ color: "#00dfef" }}>{message}</p>}

            <form onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="recovery-email">Email address</label>
              <input
                id="recovery-email"
                type="email"
                placeholder="Email address"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              {error && <p role="alert" style={{ color: "#ff6b6b" }}>{error}</p>}

              <button type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <div className="divider"><span>or</span></div>
            <Link href="/login" className="signin-link">Back to <strong>Log In</strong></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
