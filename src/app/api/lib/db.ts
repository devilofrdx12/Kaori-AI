import {
  createClient,
  type Client,
  type InArgs,
} from "@tursodatabase/serverless/compat";
import fs from "fs/promises";
import path from "path";
import { decryptContent, encryptContent } from "./crypto";

let _db: Client | null = null;
let _initPromise: Promise<void> | null = null;

function createTursoClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is required for database access.");
  }

  if (url.startsWith("libsql://") && !authToken) {
    throw new Error("TURSO_AUTH_TOKEN is required for remote Turso databases.");
  }

  return createClient({
    url,
    authToken,
  });
}

function isDuplicateColumnError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("duplicate column");
}

async function initializeDb(db: Client) {
  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf-8");

  await db.execute("PRAGMA foreign_keys = ON");
  await db.executeMultiple(schema);

  try {
    await db.execute(
      "ALTER TABLE conversations ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0"
    );
  } catch (error) {
    if (!isDuplicateColumnError(error)) throw error;
  }

  try {
    await db.execute(
      "ALTER TABLE users ADD COLUMN is_pro INTEGER NOT NULL DEFAULT 0"
    );
  } catch (error) {
    if (!isDuplicateColumnError(error)) throw error;
  }

  try {
    await db.execute(
      "ALTER TABLE conversations ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL"
    );
  } catch (error) {
    if (!isDuplicateColumnError(error)) throw error;
  }

  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_convs_project ON conversations(project_id, updated_at DESC)"
  );
}

export async function getDb(): Promise<Client> {
  if (!_db) {
    _db = createTursoClient();
  }

  if (!_initPromise) {
    const db = _db;
    _initPromise = initializeDb(db).catch((error) => {
      // Do not permanently poison this process after a transient database or
      // filesystem failure. A later request should be able to initialize again.
      _initPromise = null;
      throw error;
    });
  }

  await _initPromise;
  return _db;
}

export function mapRows<T>(result: any): T[] {
  if (!result.rows || result.rows.length === 0) return [];
  if (!Array.isArray(result.rows[0])) {
    return result.rows as T[];
  }
  const columns = result.columns || [];
  return result.rows.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

async function getOne<T>(sql: string, args?: InArgs): Promise<T | undefined> {
  const db = await getDb();
  const result = await db.execute({ sql, args });
  const rows = mapRows<T>(result);
  return rows[0];
}

async function getAll<T>(sql: string, args?: InArgs): Promise<T[]> {
  const db = await getDb();
  const result = await db.execute({ sql, args });
  return mapRows<T>(result);
}

async function run(sql: string, args?: InArgs): Promise<void> {
  const db = await getDb();
  await db.execute({ sql, args });
}

// USER HELPERS

export type DBUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  relationship_xp: number;
  daily_spend_usd: number;
  spend_reset_date: number;
  briefing_cache: string | null;
  briefing_generated_at: number | null;
  is_pro: number;
  created_at: number;
};

export async function findUserByEmail(email: string): Promise<DBUser | undefined> {
  return getOne<DBUser>(
    "SELECT * FROM users WHERE email = ? COLLATE NOCASE",
    [email.toLowerCase()]
  );
}

export async function findUserById(id: string): Promise<DBUser | undefined> {
  return getOne<DBUser>("SELECT * FROM users WHERE id = ?", [id]);
}

export async function createUser(user: {
  id: string;
  name: string;
  email: string;
  password_hash: string;
}): Promise<DBUser> {
  await run(
    `INSERT INTO users (id, name, email, password_hash)
     VALUES (?, ?, ?, ?)`,
    [user.id, user.name, user.email, user.password_hash]
  );
  return (await findUserById(user.id))!;
}

export async function updateUserProStatus(id: string, isPro: boolean) {
  await run("UPDATE users SET is_pro = ? WHERE id = ?", [isPro ? 1 : 0, id]);
}

// CONVERSATION HELPERS

export type DBConversation = {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  provider: string;
  model: string;
  is_starred: number;
  created_at: number;
  updated_at: number;
};

export async function getUserConversations(userId: string): Promise<DBConversation[]> {
  return getAll<DBConversation>(
    "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
    [userId]
  );
}

export async function findConversation(id: string): Promise<DBConversation | undefined> {
  return getOne<DBConversation>("SELECT * FROM conversations WHERE id = ?", [id]);
}

