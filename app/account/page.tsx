import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountPortal from "./AccountPortal";
import "./account.css";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Faccount");
  }

  const name = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : "";
  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("election_bookmarks")
    .select("path, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <div>
            <p className="account-eyebrow">Your account</p>
            <h1>Welcome{name ? `, ${name}` : " back"}</h1>
            <p className="account-intro">Your personal home for the election pages you follow.</p>
          </div>
        </header>

        <AccountPortal
          name={name}
          email={user.email ?? ""}
          isEmailVerified={Boolean(user.email_confirmed_at)}
          bookmarks={bookmarks ?? []}
          bookmarksUnavailable={Boolean(bookmarksError)}
        />
      </div>
    </main>
  );
}
