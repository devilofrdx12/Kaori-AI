-- Kaori AI — Database Schema (v8)
-- SQLite with WAL mode, foreign keys enabled

-- ══════════════════════════════════════════
-- USERS
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  relationship_xp INTEGER NOT NULL DEFAULT 0,
  daily_spend_usd REAL NOT NULL DEFAULT 0,
  spend_reset_date INTEGER NOT NULL DEFAULT (unixepoch()),
  briefing_cache TEXT,
  briefing_generated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ══════════════════════════════════════════
-- AUTH — Refresh Token Rotation
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  user_agent TEXT,
  ip TEXT
);

-- ══════════════════════════════════════════
-- CONVERSATIONS + MESSAGES
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  provider TEXT NOT NULL DEFAULT 'anthropic',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete' CHECK(status IN ('streaming', 'complete', 'error')),
  reactions TEXT NOT NULL DEFAULT '{}',
  tool_use_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ══════════════════════════════════════════
-- MEMORY SYSTEM
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  source_conv_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER
);

-- ══════════════════════════════════════════
-- OAUTH TOKENS (AES-256-GCM encrypted)
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  expires_at INTEGER,
  scope TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, provider)
);

-- ══════════════════════════════════════════
-- SCHEDULED TASKS + MONITORS
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  check_selector TEXT,
  condition TEXT NOT NULL,
  last_value TEXT,
  check_interval_mins INTEGER NOT NULL DEFAULT 60,
  active INTEGER NOT NULL DEFAULT 1
);

-- ══════════════════════════════════════════
-- PROMPT TEMPLATES + STUDY SESSIONS
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  weak_topics TEXT,
  date INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ══════════════════════════════════════════
-- RATE LIMITING (SQLite-backed — survives restarts)
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  PRIMARY KEY (user_id, bucket)
);

-- ══════════════════════════════════════════
-- PRODUCTIVITY (v7)
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high')),
  due_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS snippets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ══════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_convs_user ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, done, due_at);
CREATE INDEX IF NOT EXISTS idx_snippets_user ON snippets(user_id, created_at DESC);
