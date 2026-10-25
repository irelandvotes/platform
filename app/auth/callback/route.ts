import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const callbackUrl = new URL(request.url);
  const code = callbackUrl.searchParams.get("code");
  const requestedPath = callbackUrl.searchParams.get("next");
  let destination = "/";
  if (requestedPath?.startsWith("/")) {
    const requestedUrl = new URL(requestedPath, callbackUrl.origin);
    if (requestedUrl.origin === callbackUrl.origin) {
      destination = `${requestedUrl.pathname}${requestedUrl.search}${requestedUrl.hash}`;
    }
  }
  const errorDestination = destination === "/reset-password"
    ? "/forgot-password?error=invalid-link"
    : "/login?error=verification";

  if (!code) {
    return NextResponse.redirect(new URL(errorDestination, callbackUrl));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(errorDestination, callbackUrl));
  }

  return NextResponse.redirect(new URL(destination, callbackUrl));
}
