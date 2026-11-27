import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../lib/auth-utils";
import { getMemorySettings, updateMemorySettings } from "../lib/memory/service";
import { readJsonBodyWithLimit, RequestBodyError } from "../lib/request-body";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getMemorySettings(user.id));
}

export async function PATCH(req: NextRequest) {
  try {
    requireAjax(req);
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await readJsonBodyWithLimit(req, 16 * 1024);
    const allowed = ["enabled", "readEnabled", "suggestionsEnabled", "autoSavePreferences"] as const;
    const updates: Record<string, boolean> = {};
    for (const key of allowed) if (typeof body[key] === "boolean") updates[key] = body[key];
    return NextResponse.json(await updateMemorySettings(user.id, updates));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to update memory settings" }, { status: 400 });
  }
}
