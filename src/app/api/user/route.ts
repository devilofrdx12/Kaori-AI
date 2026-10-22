import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, getSessionUser, requireAjax } from "../lib/auth-utils";
import { deleteUserAccount } from "../lib/db";
import { logger } from "../lib/logger";

/**
 * DELETE /api/user — Permanently delete the authenticated user's account and all associated data.
 */
export async function DELETE(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteUserAccount(user.id);
    await clearAuthCookies();
    logger.info({ userId: user.id }, "User account permanently deleted");
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId: user.id }, "[DELETE /api/user] Error deleting account");
    return NextResponse.json({ error: "Unable to delete account right now." }, { status: 500 });
  }
}
