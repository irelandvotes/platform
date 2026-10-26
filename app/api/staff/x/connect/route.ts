import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff/auth";
import {
  createPkcePair,
  cookieOptions,
  isXIntegrationConfigured,
  setOauthTransientCookies,
  xCallbackUrl,
  xClientId,
} from "@/lib/staff/xOAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { user, role } = await getStaffContext();
  const returnUrl = new URL("/staff/tools/polling-graphics/create", request.url);
  if (!user) {
    return NextResponse.redirect(new URL("/staff/login?next=%2Fstaff%2Ftools%2Fpolling-graphics%2Fcreate", request.url));
  }
  if (!role) {
    return NextResponse.redirect(new URL("/staff/login?error=not-staff", request.url));
  }
  if (!isXIntegrationConfigured()) {
    returnUrl.searchParams.set("x", "setup-required");
    return NextResponse.redirect(returnUrl);
  }

  const state = randomBytes(32).toString("base64url");
  const { verifier, challenge } = createPkcePair();
  const callbackUrl = xCallbackUrl(request.url);
  const authorizeUrl = new URL("https://x.com/i/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: xClientId(),
    redirect_uri: callbackUrl,
    scope: "tweet.write users.read media.write offline.access",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const response = NextResponse.redirect(authorizeUrl);
  setOauthTransientCookies(response, state, verifier);
  response.cookies.set("iv_staff_x_oauth_return", callbackUrl, cookieOptions("/api/staff/x/callback", 10 * 60));
  return response;
}
