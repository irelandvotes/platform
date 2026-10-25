"use client";

import { useState } from "react";
import "./register.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {

const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");

const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [success, setSuccess] = useState("");

const supabase = createClient();

async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setLoading(true);
  setError("");
  setSuccess("");

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: new URL("/auth/callback", siteUrl).toString(),
        data: { full_name: name.trim() },
      },
    });

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Account created. Check your email for a verification link before logging in.");
    setName("");
    setEmail("");
    setPassword("");
  } catch {
    setError("We couldn't create your account. Please try again.");
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

            <h2>Create your account</h2>
<form onSubmit={handleSignup}>
<label className="sr-only" htmlFor="register-name">Your name</label>
<input
  id="register-name"
  type="text"
  placeholder="Your name"
  autoComplete="name"
  required
  value={name}
  onChange={(e) => setName(e.target.value)}
/>

<label className="sr-only" htmlFor="register-email">Email address</label>
<input
  id="register-email"
  type="email"
  placeholder="Email address"
  autoComplete="email"
  required
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

<label className="sr-only" htmlFor="register-password">Create a password</label>
<input
  id="register-password"
  type="password"
  placeholder="Create a password"
  autoComplete="new-password"
  minLength={8}
  required
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>

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

{success && (
  <div
    style={{
      color: "#00dfef",
      marginBottom: "16px",
      fontSize: "14px",
    }}
  role="status"
  >
    {success}
  </div>
)}

<button
  type="submit"
  disabled={loading}
>
  {loading ? "Creating account..." : "Sign Up"}
</button>
</form>

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
