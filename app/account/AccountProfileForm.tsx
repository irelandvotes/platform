"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Enter a name before saving.");
      return;
    }

    setLoading(true);
    setError("");
    setSaved(false);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmedName },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setName(trimmedName);
      setSaved(true);
      router.refresh();
    } catch {
      setError("We couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="account-profile-form" onSubmit={handleSubmit}>
      <label htmlFor="account-name">Display name</label>
      <input
        id="account-name"
        type="text"
        autoComplete="name"
        maxLength={80}
        required
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setSaved(false);
        }}
      />

      <label htmlFor="account-email">Email address</label>
      <input id="account-email" type="email" value={email} readOnly />
      <p className="account-field-note">Email address changes require a separate verification flow.</p>

      <div className="account-form-footer">
        <button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </button>
        {saved && <span role="status" className="account-success">Profile saved.</span>}
        {error && <span role="alert" className="account-error">{error}</span>}
      </div>
    </form>
  );
}