export async function createConversation(conv: {
  id: string;
  user_id: string;
  title: string;
  project_id?: string | null;
  provider?: string;
  model?: string;
}): Promise<DBConversation> {
  await run(
    `INSERT INTO conversations (id, user_id, project_id, title, provider, model)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      conv.id,
      conv.user_id,
      conv.project_id || null,
      conv.title,
      conv.provider || "google",
      conv.model || "gemini-1.5-pro",
    ]
  );
  return (await findConversation(conv.id))!;
}

// PROJECT HELPERS

export type DBProject = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  instructions: string;
  created_at: number;
  updated_at: number;
};

export async function getUserProjects(userId: string): Promise<DBProject[]> {
  return getAll<DBProject>(
    "SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC",
    [userId]
  );
}

export async function findProject(id: string): Promise<DBProject | undefined> {
  return getOne<DBProject>("SELECT * FROM projects WHERE id = ?", [id]);
}

export async function createProject(project: {
  id: string;
  user_id: string;
  name: string;
  description: string;
  instructions: string;
}): Promise<DBProject> {
  await run(
    `INSERT INTO projects (id, user_id, name, description, instructions)
     VALUES (?, ?, ?, ?, ?)`,
    [project.id, project.user_id, project.name, project.description, project.instructions]
  );
  return (await findProject(project.id))!;
}

export async function updateProject(
  id: string,
  fields: { name: string; description: string; instructions: string }
): Promise<DBProject> {
  await run(
    `UPDATE projects
     SET name = ?, description = ?, instructions = ?, updated_at = unixepoch()
     WHERE id = ?`,
    [fields.name, fields.description, fields.instructions, id]
  );
  return (await findProject(id))!;
}

export async function deleteProject(id: string): Promise<void> {
  await run("DELETE FROM projects WHERE id = ?", [id]);
}

export async function getProjectConversationCount(projectId: string): Promise<number> {
  const result = await getOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM conversations WHERE project_id = ?",
    [projectId]
  );
  return Number(result?.count || 0);
}

// MEMORY HELPERS

export type DBUserMemory = {
  id: string;
  user_id: string;
  content: string;
  tags: string;
  source_conv_id: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
};

export async function getUserMemories(userId: string): Promise<DBUserMemory[]> {
  return getAll<DBUserMemory>(
    "SELECT * FROM user_memories WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC",
    [userId]
  );
}

export async function findUserMemory(id: string): Promise<DBUserMemory | undefined> {
  return getOne<DBUserMemory>("SELECT * FROM user_memories WHERE id = ?", [id]);
}

export async function createUserMemory(memory: {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
}): Promise<DBUserMemory> {
  await run(
    `INSERT INTO user_memories (id, user_id, content, tags)
     VALUES (?, ?, ?, ?)`,
    [memory.id, memory.user_id, memory.content, JSON.stringify(memory.tags)]
  );
  return (await findUserMemory(memory.id))!;
}

export async function updateUserMemory(
  id: string,
  fields: { content: string; tags: string[] }
): Promise<DBUserMemory> {
  await run(
    `UPDATE user_memories
     SET content = ?, tags = ?, updated_at = unixepoch()
     WHERE id = ?`,
    [fields.content, JSON.stringify(fields.tags), id]
  );
  return (await findUserMemory(id))!;
}

export async function deleteUserMemory(id: string): Promise<void> {
  await run("DELETE FROM user_memories WHERE id = ?", [id]);
}

export async function updateConversationTitle(id: string, title: string) {
  await run(
    "UPDATE conversations SET title = ?, updated_at = unixepoch() WHERE id = ?",
    [title, id]
  );
}

export async function touchConversation(id: string) {
  await run("UPDATE conversations SET updated_at = unixepoch() WHERE id = ?", [id]);
}

export async function toggleConversationStar(id: string, isStarred: number) {
  await run(
    "UPDATE conversations SET is_starred = ?, updated_at = unixepoch() WHERE id = ?",
    [isStarred, id]
  );
}

export async function deleteConversation(id: string) {
  const db = await getDb();
  await db.batch(
    [
      { sql: "DELETE FROM messages WHERE conversation_id = ?", args: [id] },
      { sql: "DELETE FROM conversations WHERE id = ?", args: [id] },
    ],
    "write"
  );
}

export async function deleteUserConversations(userId: string) {
  await run("DELETE FROM conversations WHERE user_id = ?", [userId]);
}

// MESSAGE HELPERS

export type DBMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  status: string;
  reactions: string;
  tool_use_id: string | null;
  created_at: number;
};

export async function getConversationMessages(
  conversationId: string
): Promise<DBMessage[]> {
  return getAll<DBMessage>(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC",
    [conversationId]
  );
}

export async function insertMessage(msg: {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  status?: string;
  tool_use_id?: string;
}) {
  await run(
    `INSERT INTO messages (id, conversation_id, role, content, status, tool_use_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.conversation_id,
      msg.role,
      msg.content,
      msg.status || "complete",
      msg.tool_use_id || null,
    ]
  );
}

