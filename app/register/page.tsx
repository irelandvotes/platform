"use client";

import { useState } from "react";
import "./register.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AUTH_REDIRECT_BASE_URL } from "@/lib/authRedirect";
import { useRouter } from "next/navigation";
import { authErrorMessage } from "@/lib/supabase/authErrorMessage";

export default function RegisterPage() {

const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [code, setCode] = useState("");
const [codeSent, setCodeSent] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [success, setSuccess] = useState("");
const router = useRouter();

const supabase = createClient();

async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setLoading(true);
  setError("");
  setSuccess("");

  try {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: new URL("/auth/callback", AUTH_REDIRECT_BASE_URL).toString(),
        data: { full_name: name.trim() },
      },
    });

    if (error) {
      setError(authErrorMessage(error, "We couldn't create your account. Please try again."));
      return;
    }

    setCodeSent(true);
    setSuccess(`A one-time code has been sent to ${email.trim()}.`);
  } catch {
    setError("We couldn't create your account. Please try again.");
  } finally {
    setLoading(false);
  }
}

async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setLoading(true);
  setError("");
  setSuccess("");
  try {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setError(error.message);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.replace(destination);
    router.refresh();
  } catch {
    setError("We couldn't verify that code. Please try again.");
  } finally {
    setLoading(false);
  }
}

async function handleResendCode() {
  setLoading(true);
  setError("");
  setSuccess("");
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: new URL("/auth/callback", AUTH_REDIRECT_BASE_URL).toString(),
      },
    });
    if (error) {
      setError(authErrorMessage(error, "We couldn't resend the code. Please try again."));
      return;
    }
    setSuccess(`A new one-time code has been sent to ${email.trim()}.`);
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

        <h1>
          Create an Ireland Votes account to unlock more features.
          <br />
          </h1>

        <p className="hero-text">
          Create a free account to personalise your experience, save the
          political data that matters to you and unlock future Ireland Votes
          features.
        </p>

        <div className="feature-list">
<Feature
  icon={<BookmarkIcon />}
  title="Save favourites"
  text="Bookmark constituencies, elections, candidates and polling pages."
/>

<Feature
  icon={<ChartIcon />}
  title="Personal dashboard"
  text="Quickly return to the political data you follow most."
/>

<Feature
  icon={<ShieldIcon />}
  title="One Ireland Votes account"
  text="Your account will work across future dashboards, research tools and the Ireland Votes store."
/>
        </div>
      </section>

      <section className="register-right">
        <div className="register-card">

          <div className="card-glow" />

          <div className="card-content">

            <h2>{codeSent ? "Check your email" : "Create your account"}</h2>
            {success && <p role="status" style={{ color: "#00dfef", marginBottom: 16, fontSize: 14 }}>{success}</p>}
            {error && <p role="alert" style={{ color: "#ff6b6b", marginBottom: 16, fontSize: 14 }}>{error}</p>}

            {!codeSent ? (
              <form onSubmit={handleSignup}>
                <label className="sr-only" htmlFor="register-name">Your name</label>
                <input id="register-name" type="text" placeholder="Your name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
                <label className="sr-only" htmlFor="register-email">Email address</label>
                <input id="register-email" type="email" placeholder="Email address" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                <label className="sr-only" htmlFor="register-password">Create a password</label>
                <input id="register-password" type="password" placeholder="Create a password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="submit" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode}>
                <label className="sr-only" htmlFor="register-code">One-time code</label>
                <input id="register-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8} placeholder="Enter your code" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
                <button type="submit" disabled={loading}>{loading ? "Verifying…" : "Verify email and create account"}</button>
                <button type="button" className="auth-secondary-action" onClick={handleResendCode} disabled={loading}>Resend code</button>
                <button type="button" className="auth-secondary-action" onClick={() => { setCodeSent(false); setCode(""); setSuccess(""); setError(""); }}>Use a different email</button>
              </form>
            )}

            <div className="divider">
              <span>or</span>
            </div>

            <Link
              href="/login"
              className="signin-link"
            >
              Already have an account? <strong>Sign in</strong>
            </Link>

          </div>

        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  text
}:{
  icon:React.ReactNode;
  title:string;
  text:string;
}){

  return(

<div className="feature-card">

<div className="feature-icon">
{icon}
</div>

<div>

<div className="feature-title">
{title}
</div>

<div className="feature-text">
{text}
</div>

</div>

</div>

  );

}

function BookmarkIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 3h10v15l-5-3-5 3V3z"/>
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 16V8"/>
      <path d="M10 16V4"/>
      <path d="M16 16v-6"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"/>
    </svg>
  );
}
