import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const X_SESSION_COOKIE = "iv_staff_x_session";
export const X_OAUTH_STATE_COOKIE = "iv_staff_x_state";
export const X_OAUTH_VERIFIER_COOKIE = "iv_staff_x_verifier";

const X_COOKIE_PATH = "/api/staff/x";
const OAUTH_CALLBACK_PATH = "/api/staff/x/callback";

export type XSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  userId: string;
  username: string;
};

export function xClientId() {
  return process.env.X_CLIENT_ID?.trim() ?? "";
}

export function isXIntegrationConfigured() {
  return Boolean(xClientId() && process.env.X_TOKEN_ENCRYPTION_KEY?.trim());
}

export function xCallbackUrl(requestUrl: string) {
  return new URL(OAUTH_CALLBACK_PATH, new URL(requestUrl).origin).toString();
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function cookieOptions(path: string, maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path,
    maxAge,
  };
}

function encryptionKey() {
  const secret = process.env.X_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("X_TOKEN_ENCRYPTION_KEY must contain at least 32 characters.");
  }
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: XSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string): XSession | null {
  try {
    const [ivText, tagText, encryptedText] = value.split(".");
    if (!ivText || !tagText || !encryptedText) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(decrypted) as Partial<XSession>;
    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.username !== "string"
    ) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      expiresAt: parsed.expiresAt,
      userId: parsed.userId,
      username: parsed.username,
    };
  } catch {
    return null;
  }
}

export async function readXSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(X_SESSION_COOKIE)?.value;
  return value ? decrypt(value) : null;
}

export function setXSessionCookie(response: NextResponse, session: XSession) {
  response.cookies.set(X_SESSION_COOKIE, encrypt(session), cookieOptions(X_COOKIE_PATH, 60 * 60 * 24 * 90));
}

export function clearXSessionCookie(response: NextResponse) {
  response.cookies.set(X_SESSION_COOKIE, "", cookieOptions(X_COOKIE_PATH, 0));
}

export async function refreshXSession(session: XSession): Promise<XSession | null> {
  if (session.expiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
  });
  const clientId = xClientId();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  if (!clientSecret) body.set("client_id", clientId);

  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  }
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });
  if (!response.ok) return null;

  const tokens = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!tokens.access_token || !tokens.expires_in) return null;
  return {
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

export function setOauthTransientCookies(response: NextResponse, state: string, verifier: string) {
  response.cookies.set(X_OAUTH_STATE_COOKIE, state, cookieOptions(OAUTH_CALLBACK_PATH, 10 * 60));
  response.cookies.set(X_OAUTH_VERIFIER_COOKIE, verifier, cookieOptions(OAUTH_CALLBACK_PATH, 10 * 60));
}

export function clearOauthTransientCookies(response: NextResponse) {
  response.cookies.set(X_OAUTH_STATE_COOKIE, "", cookieOptions(OAUTH_CALLBACK_PATH, 0));
  response.cookies.set(X_OAUTH_VERIFIER_COOKIE, "", cookieOptions(OAUTH_CALLBACK_PATH, 0));
}
