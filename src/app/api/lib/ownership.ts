import { getDb, mapRows } from "./db";

/**
 * IDOR protection — always verify resource ownership before access.
 * Returns 404 (not 403) to avoid confirming resource existence to attackers.
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

export async function requireMemoryOwner(memoryId: string, userId: string) {
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
}

export async function requireProjectOwner(projectId: string, userId: string) {
  const db = await getDb();
  const rows = mapRows<{ user_id: string }>(await db.execute({
    sql: "SELECT user_id FROM projects WHERE id = ?",
    args: [projectId],
  }));
  const project = rows[0];
  if (!project) return { ok: false as const, status: 404, error: "Project not found" };
  if (project.user_id !== userId) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const };
}

export async function requireTaskOwner(taskId: string, userId: string) {
  const db = await getDb();
  const rows = mapRows<{ user_id: string }>(await db.execute({
    sql: "SELECT user_id FROM tasks WHERE id = ?",
    args: [taskId],
  }));
  const task = rows[0];

  if (!task || task.user_id !== userId) {
    throw new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
