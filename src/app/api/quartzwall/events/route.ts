import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { listQuartzwallEvents } from "../../lib/quartzwall";

export async function GET(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 50;
  const events = await listQuartzwallEvents(user.id, Number.isFinite(limit) ? limit : 50);

  return NextResponse.json({ events });
}
