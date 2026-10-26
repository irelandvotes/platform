import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff/auth";
import {
  clearOauthTransientCookies,
  cookieOptions,
  isXIntegrationConfigured,
  setXSessionCookie,
  xCallbackUrl,
  xClientId,
  X_OAUTH_STATE_COOKIE,
  X_OAUTH_VERIFIER_COOKIE,
  XSession,
} from "@/lib/staff/xOAuth";

export const runtime = "nodejs";

function returnToStaff(requestUrl: string, result: string) {
  const destination = new URL("/staff/tools/polling-graphics/create", new URL(requestUrl).origin);
  destination.searchParams.set("x", result);
  return NextResponse.redirect(destination);
}

function clearOauthCookies(response: NextResponse) {
  clearOauthTransientCookies(response);
  response.cookies.set("iv_staff_x_oauth_return", "", cookieOptions("/api/staff/x/callback", 0));
}

export async function GET(request: Request) {
  const { user, role } = await getStaffContext();
  if (!user) return NextResponse.redirect(new URL("/staff/login?next=%2Fstaff%2Ftools%2Fpolling-graphics%2Fcreate", request.url));
  if (!role) return NextResponse.redirect(new URL("/staff/login?error=not-staff", request.url));

  const requestUrl = new URL(request.url);
  const providerError = requestUrl.searchParams.get("error");
  if (providerError) {
    const response = returnToStaff(request.url, "cancelled");
    clearOauthCookies(response);
    return response;
  }

  const stateCookie = request.headers.get("cookie")?.match(/(?:^|;\s*)iv_staff_x_state=([^;]+)/)?.[1];
  const verifierCookie = request.headers.get("cookie")?.match(/(?:^|;\s*)iv_staff_x_verifier=([^;]+)/)?.[1];
  const callbackCookie = request.headers.get("cookie")?.match(/(?:^|;\s*)iv_staff_x_oauth_return=([^;]+)/)?.[1];
  const decodedState = stateCookie ? decodeURIComponent(stateCookie) : "";
  const decodedVerifier = verifierCookie ? decodeURIComponent(verifierCookie) : "";
  const decodedCallback = callbackCookie ? decodeURIComponent(callbackCookie) : "";
  const expectedCallback = xCallbackUrl(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");

  if (!isXIntegrationConfigured() || !code || !state || state !== decodedState || !decodedVerifier || decodedCallback !== expectedCallback) {
    const response = returnToStaff(request.url, "connect-failed");
    clearOauthCookies(response);
    return response;
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: expectedCallback,
      code_verifier: decodedVerifier,
    });
    const clientId = xClientId();
    const clientSecret = process.env.X_CLIENT_SECRET?.trim();
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    if (clientSecret) {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    } else {
      tokenBody.set("client_id", clientId);
    }

    const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: tokenBody,
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error("Token exchange failed.");
    const tokens = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!tokens.access_token || !tokens.expires_in) throw new Error("X returned incomplete token data.");

    const profileResponse = await fetch("https://api.x.com/2/users/me?user.fields=username,name", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) throw new Error("Could not read the authorized X account.");
    const profile = await profileResponse.json() as { data?: { id?: string; username?: string } };
    if (!profile.data?.id || !profile.data.username) throw new Error("X returned incomplete account details.");

    const session: XSession = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      userId: profile.data.id,
      username: profile.data.username,
    };
    const destination = new URL("/staff/tools/polling-graphics/create?x=connected", new URL(request.url).origin);
    const response = NextResponse.redirect(destination);
    setXSessionCookie(response, session);
    clearOauthCookies(response);
    return response;
  } catch {
    const response = returnToStaff(request.url, "connect-failed");
    clearOauthCookies(response);
    return response;
  }
}
