"use client";

import { useEffect, useState } from "react";
import "./login.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AUTH_REDIRECT_BASE_URL } from "@/lib/authRedirect";
import { authErrorMessage } from "@/lib/supabase/authErrorMessage";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [destination, setDestination] = useState("/");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    setDestination(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    if (params.get("error") === "verification") {
      setError("That email link could not be confirmed. Enter your email below to request a one-time code.");
    }
  }, []);

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: new URL("/auth/callback", AUTH_REDIRECT_BASE_URL).toString(),
        },
      });
      if (error) {
        setError(authErrorMessage(error, "We couldn't send a sign-in code. Please try again."));
        return;
      }
      setCodeSent(true);
      setSuccess(`If an account exists for ${email.trim()}, a one-time code is on its way.`);
    } catch {
      setError("We couldn't send a sign-in code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) {
        setError(authErrorMessage(error, "We couldn't resend the code. Please try again."));
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setError("We couldn't verify that code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(error.message);
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setError("We couldn't log you in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: new URL("/auth/callback", AUTH_REDIRECT_BASE_URL).toString(),
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess(`If an account exists for ${email.trim()}, a new one-time code is on its way.`);
    } catch {
      setError("We couldn't resend the code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="register-page">
      <div className="register-glow glow-1" />
      <div className="register-glow glow-2" />
      <section className="register-left">
        <h1>Welcome back.</h1>
        <p className="hero-text">Sign in securely with a one-time code sent to your email address.</p>
      </section>
      <section className="register-right">
        <div className="register-card">
          <div className="card-glow" />
          <div className="card-content">
            <h2>Log in</h2>
            {success && <p role="status" style={{ color: "#00dfef" }}>{success}</p>}
            {error && <p role="alert" style={{ color: "#ff6b6b", marginBottom: 16, fontSize: 14 }}>{error}</p>}

            {passwordMode ? (
              <form onSubmit={loginWithPassword}>
                <label className="sr-only" htmlFor="password-login-email">Email address</label>
                <input id="password-login-email" type="email" placeholder="Email address" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                <label className="sr-only" htmlFor="password-login-password">Password</label>
                <input id="password-login-password" type="password" placeholder="Password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
                <div style={{ display: "flex", justifyContent: "flex-end", margin: "-4px 0 12px" }}>
                  <Link href="/forgot-password" className="signin-link" style={{ display: "inline", color: "#00dfef" }}>Forgot your password?</Link>
                </div>
                <button type="submit" disabled={loading}>{loading ? "Logging in…" : "Log in with password"}</button>
                <button type="button" className="auth-secondary-action" onClick={() => { setPasswordMode(false); setError(""); }}>Use an email code instead</button>
              </form>
            ) : !codeSent ? (
              <form onSubmit={sendCode}>
                <label className="sr-only" htmlFor="login-email">Email address</label>
                <input id="login-email" type="email" placeholder="Email address" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                <button type="submit" disabled={loading}>{loading ? "Sending code…" : "Email me a one-time code"}</button>
                <button type="button" className="auth-secondary-action" onClick={() => { setPasswordMode(true); setError(""); }}>Use a password instead</button>
              </form>
            ) : (
              <form onSubmit={verifyCode}>
                <label className="sr-only" htmlFor="login-code">One-time code</label>
                <input id="login-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8} placeholder="Enter your code" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
                <button type="submit" disabled={loading}>{loading ? "Verifying…" : "Verify and log in"}</button>
                <button type="button" className="auth-secondary-action" onClick={resendCode} disabled={loading}>Resend code</button>
                <button type="button" className="auth-secondary-action" onClick={() => { setPasswordMode(true); setError(""); }}>Use a password instead</button>
                <button type="button" className="auth-secondary-action" onClick={() => { setCodeSent(false); setCode(""); setSuccess(""); setError(""); }}>Use a different email</button>
              </form>
            )}

            <div className="divider"><span>or</span></div>
            <Link href="/register" className="signin-link">Don’t have an account? <strong>Sign up</strong></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
