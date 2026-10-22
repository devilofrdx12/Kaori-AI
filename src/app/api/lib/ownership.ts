import { getDb, mapRows } from "./db";

/**
 * IDOR protection — always verify resource ownership before access.
 * Returns 404 (not 403) to avoid confirming resource existence to attackers.
 */

/** Result of an ownership verification check. */
export type OwnershipResult =
  | { ok: true }
  | { ok: false; status: 404; error: string };

/**
 * Verifies the authenticated user owns the specified conversation.
 * Throws a 404 Response if not found or not owned, preventing IDOR attacks.
 */
export async function requireConversationOwner(
  conversationId: string,
  userId: string
) {
  const db = await getDb();
  const rows = mapRows<{ user_id: string }>(await db.execute({
    sql: "SELECT user_id FROM conversations WHERE id = ?",
    args: [conversationId],
  }));
  const conv = rows[0];

  if (!conv || conv.user_id !== userId) {
    throw new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return conv;
}

/**
 * Verifies the authenticated user owns the specified memory entry.
 * Throws a 404 Response if not found or not owned, preventing IDOR attacks.
 */
export async function requireMemoryOwner(
  memoryId: string,
  userId: string
) {
  const db = await getDb();
  const rows = mapRows<{ user_id: string }>(await db.execute({
    sql: "SELECT user_id FROM user_memories WHERE id = ?",
    args: [memoryId],
  }));
  const mem = rows[0];

  if (!mem || mem.user_id !== userId) {
    throw new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return mem;
}

/** Verifies the authenticated user owns the specified project. */
export async function requireProjectOwner(
  projectId: string,
  userId: string
): Promise<OwnershipResult> {
  const db = await getDb();
  const rows = mapRows<{ user_id: string }>(await db.execute({
    sql: "SELECT user_id FROM projects WHERE id = ?",
    args: [projectId],
  }));
  const project = rows[0];
  if (!project || project.user_id !== userId) {
    return { ok: false, status: 404, error: "Project not found" };
  }
  return { ok: true };
}

