import { getDb } from "./db";

/**
 * IDOR protection — always verify resource ownership before access.
 * Returns 404 (not 403) to avoid confirming resource existence to attackers.
 */

export function requireConversationOwner(
  conversationId: string,
  userId: string
) {
  const db = getDb();
  const conv = db
    .prepare("SELECT user_id FROM conversations WHERE id = ?")
    .get(conversationId) as { user_id: string } | undefined;

  if (!conv || conv.user_id !== userId) {
    throw new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return conv;
}

export function requireMemoryOwner(memoryId: string, userId: string) {
  const db = getDb();
  const mem = db
    .prepare("SELECT user_id FROM user_memories WHERE id = ?")
    .get(memoryId) as { user_id: string } | undefined;

  if (!mem || mem.user_id !== userId) {
    throw new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function requireTaskOwner(taskId: string, userId: string) {
  const db = getDb();
  const task = db
    .prepare("SELECT user_id FROM tasks WHERE id = ?")
    .get(taskId) as { user_id: string } | undefined;

  if (!task || task.user_id !== userId) {
    throw new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