export async function deleteMessagesFrom(conversationId: string, messageId: string) {
  const targetMsg = await getOne<{ created_at: number; row_id: number }>(
    "SELECT created_at, rowid AS row_id FROM messages WHERE id = ? AND conversation_id = ?",
    [messageId, conversationId]
  );

  if (targetMsg) {
    await run(
      `DELETE FROM messages
       WHERE conversation_id = ?
         AND (created_at > ? OR (created_at = ? AND rowid >= ?))`,
      [
        conversationId,
        targetMsg.created_at,
        targetMsg.created_at,
        targetMsg.row_id,
      ]
    );
  }
}

// REFRESH TOKEN HELPERS

export type DBRefreshToken = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
};

export async function insertRefreshToken(token: {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  user_agent?: string;
  ip?: string;
}) {
  await run(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      token.id,
      token.user_id,
      token.token_hash,
      token.expires_at,
      token.user_agent || null,
      token.ip || null,
    ]
  );
}

export async function findRefreshTokenByHash(
  hash: string
): Promise<DBRefreshToken | undefined> {
  return getOne<DBRefreshToken>("SELECT * FROM refresh_tokens WHERE token_hash = ?", [
    hash,
  ]);
}

export async function deleteRefreshToken(id: string) {
  await run("DELETE FROM refresh_tokens WHERE id = ?", [id]);
}

export async function deleteUserRefreshTokens(userId: string) {
  await run("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
}

// Password Reset Tokens

export type DBPasswordResetToken = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
};

export async function insertPasswordResetToken(token: {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
}) {
  await run(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [token.id, token.user_id, token.token_hash, token.expires_at]
  );
}

export async function findPasswordResetTokenByHash(
  hash: string
): Promise<DBPasswordResetToken | undefined> {
  return getOne<DBPasswordResetToken>(
    "SELECT * FROM password_reset_tokens WHERE token_hash = ?",
    [hash]
  );
}

export async function deletePasswordResetToken(id: string) {
  await run("DELETE FROM password_reset_tokens WHERE id = ?", [id]);
}

export async function deleteUserPasswordResetTokens(userId: string) {
  await run("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId]);
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
}

// OAuth Tokens

export type DBOAuthToken = {
  id: string;
  user_id: string;
  provider: string;
  access_token_enc: string;
  refresh_token_enc?: string | null;
  expires_at?: number | null;
  scope?: string | null;
  created_at: number;
};

export async function upsertOAuthToken(token: Omit<DBOAuthToken, "created_at">) {
  await run(
    `INSERT INTO oauth_tokens (id, user_id, provider, access_token_enc, refresh_token_enc, expires_at, scope)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET
       access_token_enc = excluded.access_token_enc,
       refresh_token_enc = COALESCE(excluded.refresh_token_enc, oauth_tokens.refresh_token_enc),
       expires_at = excluded.expires_at,
       scope = excluded.scope`,
    [
      token.id,
      token.user_id,
      token.provider,
      token.access_token_enc,
      token.refresh_token_enc || null,
      token.expires_at || null,
      token.scope || null,
    ]
  );
}

export async function getOAuthToken(
  userId: string,
  provider: string
): Promise<DBOAuthToken | undefined> {
  return getOne<DBOAuthToken>(
    "SELECT * FROM oauth_tokens WHERE user_id = ? AND provider = ?",
    [userId, provider]
  );
}

export async function deleteOAuthToken(userId: string, provider: string) {
  await run("DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?", [
    userId,
    provider,
  ]);
}

// ══════════════════════════════════════════
// DOCUMENTS HELPERS
// ══════════════════════════════════════════

export type DBDocument = {
  id: string;
  user_id: string;
  filename: string;
  format: string;
  content: string;
  created_at: number;
};

export async function createDocument(doc: {
  id: string;
  user_id: string;
  filename: string;
  format: string;
  content: string;
}) {
  await run(
    `INSERT INTO documents (id, user_id, filename, format, content)
     VALUES (?, ?, ?, ?, ?)`,
    [doc.id, doc.user_id, doc.filename, doc.format, encryptContent(doc.content)]
  );
}

export async function getDocument(id: string): Promise<DBDocument | undefined> {
  const doc = await getOne<DBDocument>("SELECT * FROM documents WHERE id = ?", [id]);
  return doc ? { ...doc, content: decryptContent(doc.content) } : undefined;
}
