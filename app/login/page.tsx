"use client";

import { useEffect, useState } from "react";
import "./login.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");

const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [success, setSuccess] = useState("");
const [resending, setResending] = useState(false);
const [verificationError, setVerificationError] = useState(false);
const router = useRouter();

const supabase = createClient();

useEffect(() => {
  setVerificationError(new URLSearchParams(window.location.search).get("error") === "verification");
}, []);

async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setLoading(true);
  setError("");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    const requestedPath = new URLSearchParams(window.location.search).get("next");
    const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/";
    router.replace(destination);
    router.refresh();
  } catch {
    setError("We couldn't log you in. Please try again.");
  } finally {
    setLoading(false);
  }
}

async function handleResendVerification() {
  if (!email.trim()) {
    setError("Enter your email address first.");
    return;
  }

  setResending(true);
  setError("");
  setSuccess("");

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: new URL("/auth/callback", siteUrl).toString() },
    });

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("If this account still needs verification, a new email is on its way.");
  } catch {
    setError("We couldn't resend the verification email. Please try again.");
  } finally {
    setResending(false);
  }
}

  return (
    <main className="register-page">
      <div className="register-glow glow-1" />
      <div className="register-glow glow-2" />

      <section className="register-left">

        <h1>
          Welcome back.
          <br />
          </h1>

        <p className="hero-text">
          It's nice to see you again. You can log in to your Ireland Votes account to view your personalised dashboard.
        </p>

      </section>

      <section className="register-right">
        <div className="register-card">

          <div className="card-glow" />

          <div className="card-content">

            <h2>Log in</h2>
{verificationError && (
  <div>
    <p role="alert" style={{ color: "#ff6b6b" }}>
      That verification link could not be confirmed. You can request another one below.
    </p>
    <button type="button" onClick={handleResendVerification} disabled={resending}>
      {resending ? "Sending…" : "Resend verification email"}
    </button>
  </div>
)}
{success && <p role="status" style={{ color: "#00dfef" }}>{success}</p>}

<form onSubmit={handleLogin}>
<label className="sr-only" htmlFor="login-email">Email address</label>
<input
  id="login-email"
  type="email"
  placeholder="Email address"
  autoComplete="email"
  required
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

<label className="sr-only" htmlFor="login-password">Password</label>
<input
  id="login-password"
  type="password"
  placeholder="Password"
  autoComplete="current-password"
  required
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>

<div style={{ display: "flex", justifyContent: "flex-end", margin: "-4px 0 12px" }}>
  <Link href="/forgot-password" className="signin-link" style={{ display: "inline", color: "#00dfef" }}>
    Forgot your password?
  </Link>
</div>

{error && (
  <div
    style={{
      color: "#ff6b6b",
      marginBottom: "16px",
      fontSize: "14px",
    }}
  role="alert"
  >
    {error}
  </div>
)}

<button
  type="submit"
  disabled={loading}
>
  {loading ? "Logging in..." : "Log In"}
</button>
</form>

            <div className="divider">
              <span>or</span>
            </div>

            <Link
              href="/register"
              className="signin-link"
            >
              Don't have an account? <strong>Sign up</strong>
            </Link>

          </div>

        </div>
      </section>
    </main>
  );
}
