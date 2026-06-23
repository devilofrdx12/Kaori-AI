import { NextRequest } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { logger } from "../../lib/logger";

/**
 * POST /api/user/pro — DISABLED
 * Pro status should only be changed through a verified billing/admin flow,
 * not an unauthenticated client toggle.
 */
export async function POST(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SECURITY: Reject client-side Pro toggling.
  // Pro status should only be set through a verified payment/admin flow.
  logger.warn({ userId: user.id }, "Blocked unauthorized Pro toggle attempt");
  return new Response(
    JSON.stringify({ error: "Pro status cannot be changed from the client. Please upgrade through the billing portal." }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

export async function GET(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ is_pro: user.is_pro }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
