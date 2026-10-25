"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ElectionBookmarkButton({ title }: { title: string }) {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBookmark() {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (!active) return;
        setUserId(user?.id ?? null);

        if (!user) {
          setSaved(false);
          return;
        }

        const { data, error: bookmarkError } = await supabase
          .from("election_bookmarks")
          .select("path")
          .eq("user_id", user.id)
          .eq("path", pathname)
          .maybeSingle();

        if (bookmarkError) throw bookmarkError;
        if (active) setSaved(Boolean(data));
      } catch {
        if (active) setError("Bookmarks are temporarily unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBookmark();
    return () => {
      active = false;
    };
  }, [pathname]);

  async function toggleBookmark() {
    if (!userId || saving) return;

    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const result = saved
        ? await supabase
            .from("election_bookmarks")
            .delete()
            .eq("user_id", userId)
            .eq("path", pathname)
        : await supabase
            .from("election_bookmarks")
            .insert({ user_id: userId, path: pathname, title });

      if (result.error) throw result.error;
      setSaved(!saved);
    } catch {
      setError("We couldn't update this bookmark. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 36,
    padding: "0 12px",
    border: `1px solid ${saved ? "rgba(0, 223, 239, .55)" : "var(--border)"}`,
    borderRadius: 9,
    background: saved ? "rgba(0, 223, 239, .1)" : "var(--panel-2)",
    color: saved ? "#00b9c7" : "var(--text)",
    fontSize: 12,
    fontWeight: 650,
    whiteSpace: "nowrap",
    textDecoration: "none",
    cursor: loading || saving ? "wait" : "pointer",
    opacity: loading || saving ? .7 : 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      {loading ? (
        <button type="button" style={buttonStyle} disabled aria-label="Checking bookmark status">
          <BookmarkIcon />
          <span>Save</span>
        </button>
      ) : userId ? (
        <button
          type="button"
          style={buttonStyle}
          onClick={toggleBookmark}
          disabled={saving || Boolean(error)}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${title} from saved elections` : `Save ${title}`}
        >
          <BookmarkIcon filled={saved} />
          <span>{saved ? "Saved" : "Save"}</span>
        </button>
      ) : (
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} style={buttonStyle}>
          <BookmarkIcon />
          <span>Log in to save</span>
        </Link>
      )}
      {error && <span role="alert" style={{ maxWidth: 220, color: "#d65f5f", fontSize: 11, textAlign: "right" }}>{error}</span>}
    </div>
  );
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.8L6 21V4.75Z" />
    </svg>
  );
}
