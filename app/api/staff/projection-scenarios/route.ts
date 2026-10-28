import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/staff/auth";

export const runtime = "nodejs";

const MODELS = new Set(["hoc", "nia"]);
const SCENARIO_FIELDS = "id,name,settings,updated_at";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function validModel(value: unknown): value is "hoc" | "nia" {
  return typeof value === "string" && MODELS.has(value);
}

function validSettings(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authorize() {
  const { supabase, user, role } = await getStaffContext();
  if (!user) return jsonError("Sign in to staff first.", 401);
  if (!role) return jsonError("Staff access is required.", 403);
  return { supabase, user };
}

export async function GET(request: Request) {
  const context = await authorize();
  if (context instanceof NextResponse) return context;
  const model = new URL(request.url).searchParams.get("model");
  if (!validModel(model)) return jsonError("Choose a valid projection model.");

  const { data, error } = await context.supabase
    .from("staff_projection_scenarios")
    .select(SCENARIO_FIELDS)
    .eq("model", model)
    .order("name", { ascending: true });

  if (error) {
    console.error("Could not load projection scenarios", error);
    return jsonError("Shared scenarios are unavailable. Apply the staff projection scenarios migration in Supabase, then refresh.", 503);
  }
  return NextResponse.json({ scenarios: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const context = await authorize();
  if (context instanceof NextResponse) return context;
  if (request.headers.get("origin") !== new URL(request.url).origin) return jsonError("Invalid request origin.", 403);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 100_000) return jsonError("Scenario settings are too large.", 413);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.");
  }
  const { model, name, settings, id } = body;
  if (!validModel(model)) return jsonError("Choose a valid projection model.");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 60) return jsonError("Scenario names must be between 1 and 60 characters.");
  if (!validSettings(settings)) return jsonError("Scenario settings are invalid.");

  const values = { model, name: name.trim(), settings, updated_at: new Date().toISOString() };
  const query = typeof id === "string" && id
    ? context.supabase.from("staff_projection_scenarios").update(values).eq("id", id).eq("model", model)
    : context.supabase.from("staff_projection_scenarios").insert(values);
  const { data, error } = await query.select(SCENARIO_FIELDS).single();

  if (error || !data) {
    console.error("Could not save projection scenario", error);
    return jsonError("Could not save the shared scenario. If the table was just created, refresh and try again.", 503);
  }
  return NextResponse.json({ scenario: data });
}

export async function DELETE(request: Request) {
  const context = await authorize();
  if (context instanceof NextResponse) return context;
  if (request.headers.get("origin") !== new URL(request.url).origin) return jsonError("Invalid request origin.", 403);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.");
  }
  if (!validModel(body.model) || typeof body.id !== "string") return jsonError("Scenario id or model is invalid.");

  const { error } = await context.supabase
    .from("staff_projection_scenarios")
    .delete()
    .eq("id", body.id)
    .eq("model", body.model);

  if (error) {
    console.error("Could not delete projection scenario", error);
    return jsonError("Could not delete the shared scenario.", 503);
  }
  return NextResponse.json({ deleted: true });
}
