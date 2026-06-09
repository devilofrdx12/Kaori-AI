import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// ── Database path ──
const DB_PATH = path.resolve(process.env.DATABASE_PATH || "./.data/app.db");

// ── Singleton connection ──
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure directory exists
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Apply schema
  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    _db.exec(schema);
  }

  return _db;
}

// ══════════════════════════════════════════
// USER HELPERS
// ══════════════════════════════════════════

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
  created_at: number;
};

export function findUserByEmail(email: string): DBUser | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email.toLowerCase()) as DBUser | undefined;
}

export function findUserById(id: string): DBUser | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | DBUser
    | undefined;
}

export function createUser(user: {
  id: string;
  name: string;
  email: string;
  password_hash: string;
}): DBUser {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash)
     VALUES (@id, @name, @email, @password_hash)`
  ).run(user);
  return findUserById(user.id)!;
}

// ══════════════════════════════════════════
// CONVERSATION HELPERS
// ══════════════════════════════════════════

export type DBConversation = {
  id: string;
  user_id: string;
  title: string;
  provider: string;
  model: string;
  created_at: number;
  updated_at: number;
};

export function getUserConversations(userId: string): DBConversation[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC"
    )
    .all(userId) as DBConversation[];
}

export function findConversation(id: string): DBConversation | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
    | DBConversation
    | undefined;
}

export function createConversation(conv: {
  id: string;
  user_id: string;
  title: string;
  provider?: string;
  model?: string;
}): DBConversation {
  const db = getDb();
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, provider, model)
     VALUES (@id, @user_id, @title, @provider, @model)`
  ).run({
    id: conv.id,
    user_id: conv.user_id,
    title: conv.title,
    provider: conv.provider || "anthropic",
    model: conv.model || "claude-sonnet-4-20250514",
  });
  return findConversation(conv.id)!;
}

export function updateConversationTitle(id: string, title: string) {
  const db = getDb();
  db.prepare(
    "UPDATE conversations SET title = ?, updated_at = unixepoch() WHERE id = ?"
  ).run(title, id);
}

export function touchConversation(id: string) {
  const db = getDb();
  db.prepare(
    "UPDATE conversations SET updated_at = unixepoch() WHERE id = ?"
  ).run(id);
}

export function deleteConversation(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
}

// ══════════════════════════════════════════
// MESSAGE HELPERS
// ══════════════════════════════════════════

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

export function getConversationMessages(
  conversationId: string
): DBMessage[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    )
    .all(conversationId) as DBMessage[];
}

export function insertMessage(msg: {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  status?: string;
  tool_use_id?: string;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, status, tool_use_id)
     VALUES (@id, @conversation_id, @role, @content, @status, @tool_use_id)`
  ).run({
    id: msg.id,
    conversation_id: msg.conversation_id,
    role: msg.role,
    content: msg.content,
    status: msg.status || "complete",
    tool_use_id: msg.tool_use_id || null,
  });
}

// ══════════════════════════════════════════
// REFRESH TOKEN HELPERS
// ══════════════════════════════════════════

export function insertRefreshToken(token: {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  user_agent?: string;
  ip?: string;
}) {
  const db = getDb();
  db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip)
     VALUES (@id, @user_id, @token_hash, @expires_at, @user_agent, @ip)`
  ).run({
    ...token,
    user_agent: token.user_agent || null,
    ip: token.ip || null,
  });
}

export function findRefreshTokenByHash(
  hash: string
): { id: string; user_id: string; token_hash: string; expires_at: number } | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?")
    .get(hash) as any;
}

export function deleteRefreshToken(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(id);
}

export function deleteUserRefreshTokens(userId: string) {
  const db = getDb();
  db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId);
}
