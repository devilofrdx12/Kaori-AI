import { NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { getQuartzwallStats } from "../../lib/quartzwall";

export async function GET(req: Request) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getQuartzwallStats(user.id);
  return NextResponse.json({ stats });
}
