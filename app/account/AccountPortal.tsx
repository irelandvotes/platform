"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/components/LogoutButton";
import AccountProfileForm from "./AccountProfileForm";

type Bookmark = {
  path: string;
  title: string;
  created_at: string;
};

export default function AccountPortal({
  name,
  email,
  isEmailVerified,
  bookmarks: initialBookmarks,
  bookmarksUnavailable,
}: {
  name: string;
  email: string;
  isEmailVerified: boolean;
  bookmarks: Bookmark[];
  bookmarksUnavailable: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"bookmarks" | "settings">("bookmarks");
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [removingPath, setRemovingPath] = useState<string | null>(null);
  const [bookmarkError, setBookmarkError] = useState("");

  async function removeBookmark(path: string) {
    setRemovingPath(path);
    setBookmarkError("");

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("election_bookmarks")
        .delete()
        .eq("path", path);

      if (error) throw error;
      setBookmarks((current) => current.filter((bookmark) => bookmark.path !== path));
    } catch {
      setBookmarkError("We couldn't remove that saved page. Please try again.");
    } finally {
      setRemovingPath(null);
    }
  }

  function selectTab(tab: "bookmarks" | "settings") {
    setActiveTab(tab);
    setBookmarkError("");
  }

  return (
    <div className="account-portal">
      <nav className="account-sidebar" aria-label="Account sections">
        <p className="account-nav-label">Account</p>
        <AccountTabButton active={activeTab === "bookmarks"} onClick={() => selectTab("bookmarks")}>
          <BookmarkIcon />
          <span>Saved elections</span>
          <span className="account-nav-count">{bookmarks.length}</span>
        </AccountTabButton>
        <AccountTabButton active={activeTab === "settings"} onClick={() => selectTab("settings")}>
          <SettingsIcon />
          <span>Account settings</span>
        </AccountTabButton>
      </nav>

      <div className="account-mobile-tabs" role="tablist" aria-label="Account sections">
        <AccountTabButton role="tab" active={activeTab === "bookmarks"} onClick={() => selectTab("bookmarks")}>
          <BookmarkIcon /> Saved elections <span className="account-nav-count">{bookmarks.length}</span>
        </AccountTabButton>
        <AccountTabButton role="tab" active={activeTab === "settings"} onClick={() => selectTab("settings")}>
          <SettingsIcon /> Account settings
        </AccountTabButton>
      </div>

      <section
        className="account-panel"
        role="tabpanel"
        aria-label={activeTab === "bookmarks" ? "Saved elections" : "Account settings"}
      >
        {activeTab === "bookmarks" ? (
          <>
            <header className="account-panel-header">
              <div>
                <p className="account-eyebrow">Your collection</p>
                <h2>Saved elections</h2>
                <p>Keep the election and constituency pages you follow close at hand.</p>
              </div>
              <Link href="/elections" className="account-primary-link">Browse elections</Link>
            </header>

            {bookmarksUnavailable ? (
              <div className="account-notice" role="status">
                Your saved pages couldn’t be loaded right now. Please refresh and try again.
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="account-empty-state">
                <span className="account-empty-icon" aria-hidden="true"><BookmarkIcon /></span>
                <h3>Your saved elections will appear here</h3>
                <p>Open any election or constituency page and select <strong>Save</strong> to add it to this list.</p>
                <Link href="/elections" className="account-primary-link">Explore election pages</Link>
              </div>
            ) : (
              <>
                {bookmarkError && <p className="account-error" role="alert">{bookmarkError}</p>}
                <div className="account-bookmark-list">
                  {bookmarks.map((bookmark) => (
                    <article className="account-bookmark" key={bookmark.path}>
                      <span className="account-bookmark-icon" aria-hidden="true"><BookmarkIcon filled /></span>
                      <div className="account-bookmark-info">
                        <h3><Link href={bookmark.path}>{bookmark.title}</Link></h3>
                        <p>{bookmark.path}</p>
                      </div>
                      <button
                        type="button"
                        className="account-remove-bookmark"
                        onClick={() => removeBookmark(bookmark.path)}
                        disabled={removingPath === bookmark.path}
                        aria-label={`Remove ${bookmark.title} from saved elections`}
                      >
                        {removingPath === bookmark.path ? "Removing…" : "Remove"}
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="account-settings-stack">
            <header className="account-panel-header">
              <div>
                <p className="account-eyebrow">Your details</p>
                <h2>Account settings</h2>
                <p>Manage your profile and account security.</p>
              </div>
            </header>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <h3>Profile</h3>
                  <p>Your display name appears in the Ireland Votes navigation.</p>
                </div>
                <span className="account-avatar" aria-hidden="true">
                  {(name || email || "A").slice(0, 1).toUpperCase()}
                </span>
              </div>
              <AccountProfileForm initialName={name} email={email} />
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <h3>Security</h3>
                  <p>Keep your sign-in details up to date.</p>
                </div>
                <span className="account-security-icon" aria-hidden="true">✓</span>
              </div>
              <div className="account-security-row">
                <div>
                  <h4>Email verification</h4>
                  <p>{email}</p>
                </div>
                <span className={`account-status ${isEmailVerified ? "is-verified" : "is-pending"}`}>
                  {isEmailVerified ? "Verified" : "Pending"}
                </span>
              </div>
              <div className="account-security-row">
                <div>
                  <h4>Password</h4>
                  <p>Send a secure link to choose a new password.</p>
                </div>
                <Link className="account-secondary-link" href="/forgot-password">Reset password</Link>
              </div>
            </section>

            <section className="account-card account-logout-card">
              <div>
                <h3>Sign out</h3>
                <p>Sign out of this Ireland Votes account on this device.</p>
              </div>
              <LogoutButton />
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function AccountTabButton({
  active,
  onClick,
  children,
  role,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  role?: "tab";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === "tab" ? active : undefined}
      className={`account-tab${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.8L6 21V4.75Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" />
    </svg>
  );
}
