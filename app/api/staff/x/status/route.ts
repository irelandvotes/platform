import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff/auth";
import {
  clearXSessionCookie,
  isXIntegrationConfigured,
  readXSession,
  refreshXSession,
  setXSessionCookie,
} from "@/lib/staff/xOAuth";

export const runtime = "nodejs";

export async function GET() {
  const { user, role } = await getStaffContext();
  if (!user) return NextResponse.json({ error: "Sign in to staff first." }, { status: 401 });
  if (!role) return NextResponse.json({ error: "Staff access is required." }, { status: 403 });

  if (!isXIntegrationConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }

  const session = await readXSession();
  if (!session) return NextResponse.json({ configured: true, connected: false });

  const refreshed = await refreshXSession(session);
  const response = NextResponse.json({
    configured: true,
    connected: Boolean(refreshed),
    username: refreshed?.username,
  });
  if (refreshed && refreshed !== session) setXSessionCookie(response, refreshed);
  if (!refreshed) clearXSessionCookie(response);
  return response;
}

export async function DELETE(request: Request) {
  const { user, role } = await getStaffContext();
  if (!user) return NextResponse.json({ error: "Sign in to staff first." }, { status: 401 });
  if (!role) return NextResponse.json({ error: "Staff access is required." }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const response = NextResponse.json({ disconnected: true });
  clearXSessionCookie(response);
  return response;
}
