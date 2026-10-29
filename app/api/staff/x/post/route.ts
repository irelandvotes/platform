import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff/auth";
import {
  clearXSessionCookie,
  readXSession,
  refreshXSession,
  setXSessionCookie,
  XSession,
} from "@/lib/staff/xOAuth";

export const runtime = "nodejs";

const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
const MEDIA_CHUNK_BYTES = 1024 * 1024;

type XErrorBody = {
  detail?: string;
  title?: string;
  errors?: Array<{ detail?: string; title?: string }>;
  data?: { id?: string; media_key?: string };
};

async function readXResponse(response: Response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as XErrorBody;
  } catch {
    return { detail: raw.slice(0, 300) } satisfies XErrorBody;
  }
}

function xErrorMessage(body: XErrorBody, fallback: string) {
  return body.errors?.[0]?.detail ?? body.errors?.[0]?.title ?? body.detail ?? body.title ?? fallback;
}

function jsonWithSession(
  body: Record<string, unknown>,
  status: number,
  session?: XSession | null,
  originalSession?: XSession | null,
) {
  const response = NextResponse.json(body, { status });
  if (session && session !== originalSession) setXSessionCookie(response, session);
  return response;
}

export async function POST(request: Request) {
  const { user, role } = await getStaffContext();
  if (!user) return NextResponse.json({ error: "Sign in to staff first." }, { status: 401 });
  if (!role) return NextResponse.json({ error: "Staff access is required." }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MEDIA_BYTES + 100_000) {
    return NextResponse.json({ error: "The generated graphic is too large to publish from this tool." }, { status: 413 });
  }

  const originalSession = await readXSession();
  if (!originalSession) return NextResponse.json({ error: "Connect an X account before posting." }, { status: 401 });
  const session = await refreshXSession(originalSession);
  if (!session) {
    const response = NextResponse.json({ error: "Your X connection expired. Reconnect the account and try again." }, { status: 401 });
    clearXSessionCookie(response);
    return response;
  }

  try {
    const form = await request.formData();
    const text = form.get("text");
    const image = form.get("graphic");
    if (typeof text !== "string" || !text.trim() || text.length > 4000) {
      return jsonWithSession({ error: "Add post text before publishing." }, 400, session, originalSession);
    }
    if (!(image instanceof File) || !["image/png", "image/gif"].includes(image.type) || image.size === 0 || image.size > MAX_MEDIA_BYTES) {
      return jsonWithSession({ error: "The graphic must be a PNG or GIF smaller than 4 MB." }, 400, session, originalSession);
    }

    const isGif = image.type === "image/gif";
    const imageBytes = Buffer.from(await image.arrayBuffer());
    const authorization = { Authorization: `Bearer ${session.accessToken}` };
    const initializeResponse = await fetch("https://api.x.com/2/media/upload/initialize", {
      method: "POST",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: image.type,
        media_category: isGif ? "tweet_gif" : "tweet_image",
        total_bytes: imageBytes.byteLength,
      }),
      cache: "no-store",
    });
    const initialized = await readXResponse(initializeResponse);
    const mediaId = initialized.data?.id;
    if (!initializeResponse.ok || !mediaId) {
      const message = xErrorMessage(initialized, "X could not start the graphic upload.");
      return jsonWithSession({ error: message }, initializeResponse.status >= 400 ? initializeResponse.status : 502, session, originalSession);
    }

    for (let offset = 0, segmentIndex = 0; offset < imageBytes.length; offset += MEDIA_CHUNK_BYTES, segmentIndex += 1) {
      const chunk = imageBytes.subarray(offset, Math.min(offset + MEDIA_CHUNK_BYTES, imageBytes.length));
      const appendResponse = await fetch(`https://api.x.com/2/media/upload/${encodeURIComponent(mediaId)}/append`, {
        method: "POST",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ media: chunk.toString("base64"), segment_index: segmentIndex }),
        cache: "no-store",
      });
      if (!appendResponse.ok) {
        const appendError = await readXResponse(appendResponse);
        return jsonWithSession({ error: xErrorMessage(appendError, "X could not upload the polling graphic.") }, appendResponse.status, session, originalSession);
      }
    }

    const finalizeResponse = await fetch(`https://api.x.com/2/media/upload/${encodeURIComponent(mediaId)}/finalize`, {
      method: "POST",
      headers: authorization,
      cache: "no-store",
    });
    const finalized = await readXResponse(finalizeResponse);
    if (!finalizeResponse.ok) {
      return jsonWithSession({ error: xErrorMessage(finalized, "X could not finish uploading the polling graphic.") }, finalizeResponse.status, session, originalSession);
    }

    const postResponse = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.trim(),
        media: { media_ids: [mediaId] },
      }),
      cache: "no-store",
    });
    const posted = await readXResponse(postResponse);
    if (!postResponse.ok || !posted.data?.id) {
      return jsonWithSession({ error: xErrorMessage(posted, "X did not publish the post.") }, postResponse.status >= 400 ? postResponse.status : 502, session, originalSession);
    }

    return jsonWithSession({
      posted: true,
      postUrl: `https://x.com/${encodeURIComponent(session.username)}/status/${posted.data.id}`,
    }, 200, session, originalSession);
  } catch {
    return jsonWithSession({ error: "The post could not be sent to X. Check the connection and try again." }, 502, session, originalSession);
  }
}
