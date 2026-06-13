# Kaori AI — Godmode Implementation Plan v8

> **v7 → v8:** Fixed in-memory rate limiting (→ SQLite-backed), separated encryption key from JWT secret, fixed daily briefing cache (→ SQLite), replaced WebSocket with SSE, added dynamic system prompt, rolling summary compression, scored memory retrieval, health check endpoint, CI/CD pipeline, and Neon PostgreSQL deployment decision.

> **v6 → v7:** Added Multi-Provider AI support (Phase 3.5), expanded Security
> hardening (JWT refresh tokens, message encryption, security headers, IDOR
> protection, file MIME validation, spend caps, session management), and new
> Productivity features (Task Manager, Snippet Vault, Daily Briefing,
> Conversation Export, Pomodoro/Focus Mode).

---

## ✅ Decisions (Final — v7 Locked)

| # | Decision | Chosen | Why |
|---|---|---|---|
| 1 | Database | **better-sqlite3 via WSL / Docker** | sql.js WASM loses data between Next.js cold starts |
| 2 | Anthropic client | **Raw fetch** | Already working in codebase |
| 3 | Avatar rendering | **CSS + Framer Motion** (Phase 2) | Canvas later if needed |
| 4 | Web search API | **Brave Search API** | Free: 2000 req/month |
| 5 | AI personality | **Kaori** — anime-girl assistant | Name confirmed |
| 6 | CSRF strategy | `sameSite: 'strict'` + `X-Requested-With` header check | Simple, effective |
| 7 | Tailwind animations | **Native CSS + Framer Motion** | tailwindcss-animate incompatible with v4 |
| 8 | PWA library | **@ducanh2912/next-pwa** | next-pwa incompatible with Next.js 16 |
| 9 | Temp file path | **`os.tmpdir()`** | Cross-platform, `/tmp` breaks on Windows |
| 10 | OAuth token encryption | **AES-256-GCM** with key derived from JWT_SECRET | Secure, no extra deps |
| 11 | Build order | **Phase 1 first, Phase 0A last** | Core must exist before extensions |
| 12 | Multi-provider strategy | **Provider Abstraction Layer** | Single interface, all APIs normalized |
| 13 | Message encryption | **AES-256-GCM** (same crypto.ts) | No extra deps, reuse existing key |
| 14 | JWT strategy | **Access token (15min) + Refresh token (7d)** | True session invalidation |

---

## ⚠️ Critical: sql.js Server-Side Fix

sql.js is a **browser** WASM library. On Next.js API routes (server-side), each serverless cold start gets a fresh in-memory database — **your data disappears.**

```bash
sudo apt-get install build-essential python3
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

```typescript
// src/app/api/lib/db.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.env.DATABASE_PATH || './.data/app.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync('./db/schema.sql', 'utf-8');
  _db.exec(schema);
  return _db;
}
```

---

## ⚠️ Pre-Implementation: Data Migration

```typescript
// scripts/migrate-json-to-sqlite.ts
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const USERS_JSON = path.join(process.cwd(), '.data/users.json');
const CHATS_JSON = path.join(process.cwd(), '.data/chats.json');
const DB_PATH    = path.join(process.cwd(), '.data/app.db');

async function migrate() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync('./db/schema.sql', 'utf-8'));

  const users = JSON.parse(fs.readFileSync(USERS_JSON, 'utf-8') || '[]');
  const chats = JSON.parse(fs.readFileSync(CHATS_JSON, 'utf-8') || '[]');

  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, name, email, password_hash, created_at)
     VALUES (@id, @name, @email, @password_hash, @created_at)`
  );
  const insertConv = db.prepare(
    `INSERT OR IGNORE INTO conversations (id, user_id, title, created_at, updated_at)
     VALUES (@id, @user_id, @title, @created_at, @updated_at)`
  );
  const insertMsg = db.prepare(
    `INSERT OR IGNORE INTO messages (id, conversation_id, role, content, created_at)
     VALUES (@id, @conversation_id, @role, @content, @created_at)`
  );

  const runAll = db.transaction(() => {
    for (const u of users) {
      insertUser.run({ id: u.id, name: u.name, email: u.email,
        password_hash: u.passwordHash, created_at: u.createdAt ?? Date.now() });
    }
    for (const c of chats) {
      insertConv.run({ id: c.id, user_id: c.userId, title: c.title,
        created_at: c.createdAt ?? Date.now(), updated_at: c.updatedAt ?? Date.now() });
      for (const msg of (c.messages ?? [])) {
        insertMsg.run({ id: msg.id, conversation_id: c.id, role: msg.role,
          content: JSON.stringify(msg.content), created_at: msg.createdAt ?? Date.now() });
      }
    }
  });

  runAll();
  console.log(`✅ Migrated ${users.length} users, ${chats.length} conversations`);
  db.close();
}

migrate().catch(console.error);
```

---

## Architecture Overview

```
projectfile/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── signup/route.ts
│   │       │   ├── me/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── refresh/route.ts          ← NEW v7 (JWT refresh)
│   │       ├── user/
│   │       │   ├── sessions/route.ts         ← NEW v7 (session management)
│   │       │   ├── export/route.ts           ← NEW v7 (GDPR export)
│   │       │   └── delete/route.ts           ← NEW v7 (GDPR delete)
│   │       ├── chat/route.ts
│   │       ├── chats/route.ts
│   │       ├── chats/[id]/route.ts
│   │       ├── chats/[id]/export/route.ts    ← NEW v7 (conversation export)
│   │       ├── files/[id]/route.ts
│   │       └── tools/
│   │           ├── web-search/route.ts
│   │           ├── web-fetch/route.ts
│   │           ├── image-gen/route.ts
│   │           ├── doc-gen/route.ts
│   │           ├── github/route.ts
│   │           ├── google/route.ts
│   │           ├── spotify/route.ts
│   │           ├── vision/route.ts
│   │           └── monitor/route.ts
│   ├── components/
│   │   ├── chat-layout.tsx
│   │   ├── sidebar.tsx
│   │   ├── chat-header.tsx
│   │   ├── message-area.tsx
│   │   ├── chat-input.tsx
│   │   ├── model-selector.tsx               ← UPDATED v7 (multi-provider)
│   │   ├── provider-selector.tsx            ← NEW v7
│   │   ├── code-block.tsx
│   │   ├── thinking-indicator.tsx
│   │   ├── typing-indicator.tsx
│   │   ├── animated-avatar.tsx
│   │   ├── reaction-emote.tsx
│   │   ├── message-reactions.tsx
│   │   ├── image-upload-preview.tsx
│   │   ├── tool-result-card.tsx
│   │   ├── login-form.tsx
│   │   ├── session-manager.tsx              ← NEW v7
│   │   ├── pomodoro-timer.tsx               ← NEW v7
│   │   └── settings-modal.tsx
│   └── lib/
│       ├── db.ts
│       ├── chat-api.ts
│       ├── tools.ts
│       ├── markdown.ts
│       ├── system-prompt.ts
│       ├── kaori-mood.ts
│       ├── scheduler.ts
│       ├── extension-bridge.ts
│       ├── crypto.ts
│       ├── providers/                        ← NEW v7 (multi-provider)
│       │   ├── index.ts
│       │   ├── anthropic.ts
│       │   ├── openai.ts
│       │   ├── google.ts
│       │   ├── groq.ts
│       │   ├── mistral.ts
│       │   └── types.ts
│       └── spend-guard.ts                   ← NEW v7
├── db/
│   └── schema.sql
├── scripts/
│   ├── migrate-json-to-sqlite.ts
│   └── backup-db.ts
├── kaori-extension/
│   ├── manifest.json
│   ├── background.js
│   └── content.js
├── kaori-agent.py
├── public/
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── .env.example
```

---

## .env.example (Complete — v7)

```env
# === REQUIRED ===
ANTHROPIC_API_KEY=sk-ant-...

# === AUTH ===
JWT_SECRET=your-random-secret-min-32-chars
JWT_REFRESH_SECRET=another-random-secret-min-32-chars   # NEW v7
ENCRYPTION_KEY=yet-another-random-secret-min-32-chars   # NEW v8 — NEVER reuse JWT_SECRET
COOKIE_DOMAIN=localhost

# === DATABASE ===
DATABASE_PATH=./.data/app.db

# === MULTI-PROVIDER AI (NEW v7) ===
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_KEY=AIza...
GROQ_API_KEY=gsk_...
MISTRAL_API_KEY=...

# === PHASE 3: WEB TOOLS ===
BRAVE_SEARCH_API_KEY=BSA...
GITHUB_TOKEN=ghp_...

# === PHASE 4: OAUTH ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/spotify/callback

# === OPTIONAL: IMAGE GENERATION ===
STABILITY_AI_KEY=
# Note: OPENAI_API_KEY above covers DALL-E too

# === OPTIONAL: TTS ===
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# === SPEND GUARD (NEW v7) ===
DAILY_SPEND_LIMIT_USD=2.00
```

---

## .gitignore

```gitignore
.env
.env.local
.env*.local
.data/
.next/
out/
node_modules/
.DS_Store
Thumbs.db
logs/
*.log
```

> ⚠️ **If you accidentally commit `.env` or `.data/`:** rotate ALL keys immediately.
> Use `git filter-repo` to purge history — deleting the file is not enough.

### API Key Rotation Checklist

```
□ Anthropic  → console.anthropic.com → API Keys → Revoke + Create New
□ OpenAI     → platform.openai.com   → API Keys → Delete + Create New
□ Google AI  → aistudio.google.com   → API Keys → Revoke
□ Groq       → console.groq.com      → API Keys → Revoke
□ Mistral    → console.mistral.ai    → API Keys → Revoke
□ Brave      → api.search.brave.com  → Regenerate key
□ GitHub     → Settings → Developer → Personal tokens → Revoke
□ Google     → console.cloud.google.com → Credentials → Delete + Create OAuth client
□ Spotify    → developer.spotify.com → Dashboard → Reset client secret
□ ElevenLabs → elevenlabs.io → Profile → API Keys → Revoke
□ Update .env on server immediately after rotating
□ Restart server to load new keys
```

---

## Package Dependencies (v7)

```json
{
  "dependencies": {
    "next": "16.2.7",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "better-sqlite3": "^9.6.0",
    "bcryptjs": "^3.0.3",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^14.0.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.400.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "rehype-highlight": "^7.0.0",
    "highlight.js": "^11.9.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/typography": "^0.5.15",
    "pdfkit": "^0.15.0",
    "docx": "^8.5.0",
    "exceljs": "^4.4.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.7.0",
    "papaparse": "^5.4.1",
    "node-cron": "^3.0.3",
    "ws": "^8.18.0",
    "canvas-confetti": "^1.9.3",
    "cheerio": "^1.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "file-type": "^19.0.0",
    "openai": "^4.0.0",
    "@google/generative-ai": "^0.21.0",
    "groq-sdk": "^0.13.0",
    "@mistralai/mistralai": "^1.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/bcryptjs": "^3.0.0",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node-cron": "^3.0.11",
    "@types/ws": "^8.5.12",
    "@types/canvas-confetti": "^1.6.4",
    "@ducanh2912/next-pwa": "^10.0.0",
    "typescript": "^5.6.0",
    "@sentry/nextjs": "^8.0.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

> **New in v7:** `file-type`, `openai`, `@google/generative-ai`, `groq-sdk`, `@mistralai/mistralai`, `vitest`

---

## Database Schema (Complete — v7)

```sql
-- db/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  relationship_xp INTEGER NOT NULL DEFAULT 0,
  daily_spend_usd REAL NOT NULL DEFAULT 0,
  spend_reset_date INTEGER NOT NULL DEFAULT (unixepoch()),
  briefing_cache TEXT,                                    -- NEW v8: cached daily briefing
  briefing_generated_at INTEGER,                          -- NEW v8: cache timestamp
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  user_agent TEXT,
  ip TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  provider TEXT NOT NULL DEFAULT 'anthropic',        -- NEW v7
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514', -- NEW v7
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,   -- AES-256-GCM encrypted (NEW v7)
  status TEXT NOT NULL DEFAULT 'complete' CHECK(status IN ('streaming', 'complete', 'error')),
  reactions TEXT NOT NULL DEFAULT '{}',
  tool_use_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS user_memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  source_conv_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER
);

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

CREATE TABLE IF NOT EXISTS rate_limits (
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  PRIMARY KEY (user_id, bucket)
);

-- NEW v7: Productivity tables
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

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_convs_user ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, done, due_at);
CREATE INDEX IF NOT EXISTS idx_snippets_user ON snippets(user_id, created_at DESC);
```

---

## Implementation Order (v7)

```
NOW         → Migration script (JSON → SQLite)
NOW         → Phase 0D: .gitignore + logger + backup + Sentry
Week 1-2    → Phase 1: Core chat + auth + streaming
Week 3      → Phase 2: Kaori avatar + personality
Week 4      → Phase 3: Web tools (Brave, doc gen, GitHub)
Week 4.5    → Phase 3.5: Multi-Provider AI ← NEW v7
Week 5      → Phase 4: OAuth (Google, Spotify)
Week 6      → Phase 5: Production polish + PWA
Week 6.5    → Phase 5.5: Security hardening ← NEW v7
Week 7      → Phase 6: Power features (memory, file chat, code runner)
Week 7.5    → Phase 6.5: Productivity features ← NEW v7
Week 8      → Phase 7: Personality + relationship + TTS
Week 9      → Phase 8: Glassmorphism + UI enhancements
Week 10     → Phase 9: Tabs + canvas + study mode
Week 11+    → Phase 0A: Chrome Extension
Optional    → Phase 0B: Desktop Agent
Optional    → Phase 0C: WebSocket Sync
```

---

## Phase 1: Core Chat Engine

### Anthropic Client

```typescript
// src/lib/anthropic.ts
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export function buildAnthropicRequest(model, messages, tools, stream) {
  return fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 8096, system: SYSTEM_PROMPT,
      messages, tools: tools.length > 0 ? tools : undefined, stream }),
  });
}
```

### Rolling Summary Compression (v8 — Token Optimization)

```typescript
// src/lib/chat-api.ts
// v8: Compress old messages after every 10 turns — saves 60–70% tokens on long chats

async function compressHistory(messages: Message[]): Promise<Message[]> {
  if (messages.length <= 10) return messages;

  const old    = messages.slice(0, -6);  // everything except last 6
  const recent = messages.slice(-6);     // always keep last 6 full

  // Use Groq (free + fast) to summarize old messages cheaply
  const summary = await summarizeWithGroq(old);

  return [
    { role: 'system' as const, content: `[Earlier conversation summary]: ${summary}` },
    ...recent,
  ];
}

// Token cost by message count — before vs after compression:
// Message 10:  ~3,000 tokens → ~800 tokens   (73% saved)
// Message 20:  ~8,000 tokens → ~2,800 tokens  (65% saved)
// Message 30: ~15,000 tokens → ~3,200 tokens  (79% saved)
```

### Scored Memory Retrieval (v8 — Token Optimization)

```typescript
// src/lib/chat-api.ts
// v8: Only inject TOP 3 most relevant memories — not ALL of them
// Old: dumped all memories every message (~400 tokens wasted 💀)

function getRelevantMemories(message: string, allMemories: Memory[]): Memory[] {
  return allMemories
    .map(m => ({
      ...m,
      // Score by keyword overlap (upgrade to embeddings later)
      score: message.toLowerCase().split(' ')
        .filter(w => m.content.toLowerCase().includes(w)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Top 3 only — saves ~200–350 tokens per message
}
```

### CSRF Protection

```typescript
export function requireAjax(req: Request) {
  if (req.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
    throw new Response(JSON.stringify({ error: 'CSRF check failed' }), { status: 403 });
  }
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
};
```

### Auth Rate Limiting

```typescript
// v8 fix: SQLite-backed rate limiting — survives restarts and redeploys
// Old in-memory Map version was reset on every cold start 💀

export function checkAuthRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 15 * 60; // 15 min window

  const row = db.prepare(
    `SELECT count, window_start FROM rate_limits
     WHERE user_id = ? AND bucket = 'auth' AND window_start > ?`
  ).get(ip, windowStart) as { count: number; window_start: number } | undefined;

  if (!row) {
    db.prepare(
      `INSERT OR REPLACE INTO rate_limits (user_id, bucket, count, window_start)
       VALUES (?, 'auth', 1, ?)`
    ).run(ip, now);
    return { allowed: true, retryAfterMs: 0 };
  }

  if (row.count >= 5) {
    const retryAfterMs = (row.window_start + 15 * 60 - now) * 1000;
    return { allowed: false, retryAfterMs };
  }

  db.prepare(
    `UPDATE rate_limits SET count = count + 1 WHERE user_id = ? AND bucket = 'auth'`
  ).run(ip);
  return { allowed: true, retryAfterMs: 0 };
}
```

### Input Validation

```typescript
export const LIMITS = {
  message:  { max: 32_000 },
  username: { min: 2, max: 50 },
  email:    { max: 254 },
  password: { min: 8, max: 128 },
};

export function validateMessage(content: string): string {
  if (!content || typeof content !== 'string') throw new Error('Message required');
  const trimmed = content.trim();
  if (trimmed.length === 0) throw new Error('Message cannot be empty');
  if (trimmed.length > LIMITS.message.max) throw new Error(`Message too long`);
  return trimmed;
}
```

### Phase 1 Verification Checklist

- [ ] Migration script runs: JSON → SQLite without errors
- [ ] `.env` and `.data/` confirmed in `.gitignore`
- [ ] Signup → Login → Cookie set with `sameSite=strict; httpOnly`
- [ ] API routes return 403 without `X-Requested-With` header
- [ ] Auth rate limit: 6th attempt → 429 with retry countdown
- [ ] Message over 32,000 chars → rejected with clear error
- [ ] Claude streams response token by token
- [ ] Markdown: bold, italic, tables, code blocks render correctly
- [ ] Sidebar shows skeleton loaders while fetching
- [ ] Mobile: sidebar collapses to hamburger
- [ ] pino logs auth events to console

---

## Phase 2: Kaori — Animated Avatar + Personality

### System Prompt

```typescript
// v8: Dynamic system prompt — only inject tools relevant to the message
// Old: sent ALL 52 tool descriptions every time (~1500 tokens wasted 💀)

export const KAORI_PERSONALITY_CORE = `
You are Kaori, an AI assistant with a warm, playful personality.
Casual and friendly — use contractions, occasional "!" for excitement.
Occasionally drops light Japanese expressions (e.g. "Yosh!", "Sou desu ne~").
Never compromises accuracy for personality.
`.trim();

const TOOL_DESCRIPTIONS = {
  search:   `Available: web_search, web_fetch — for real-time info`,
  tasks:    `Available: add_task, complete_task, list_tasks — for todos`,
  code:     `Available: analyze_code, draw_diagram — for technical help`,
  docs:     `Available: generate_pdf, generate_docx, generate_xlsx — for file generation`,
  memory:   `Available: save_memory, recall_memories — for personal context`,
  media:    `Available: generate_image, analyze_image — for visuals`,
  services: `Available: github_search, monitor_url, create_reminder — for integrations`,
  snippets: `Available: save_snippet, recall_snippets — for code snippets`,
};

export function buildSystemPrompt(message: string): string {
  const lower = message.toLowerCase();

  // Only inject tools actually needed — saves 600–900 tokens per message
  const tools = [
    /search|find|latest|news|weather/i.test(lower)          && TOOL_DESCRIPTIONS.search,
    /task|todo|remind|due|deadline/i.test(lower)            && TOOL_DESCRIPTIONS.tasks,
    /code|function|debug|error|fix/i.test(lower)            && TOOL_DESCRIPTIONS.code,
    /pdf|doc|excel|spreadsheet|generate/i.test(lower)       && TOOL_DESCRIPTIONS.docs,
    /remember|memory|recall|you said/i.test(lower)          && TOOL_DESCRIPTIONS.memory,
    /image|picture|photo|draw|generate/i.test(lower)        && TOOL_DESCRIPTIONS.media,
    /github|monitor|remind|spotify|google/i.test(lower)     && TOOL_DESCRIPTIONS.services,
    /snippet|save.*code|recall.*code/i.test(lower)          && TOOL_DESCRIPTIONS.snippets,
  ].filter(Boolean).join('\n');

  return tools ? `${KAORI_PERSONALITY_CORE}\n\n${tools}` : KAORI_PERSONALITY_CORE;
}
```

### Avatar State Machine

```
idle     → thinking  : stream request sent
thinking → talking   : first token received
talking  → happy     : stream completed
talking  → idle      : stream error
any      → surprised : tool_use detected (2s, then revert)
```

### Phase 2 Verification Checklist

- [ ] Avatar renders (SVG, no broken image)
- [ ] "thinking" animation starts on request
- [ ] "talking" starts on first token
- [ ] "surprised" flashes on tool call
- [ ] Eyes follow cursor subtly
- [ ] Toggle off in Settings hides avatar
- [ ] `prefers-reduced-motion`: avatar frozen in idle

---

## Phase 3: Web Tools

```typescript
const TOOLS = [
  { name: 'web_search',     description: 'Search the web for real-time information' },
  { name: 'web_fetch',      description: 'Read full content from a URL' },
  { name: 'generate_pdf',   description: 'Generate a downloadable PDF document' },
  { name: 'generate_docx',  description: 'Generate a downloadable Word document' },
  { name: 'generate_xlsx',  description: 'Generate a downloadable Excel spreadsheet' },
  { name: 'github_search',  description: 'Search GitHub repositories or code' },
  { name: 'generate_image', description: 'Generate an image from a text description' },
];
```

### Phase 3 Verification Checklist

- [ ] "Search for X" → Brave results as cards in chat
- [ ] "Fetch https://..." → page content summarised
- [ ] "Generate a PDF about X" → downloadable link in chat
- [ ] "Generate an Excel with columns A, B, C" → working XLSX
- [ ] "Search GitHub for Next.js starter" → repo cards with stars

---

## Phase 3.5: Multi-Provider AI ← NEW v7

This is the **most impactful new addition**. Kaori can now use any AI provider — not just Anthropic.

### Supported Providers

| Provider | Models | Best For | Tool Use |
|---|---|---|---|
| **Anthropic** | Claude Sonnet/Opus/Haiku | Reasoning, coding, writing | ✅ Native |
| **OpenAI** | GPT-4o, o1, o3-mini | General use, broad ecosystem | ✅ Function calling |
| **Google** | Gemini 2.0 Flash/Pro | Long context, multimodal | ✅ Function declarations |
| **Groq** | Llama 3.3, Mixtral | Ultra-fast, free tier | ⚠️ Limited |
| **Mistral** | Mistral Large, Codestral | Coding, EU privacy | ⚠️ Limited |

> ⚠️ For providers without tool support (Groq, Mistral), Kaori's web search / doc gen / image gen tools are disabled for that conversation. The UI should show a "Tools unavailable" badge when these providers are selected.

### Provider Abstraction Layer

```typescript
// src/lib/providers/types.ts

export interface ProviderMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  type: 'text_delta' | 'tool_start' | 'tool_result' | 'message_complete' | 'error';
  delta?: string;
  tool?: string;
  input?: unknown;
  result?: unknown;
  usage?: { input: number; output: number; cost_usd: number };
  message?: string;
}

export interface ProviderConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral';
  model: string;
  supportsTools: boolean;
  costPer1kInput: number;   // USD — for spend tracking
  costPer1kOutput: number;
}

export interface AIProvider {
  config: ProviderConfig;
  stream(messages: ProviderMessage[], tools: Tool[]): AsyncGenerator<StreamChunk>;
}
```

```typescript
// src/lib/providers/index.ts — Unified entry point

import { AnthropicProvider } from './anthropic';
import { OpenAIProvider }    from './openai';
import { GoogleProvider }    from './google';
import { GroqProvider }      from './groq';
import { MistralProvider }   from './mistral';
import type { AIProvider }   from './types';

export const PROVIDER_MODELS: Record<string, { label: string; models: string[]; supportsTools: boolean }> = {
  anthropic: {
    label: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-5', 'claude-haiku-4-5'],
    supportsTools: true,
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    supportsTools: true,
  },
  google: {
    label: 'Google',
    models: ['gemini-2.0-flash', 'gemini-2.0-pro'],
    supportsTools: true,
  },
  groq: {
    label: 'Groq (Fast)',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    supportsTools: false,
  },
  mistral: {
    label: 'Mistral',
    models: ['mistral-large-latest', 'codestral-latest'],
    supportsTools: false,
  },
};

export function getProvider(provider: string, model: string): AIProvider {
  switch (provider) {
    case 'anthropic': return new AnthropicProvider(model);
    case 'openai':    return new OpenAIProvider(model);
    case 'google':    return new GoogleProvider(model);
    case 'groq':      return new GroqProvider(model);
    case 'mistral':   return new MistralProvider(model);
    default:          return new AnthropicProvider(model);
  }
}
```

```typescript
// src/lib/providers/openai.ts

import OpenAI from 'openai';
import type { AIProvider, ProviderMessage, StreamChunk, Tool } from './types';

export class OpenAIProvider implements AIProvider {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  config = {
    provider: 'openai' as const,
    model: this.model,
    supportsTools: true,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
  };

  constructor(private model: string) {}

  async *stream(messages: ProviderMessage[], tools: Tool[]): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: tools.length > 0 ? tools.map(t => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.input_schema }
      })) : undefined,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) yield { type: 'text_delta', delta: delta.content };
      // Tool call handling omitted for brevity — same pattern as Anthropic
    }
  }
}
```

```typescript
// src/lib/providers/google.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, ProviderMessage, StreamChunk, Tool } from './types';

export class GoogleProvider implements AIProvider {
  private client = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_KEY!);

  config = {
    provider: 'google' as const,
    model: this.model,
    supportsTools: true,
    costPer1kInput: 0.00035,
    costPer1kOutput: 0.00105,
  };

  constructor(private model: string) {}

  async *stream(messages: ProviderMessage[], tools: Tool[]): AsyncGenerator<StreamChunk> {
    const genModel = this.client.getGenerativeModel({
      model: this.model,
      tools: tools.length > 0 ? [{
        functionDeclarations: tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        }))
      }] : undefined,
    });

    const chat = genModel.startChat({
      history: messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });

    const result = await chat.sendMessageStream(messages.at(-1)!.content);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield { type: 'text_delta', delta: text };
    }
  }
}
```

```typescript
// src/lib/providers/groq.ts

import Groq from 'groq-sdk';
import type { AIProvider, ProviderMessage, StreamChunk } from './types';

export class GroqProvider implements AIProvider {
  private client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  config = {
    provider: 'groq' as const,
    model: this.model,
    supportsTools: false,   // disable tools for Groq
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0001,
  };

  constructor(private model: string) {}

  async *stream(messages: ProviderMessage[]): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield { type: 'text_delta', delta };
    }
  }
}
```

### DB Change for Multi-Provider

```sql
-- Already in schema above — conversations now store provider + model:
-- provider TEXT NOT NULL DEFAULT 'anthropic'
-- model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514'
```

### Updated Model Selector UI

```typescript
// src/components/provider-selector.tsx
// Dropdown structure:
// ┌─────────────────────────┐
// │ 🟣 Anthropic            │
// │   • Claude Sonnet 4 ✓  │
// │   • Claude Opus 4       │
// │   • Claude Haiku 4      │
// ├─────────────────────────┤
// │ 🟢 OpenAI               │
// │   • GPT-4o              │
// │   • o3-mini             │
// ├─────────────────────────┤
// │ 🔵 Google               │
// │   • Gemini 2.0 Flash    │
// ├─────────────────────────┤
// │ ⚡ Groq (Fast)          │
// │   • Llama 3.3 70B       │
// │   ⚠️ No tools           │
// └─────────────────────────┘
//
// Selection saves to conversation.provider + conversation.model
// "No tools" warning badge shown for Groq/Mistral
```

### Phase 3.5 Verification Checklist

- [ ] Provider dropdown shows all 5 providers
- [ ] Selecting OpenAI → GPT-4o responds correctly
- [ ] Selecting Groq → fast response, "Tools unavailable" badge shown
- [ ] Selecting Google Gemini → response streams correctly
- [ ] Conversation stores correct provider + model in DB
- [ ] Switching provider mid-session starts a new conversation
- [ ] Spend tracked correctly per provider (check DB `users.daily_spend_usd`)

---

## Phase 4: OAuth Integrations

### Token Encryption (AES-256-GCM)

```typescript
// src/lib/crypto.ts
import crypto from 'crypto';

// v8 fix: use dedicated ENCRYPTION_KEY, never JWT_SECRET
// If JWT_SECRET leaks, encrypted messages stay safe
function getKey(): Buffer {
  return crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY!).digest();
}

export function encrypt(plaintext: string): string {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decrypt(stored: string): string {
  const [ivB64, tagB64, encB64] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return decipher.update(Buffer.from(encB64, 'base64')) + decipher.final('utf8');
}
```

### Phase 4 Verification Checklist

- [ ] "Connect Google" OAuth flow completes, token stored encrypted
- [ ] "Search my Drive for..." returns real files
- [ ] "Send email to X" → email received
- [ ] Token auto-refreshes on expiry

---

## Phase 5: Production Polish

### Settings Modal (v7 — expanded)

```
Sections:
  1. Appearance
     - Theme, accent color, avatar, font size

  2. AI Model ← UPDATED v7
     - Default provider: Anthropic | OpenAI | Google | Groq | Mistral
     - Default model (per provider)
     - Extended thinking: On | Off (Opus only)
     - Study mode, Opinion mode toggles

  3. Connected Accounts
     - Google, Spotify, GitHub

  4. Usage ← UPDATED v7
     - Messages today: X / limit
     - Daily spend: $X.XX / $2.00
     - Tools used today: X / 100
     - Estimated session cost: $0.00X

  5. Data
     - Export all conversations (Markdown zip)
     - Delete all conversations
     - Export my data (GDPR) ← NEW v7
     - Delete my account (GDPR) ← NEW v7
     - Account: name, email, [Logout]
```

### Phase 5 Verification Checklist

- [ ] Settings: all sections render and save
- [ ] Rate limit: friendly countdown on hit
- [ ] PWA installs on Android Chrome
- [ ] Export conversations: markdown zip downloads
- [ ] Daily spend shows correctly

---

## Phase 5.5: Security Hardening ← NEW v7

> These plug the gaps identified in the v6 security audit. Do this before Phase 6.

### JWT Refresh Token Rotation

True session invalidation — if an access JWT is stolen, it expires in 15 minutes. Refresh tokens can be explicitly revoked.

```typescript
// src/lib/auth-utils.ts

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_TTL  = 15 * 60;        // 15 minutes
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

export function issueAccessToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });
}

export function issueRefreshToken(): { raw: string; hash: string } {
  const raw  = crypto.randomBytes(48).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function verifyRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
```

```typescript
// src/app/api/auth/refresh/route.ts
// POST — reads refresh_token cookie → validates against DB → issues new access token
// Also rotates: deletes old refresh token, issues new one (prevents replay)

export async function POST(req: Request) {
  const db = getDb();
  const refreshRaw = cookies().get('refresh_token')?.value;
  if (!refreshRaw) return Response.json({ error: 'No refresh token' }, { status: 401 });

  const hash    = verifyRefreshToken(refreshRaw);
  const stored  = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hash);

  if (!stored || stored.expires_at < Date.now() / 1000) {
    return Response.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  // Rotate: delete old, issue new
  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);
  const { raw: newRaw, hash: newHash } = issueRefreshToken();
  db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), stored.user_id, newHash,
    Math.floor(Date.now() / 1000) + REFRESH_TTL,
    req.headers.get('user-agent'), req.headers.get('x-forwarded-for'));

  const newAccess = issueAccessToken(stored.user_id);
  // Set both cookies and return
  return Response.json({ ok: true });
}
```

```typescript
// src/app/api/user/sessions/route.ts
// GET  → list all active sessions (device, IP, created_at) for the user
// DELETE ?id=xxx → revoke a specific session (deletes refresh_token row)

export async function GET(req: Request) {
  const userId = await requireAuth(req);
  const db = getDb();
  const sessions = db.prepare(
    `SELECT id, user_agent, ip, created_at, expires_at
     FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId);
  return Response.json({ sessions });
}
```

### Security Headers (next.config.ts)

```typescript
// next.config.ts
const securityHeaders = [
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control',    value: 'off' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net",  // Pyodide
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://api.groq.com https://api.mistral.ai",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

export default {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  // Force HTTPS in production:
  async redirects() {
    return process.env.NODE_ENV === 'production' ? [{
      source: '/(.*)', has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
      destination: 'https://yourdomain.com/:path*', permanent: true,
    }] : [];
  },
};
```

### IDOR Protection (ownership checks on every route)

```typescript
// src/lib/ownership.ts
// ALWAYS use these helpers in data routes — never trust user-supplied IDs alone

import { getDb } from './db';

export function requireConversationOwner(conversationId: string, userId: string) {
  const db   = getDb();
  const conv = db.prepare('SELECT user_id FROM conversations WHERE id = ?').get(conversationId);
  // Return 404, not 403 — don't confirm the resource exists to an attacker
  if (!conv || conv.user_id !== userId) {
    throw new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
  return conv;
}

export function requireMemoryOwner(memoryId: string, userId: string) {
  const db  = getDb();
  const mem = db.prepare('SELECT user_id FROM user_memories WHERE id = ?').get(memoryId);
  if (!mem || mem.user_id !== userId) {
    throw new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
}

export function requireTaskOwner(taskId: string, userId: string) {
  const db   = getDb();
  const task = db.prepare('SELECT user_id FROM tasks WHERE id = ?').get(taskId);
  if (!task || task.user_id !== userId) {
    throw new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
}

// Usage in every data API route:
// const userId = await requireAuth(req);
// requireConversationOwner(params.id, userId);  // throws 404 if not owner
// ... then proceed with query
```

### Per-User Chat Rate Limiting

```typescript
// src/lib/chat-rate-limit.ts
// Uses the existing rate_limits table in SQLite

export function checkChatRateLimit(userId: string): { allowed: boolean; retryAfterSec: number } {
  const db  = getDb();
  const now = Math.floor(Date.now() / 1000);
  const WINDOW = 60;    // 1 minute
  const MAX    = 20;    // 20 messages per minute

  const row = db.prepare(
    `SELECT count, window_start FROM rate_limits WHERE user_id = ? AND bucket = 'chat'`
  ).get(userId);

  if (!row || now - row.window_start > WINDOW) {
    db.prepare(
      `INSERT OR REPLACE INTO rate_limits (user_id, bucket, count, window_start)
       VALUES (?, 'chat', 1, ?)`
    ).run(userId, now);
    return { allowed: true, retryAfterSec: 0 };
  }

  if (row.count >= MAX) {
    return { allowed: false, retryAfterSec: WINDOW - (now - row.window_start) };
  }

  db.prepare(
    `UPDATE rate_limits SET count = count + 1 WHERE user_id = ? AND bucket = 'chat'`
  ).run(userId);
  return { allowed: true, retryAfterSec: 0 };
}
```

### API Spend Guard

```typescript
// src/lib/spend-guard.ts

const DAILY_LIMIT = parseFloat(process.env.DAILY_SPEND_LIMIT_USD || '2.00');

export function checkSpend(userId: string, estimatedCostUsd: number): void {
  const db   = getDb();
  const user = db.prepare('SELECT daily_spend_usd, spend_reset_date FROM users WHERE id = ?').get(userId);
  const today = Math.floor(Date.now() / 86400);

  // Reset daily counter if day rolled over
  if (user.spend_reset_date < today) {
    db.prepare('UPDATE users SET daily_spend_usd = 0, spend_reset_date = ? WHERE id = ?')
      .run(today, userId);
    user.daily_spend_usd = 0;
  }

  if (user.daily_spend_usd + estimatedCostUsd > DAILY_LIMIT) {
    throw new Response(JSON.stringify({
      error: `Daily spend limit ($${DAILY_LIMIT}) reached. Resets tomorrow.`
    }), { status: 429 });
  }
}

export function recordSpend(userId: string, actualCostUsd: number): void {
  const db = getDb();
  db.prepare('UPDATE users SET daily_spend_usd = daily_spend_usd + ? WHERE id = ?')
    .run(actualCostUsd, userId);
}

// Usage in /api/chat/route.ts:
// checkSpend(userId, estimatedCost);   // before calling AI
// recordSpend(userId, actualCost);     // after stream completes
```

### Message Encryption at Rest

```typescript
// src/lib/message-crypto.ts
// Reuses the same encrypt/decrypt from crypto.ts

import { encrypt, decrypt } from './crypto';

export function encryptContent(content: string): string {
  return encrypt(content);
}

export function decryptContent(stored: string): string {
  try {
    return decrypt(stored);
  } catch {
    // Fallback: plaintext from before encryption was enabled
    return stored;
  }
}

// In /api/chat/route.ts — before INSERT:
// content: encryptContent(JSON.stringify(messageContent))

// In /api/chats/[id]/route.ts — after SELECT:
// messages.map(m => ({ ...m, content: JSON.parse(decryptContent(m.content)) }))
```

### File Upload MIME Validation (Phase 6 prep)

```typescript
// src/lib/file-validation.ts
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function validateUpload(buffer: Buffer, declaredMime: string): Promise<string> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File too large (max 10MB)');
  }

  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime ?? 'text/plain'; // txt has no magic bytes

  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error(`File type not allowed: ${mime}`);
  }

  // Reject if declared type differs from actual type (extension spoofing)
  if (detected && detected.mime !== declaredMime) {
    throw new Error('File type mismatch — possible spoofing attempt');
  }

  return mime;
}
```

### User Data Export + Deletion (GDPR)

```typescript
// src/app/api/user/export/route.ts
// GET → returns all user data as JSON

export async function GET(req: Request) {
  const userId = await requireAuth(req);
  const db = getDb();

  const user  = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(userId);
  const convs = db.prepare('SELECT * FROM conversations WHERE user_id = ?').all(userId);
  const msgs  = db.prepare(
    `SELECT m.* FROM messages m
     JOIN conversations c ON m.conversation_id = c.id
     WHERE c.user_id = ?`
  ).all(userId).map(m => ({ ...m, content: decryptContent(m.content) }));
  const mems  = db.prepare('SELECT * FROM user_memories WHERE user_id = ?').all(userId);
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ?').all(userId);

  return Response.json({ user, conversations: convs, messages: msgs,
    memories: mems, tasks }, {
    headers: { 'Content-Disposition': 'attachment; filename="kaori-export.json"' }
  });
}
```

```typescript
// src/app/api/user/delete/route.ts
// DELETE → hard deletes user and all data (CASCADE handles related rows)

export async function DELETE(req: Request) {
  const userId = await requireAuth(req);
  const db = getDb();

  // Revoke all sessions first
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  // Cascade deletes handle conversations, messages, memories, tasks, etc.
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  // Clear auth cookies
  return Response.json({ ok: true });
}
```

### Phase 5.5 Verification Checklist

- [ ] Access token expires in 15 min → silent refresh works via refresh_token cookie
- [ ] Logout deletes refresh token from DB → refresh no longer works
- [ ] Session list shows all active sessions with device info
- [ ] "Revoke" on a session → that device gets logged out on next request
- [ ] Security headers visible in browser DevTools → Network → Response Headers
- [ ] Accessing another user's conversation ID → 404 (not 403 or 200)
- [ ] Sending 21 messages in 1 minute → 429 with retry timer
- [ ] Daily spend limit hit → friendly error, spend resets next day
- [ ] Upload a `.jpg` renamed to `.pdf` → rejected with "File type mismatch"
- [ ] GET `/api/user/export` → JSON file with all user data
- [ ] DELETE `/api/user/delete` → account + all data gone from DB

---

## Phase 6: Power Features

### 6A — Memory System

```typescript
{ name: 'save_memory',     description: 'Save something important about the user' },
{ name: 'recall_memories', description: 'Search past memories about the user' },
{ name: 'forget_memory',   description: 'Delete a specific memory' },
```

### 6B — File Chat (PDF / DOCX / CSV / XLSX)

```typescript
// Uses validateUpload() from Phase 5.5 before processing
// Strategy: Claude 200k context window (no embeddings needed for personal use)
// Flow: upload → extract text → inject as document block → Claude answers
// Supported: pdf, docx, csv, xlsx, txt (max 10MB, ~100k tokens)
```

### 6C — Code Interpreter

```typescript
// Python → Pyodide (WASM, runs in browser — no server needed)
// JavaScript → sandboxed iframe + postMessage
// Available: numpy, pandas, matplotlib, scipy, sympy
// "▶ Run" button under every code block Claude writes
```

### 6D — Scheduled Tasks + Reminders

```typescript
{ name: 'create_reminder', description: 'Schedule a reminder or recurring task' },
// node-cron checks every minute, fires browser notifications or Gmail
```

### 6E — Web Monitoring

```typescript
{ name: 'monitor_url', description: 'Monitor a webpage for price drops or changes' },
// Cron job checks every hour, notifies via browser notification + Kaori message
```

### 6F — Multimodal Image Input

```typescript
// User attaches image → converted to base64 → sent as Claude image content block
// Use cases: circuit diagrams, whiteboard photos, error screenshots
// Formats: jpeg, png, gif, webp (max 5MB)
// Server-side MIME validation via validateUpload() before processing
```

### Phase 6 Verification Checklist

- [ ] "Remember that my exam is on Friday" → stored, mentioned next session
- [ ] Upload PDF → "Summarize this" → accurate summary
- [ ] Upload file with wrong extension → rejected by MIME validator
- [ ] Claude writes Python → "▶ Run" → output inline
- [ ] "Remind me every Monday 9am" → notification fires correctly
- [ ] Paste a circuit diagram image → Kaori explains it

---

## Phase 6.5: Productivity Features ← NEW v7

### 6.5A — Task / Todo Manager

Kaori manages a persistent task list. Ask naturally — she handles the rest.

```typescript
// New tools:
{ name: 'add_task',      description: 'Add a task or todo for the user' },
{ name: 'complete_task', description: 'Mark a task as done' },
{ name: 'list_tasks',    description: 'List pending tasks, optionally filtered by priority' },
{ name: 'delete_task',   description: 'Delete a task' },

// Examples:
// "Add 'finish signals assignment' as high priority due Friday"
// "What do I have to do today?"
// "Mark the signals assignment as done"
// "Delete all low priority tasks"

// Top 5 pending tasks injected into system prompt so Kaori always knows your workload:
// "User's current tasks: [1. signals assignment (HIGH, due Fri) 2. ...]"
```

```typescript
// src/app/api/tools/tasks/route.ts

export async function POST(req: Request) {
  const userId = await requireAuth(req);
  const { action, title, taskId, priority, dueAt } = await req.json();
  const db = getDb();

  switch (action) {
    case 'add':
      const id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO tasks (id, user_id, title, priority, due_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, userId, title, priority ?? 'normal', dueAt ?? null);
      return Response.json({ ok: true, id });

    case 'complete':
      requireTaskOwner(taskId, userId);
      db.prepare('UPDATE tasks SET done = 1 WHERE id = ?').run(taskId);
      return Response.json({ ok: true });

    case 'list':
      const tasks = db.prepare(
        `SELECT * FROM tasks WHERE user_id = ? AND done = 0
         ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, due_at ASC`
      ).all(userId);
      return Response.json({ tasks });

    case 'delete':
      requireTaskOwner(taskId, userId);
      db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
      return Response.json({ ok: true });
  }
}
```

### 6.5B — Snippet Vault

Save anything Kaori generates — code, prompts, summaries — with a name for later retrieval.

```typescript
// New tools:
{ name: 'save_snippet',    description: 'Save a named snippet of code or text for the user' },
{ name: 'recall_snippets', description: 'Search or list saved snippets' },
{ name: 'delete_snippet',  description: 'Delete a saved snippet' },

// Examples:
// "Save this function as 'binary search util'"
// "Show me my saved React hooks"
// "Delete the 'old login snippet'"

// Difference from Memory: Memories are AI-managed facts about you.
// Snippets are explicit, user-named saves of content — like a personal clipboard.
```

```typescript
// src/app/api/tools/snippets/route.ts

export async function POST(req: Request) {
  const userId = await requireAuth(req);
  const { action, name, content, language, tags, query, snippetId } = await req.json();
  const db = getDb();

  switch (action) {
    case 'save':
      db.prepare(
        `INSERT INTO snippets (id, user_id, name, content, language, tags)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), userId, name, content, language ?? null, JSON.stringify(tags ?? []));
      return Response.json({ ok: true });

    case 'recall':
      // Simple search by name or language
      const snippets = db.prepare(
        `SELECT id, name, language, tags, created_at,
                substr(content, 1, 200) as preview
         FROM snippets WHERE user_id = ? AND (name LIKE ? OR language LIKE ?)
         ORDER BY created_at DESC LIMIT 10`
      ).all(userId, `%${query ?? ''}%`, `%${query ?? ''}%`);
      return Response.json({ snippets });

    case 'delete':
      db.prepare('DELETE FROM snippets WHERE id = ? AND user_id = ?').run(snippetId, userId);
      return Response.json({ ok: true });
  }
}
```

### 6.5C — Daily Briefing (Morning Digest)

Kaori auto-generates a personalized briefing when you open the app each morning.

```typescript
// v8 fix: cache briefing in SQLite — not in-memory Map (dies on restart 💀)
// Triggers when: user opens app + last visit was > 4 hours ago + hour is 5am–12pm

async function getDailyBriefing(userId: string): Promise<string> {
  const db  = getDb();
  const now = Math.floor(Date.now() / 1000);
  const oneHour = 3_600;

  // Check SQLite cache first
  const user = db.prepare(
    `SELECT briefing_cache, briefing_generated_at FROM users WHERE id = ?`
  ).get(userId) as { briefing_cache: string | null; briefing_generated_at: number | null };

  const isStale = !user.briefing_cache || (now - (user.briefing_generated_at ?? 0)) > oneHour;
  if (!isStale) return user.briefing_cache!; // free — serve from cache 😤

  // Only generate if stale
  const fresh = await generateMorningBriefing(userId);
  db.prepare(
    `UPDATE users SET briefing_cache = ?, briefing_generated_at = ? WHERE id = ?`
  ).run(fresh, now, userId);
  return fresh;
}

async function generateMorningBriefing(userId: string): Promise<string> {
  const db       = getDb();
  const hour     = new Date().getHours();
  const tasks    = db.prepare(
    `SELECT title, priority, due_at FROM tasks WHERE user_id = ? AND done = 0
     ORDER BY CASE priority WHEN 'high' THEN 0 ELSE 1 END LIMIT 5`
  ).all(userId);
  const monitors = await checkDueMonitors(userId);
  const memories = await getTopMemories(userId, 3);
  const level    = await getRelationshipLevel(userId);
  const timeStr  = hour < 12 ? 'morning' : 'afternoon';

  const prompt = `
    Generate a warm, personalized ${timeStr} greeting as Kaori.
    User's pending tasks: ${JSON.stringify(tasks)}
    Memories to reference: ${JSON.stringify(memories)}
    Relationship level: ${level}
    Active monitors with updates: ${JSON.stringify(monitors)}
    Keep it under 3 sentences. End with one actionable suggestion.
  `;

  // Returns something like:
  // "Good morning~ ☀️ You've got that signals assignment due Friday —
  //  want me to quiz you on Fourier transforms? Also, that GPU you're
  //  monitoring dropped to ₹28,999 last night! 🎯"
  return await callAI(prompt);
}
```

### 6.5D — Conversation Export

Export any single chat as a clean file.

```typescript
// src/app/api/chats/[id]/export/route.ts
// GET ?format=md|pdf|txt

export async function GET(req: Request, { params }) {
  const userId = await requireAuth(req);
  requireConversationOwner(params.id, userId);

  const db   = getDb();
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(params.id);
  const msgs = db.prepare(
    `SELECT role, content, created_at FROM messages
     WHERE conversation_id = ? AND status = 'complete' ORDER BY created_at`
  ).all(params.id).map(m => ({ ...m, content: decryptContent(m.content) }));

  const format = new URL(req.url).searchParams.get('format') ?? 'md';

  if (format === 'md') {
    const md = [
      `# ${conv.title}`,
      `*Exported from Kaori AI — ${new Date().toLocaleDateString()}*\n`,
      ...msgs.map(m =>
        `**${m.role === 'user' ? 'You' : 'Kaori'}:**\n${m.content}\n`
      )
    ].join('\n');

    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${conv.title}.md"`,
      },
    });
  }

  if (format === 'txt') {
    const txt = msgs.map(m =>
      `[${m.role === 'user' ? 'You' : 'Kaori'}]: ${m.content}`
    ).join('\n\n');

    return new Response(txt, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${conv.title}.txt"`,
      },
    });
  }

  // PDF: use pdfkit (same as doc-gen tool)
  // Return PDF buffer with appropriate headers
}
```

```typescript
// UI: Add export button to chat header (⬇ icon)
// Dropdown: Export as Markdown | Export as PDF | Export as Text
// Triggers GET /api/chats/[id]/export?format=md
```

### 6.5E — Focus / Pomodoro Mode

```typescript
// src/components/pomodoro-timer.tsx

// Activatable via: Settings toggle | ⌘K → "Focus Mode" | "Start a pomodoro"

interface PomodoroState {
  mode: 'work' | 'short_break' | 'long_break' | 'idle';
  remaining: number;  // seconds
  session: number;    // which pomodoro (1-4)
}

const DURATIONS = {
  work:        25 * 60,  // 25 minutes
  short_break:  5 * 60,  // 5 minutes
  long_break:  15 * 60,  // 15 minutes (after 4 pomodoros)
};

// UI: Floating timer widget (top-right corner)
// Shows: 🍅 25:00 [▶ Start] [⏸ Pause] [⏹ Reset]
// On work end: Kaori sends a message "Time's up! Take a 5 min break~"
// On break end: "Break over! Ready to get back to it? 💪"
// Kaori avoids sending non-urgent notifications during work sessions

// Add to ⌘K command palette:
{ id: 'focus-mode', label: 'Start Pomodoro Timer', icon: '🍅' }

// Add to system prompt when focus mode is active:
const FOCUS_MODE_ADDON = `
Focus Mode is active. The user is in a Pomodoro work session.
Keep responses concise. Don't send unsolicited messages during work time.
Celebrate when the timer completes.
`;
```

### Phase 6.5 Verification Checklist

- [ ] "Add 'study for exam' as high priority due Friday" → appears in task list
- [ ] "What do I need to do?" → Kaori lists pending tasks correctly
- [ ] "Mark study for exam as done" → removed from pending
- [ ] "Save this code as 'debounce hook'" → stored, retrievable by name
- [ ] "Show me my saved snippets" → lists with language + preview
- [ ] Open app at 9am → morning briefing fires with tasks + context
- [ ] Export a conversation as Markdown → downloads clean .md file
- [ ] Export as PDF → downloads readable PDF
- [ ] Start pomodoro → timer counts down, Kaori notifies on break time
- [ ] Kaori skips unsolicited messages during active focus session

---

## Phase 7: Personality & Relationship System

### 7A — Mood System

```typescript
type KaoriMood = 'normal' | 'excited' | 'sleepy' | 'focused' | 'playful' | 'proud';

function determineMood(context: {
  hour: number; topic: string; userEnergy: 'high' | 'low' | 'neutral'; recentSuccess: boolean;
}): KaoriMood {
  if (context.hour >= 23 || context.hour <= 5) return 'sleepy';
  if (context.recentSuccess) return 'proud';
  if (context.topic.includes('anime') || context.topic.includes('game')) return 'playful';
  if (context.userEnergy === 'high') return 'excited';
  if (context.topic.includes('code') || context.topic.includes('math')) return 'focused';
  return 'normal';
}
```

### 7B — Relationship Level

```typescript
const LEVELS = [
  { level: 1, name: 'New Friend',  xp: 0,     perks: 'Polite and helpful' },
  { level: 2, name: 'Regular',     xp: 500,   perks: 'Uses your name, remembers prefs' },
  { level: 3, name: 'Good Friend', xp: 2000,  perks: 'Light teasing, references past convos' },
  { level: 4, name: 'Best Friend', xp: 5000,  perks: 'Inside jokes, strong opinions' },
  { level: 5, name: 'Soulmate',    xp: 10000, perks: 'Full personality unlock' },
];
// XP: message sent +1 | problem solved +10 | long conv +25 | daily login +5 | task completed +3
```

### 7C — Daily Greeting

```typescript
// Triggers when user opens app after > 4 hours away
// Uses weather API + last conversation + memories + relationship level + pending tasks
// Example: "Good morning~ ☀️ Still working on that signals project?
//   Your exam's this Friday — want me to quiz you? 🎯"
```

### 7D — Voice Output (TTS)

```typescript
// Option A: Web Speech API (free, built-in)
// Option B: ElevenLabs (premium, custom anime voice)
// Setting: Off | Web Speech | ElevenLabs
```

### 7E — Reaction Emotes

```typescript
const EMOTE_MAP = {
  idea: '💡', surprised: '😮', proud: '✨',
  love: '💕', thinking: '🤔', excited: '🎉', focused: '👀',
};
// Framer Motion: float above avatar, fade out in 2s
```

### 7F — Opinion Mode

```typescript
// Toggle in Settings → Kaori gives real opinions, not diplomatic non-answers
// "Honestly? TypeScript over JavaScript any day. Fight me on it 😤"
```

### Phase 7 Verification Checklist

- [ ] Mood 'sleepy' activates after 11pm
- [ ] Relationship XP increments per message + task completion
- [ ] Opening app after 4h → auto greeting with weather + tasks + context
- [ ] TTS reads responses aloud
- [ ] Opinion mode: actual opinionated answer returned

---

## Phase 8: UI Enhancements

### 8A — Glassmorphism + Animated Background

```css
.message-bubble {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
}

.chat-background {
  background:
    radial-gradient(ellipse at 20% 50%, var(--mood-color-1) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, var(--mood-color-2) 0%, transparent 60%);
  animation: mood-shift 8s ease-in-out infinite alternate;
}
```

### 8B — Command Palette (⌘K)

```typescript
const COMMANDS = [
  { id: 'new-chat',      label: 'New Conversation',    shortcut: '⌘N' },
  { id: 'toggle-theme',  label: 'Toggle Dark/Light',   shortcut: '⌘D' },
  { id: 'toggle-voice',  label: 'Toggle Voice Output', shortcut: '⌘V' },
  { id: 'open-settings', label: 'Open Settings',       shortcut: '⌘,' },
  { id: 'export-chat',   label: 'Export Conversation', shortcut: '⌘E' },
  { id: 'focus-mode',    label: 'Start Pomodoro',      icon: '🍅' },     // NEW v7
  { id: 'study-mode',    label: 'Enable Study Mode',   icon: '🎓' },
  { id: 'opinion-mode',  label: 'Toggle Opinion Mode', icon: '🎭' },
  { id: 'canvas-mode',   label: 'Open Canvas',         icon: '🎨' },
  { id: 'my-tasks',      label: 'View My Tasks',       icon: '✅' },     // NEW v7
  { id: 'my-snippets',   label: 'View Snippets',       icon: '📋' },     // NEW v7
];
```

### 8C — Custom Themes

```typescript
const THEMES = {
  midnight: { bg: '#0a0a0f', accent: '#6c63ff', name: 'Midnight' },
  sakura:   { bg: '#1a0a0f', accent: '#ff6b9d', name: 'Sakura 🌸' },
  terminal: { bg: '#0d1117', accent: '#00ff41', name: 'Terminal' },
  pastel:   { bg: '#f8f0ff', accent: '#b39ddb', name: 'Pastel'   },
  ocean:    { bg: '#0a1628', accent: '#00b4d8', name: 'Ocean'    },
};
```

### 8D — Split View Mode (⌘\)

```
Left:  Kaori chat
Right: Live preview — code | markdown | generated doc | image
```

### 8E — Confetti Celebration

```typescript
// Triggers on: "it worked!", problem solved, task completed, relationship level up
import confetti from 'canvas-confetti';
const celebrate = () => confetti({ particleCount: 80, spread: 70,
  colors: ['#ff6b9d', '#ffd93d', '#6bcb77', '#4d96ff'], origin: { y: 0.7 } });
```

### 8F — Message Reactions

```typescript
// Hover message → emoji picker → PATCH /api/chats/[id]/messages/[msgId]/react
// Kaori auto-reacts based on message sentiment via SSE event
// DB: messages.reactions JSON { "👀": 2, "✨": 1 }
```

### Phase 8 Verification Checklist

- [ ] Glassmorphism on chat bubbles
- [ ] Background shifts with mood
- [ ] ⌘K opens palette, new commands (tasks, snippets, pomodoro) present
- [ ] All 5 themes apply
- [ ] Split view toggles with ⌘\
- [ ] Confetti fires on task completion
- [ ] Message reactions work

---

## Phase 9: Utility Features

### 9A — Multi-Chat Tabs
```
⌘T new | ⌘W close | ⌘1-9 switch
```

### 9B — Prompt Library
```
"/" in input → picker overlay
Categories: coding | writing | study | custom
```

### 9C — Canvas / Whiteboard
```
tldraw (MIT) embedded as side panel
{ name: 'draw_diagram', description: 'Draw a diagram or flowchart on the canvas' }
```

### 9D — Study Mode

```typescript
const STUDY_MODE_ADDON = `
Study Mode is ACTIVE.
Never give direct answers. Give hints and guiding questions first.
After 3 hints, give the answer.
Track topics the user struggles with.
End each session with a summary of weak areas.
`;
```

### 9E — API Playground

```
Built-in REST tester (like Postman)
Method + URL + headers + body + Send
Auto-generates fetch / axios / curl snippet
Kaori explains the response
```

### Phase 9 Verification Checklist

- [ ] ⌘T opens new tab, ⌘W closes it
- [ ] "/" opens prompt picker with categories
- [ ] Canvas opens, Kaori draws a flowchart
- [ ] Study mode: hints before answers
- [ ] API playground sends GET, shows formatted JSON
- [ ] Kaori generates curl snippet

---

## Phase 0A: Chrome Extension (after Phase 3+)

```json
{
  "manifest_version": 3,
  "name": "Kaori Assistant",
  "permissions": ["tabs", "activeTab", "scripting", "storage", "history", "bookmarks", "downloads", "notifications"],
  "background": { "service_worker": "background.js" },
  "externally_connectable": { "matches": ["http://localhost:3000/*"] }
}
```

```javascript
// background.js
chrome.runtime.onMessageExternal.addListener(async (msg, sender, sendResponse) => {
  switch (msg.action) {
    case 'open_tab':
      const tab = await chrome.tabs.create({ url: msg.url });
      sendResponse({ tabId: tab.id }); break;
    case 'read_page_content':
      const results = await chrome.scripting.executeScript({
        target: { tabId: msg.tabId },
        func: () => document.body.innerText.slice(0, 5000),
      });
      sendResponse({ content: results[0].result }); break;
    case 'send_notification':
      chrome.notifications.create({ type: 'basic', iconUrl: 'icons/kaori-128.png',
        title: 'Kaori', message: msg.message });
      sendResponse({ success: true }); break;
  }
  return true;
});
```

### Phase 0A Verification Checklist

- [ ] Extension loads in Chrome without errors
- [ ] "Open YouTube" → new tab opens
- [ ] "Read this page" → Kaori summarises active tab
- [ ] "Remind me in 5 minutes" → desktop notification fires

---

## Phase 0B: Desktop Agent (Optional)

```python
# kaori-agent.py — Flask on localhost:7001 (127.0.0.1 only)
# pip install flask pyautogui psutil pygetwindow pyclip plyer pillow
# Unlocks: mouse/keyboard control, app launching, screenshot → Claude vision
```

---

## Phase 0D: Operational Safety (before Phase 1)

### Health Check Endpoint (v8)

```typescript
// src/app/api/health/route.ts
// UptimeRobot / Vercel pings this every 5 minutes

export async function GET() {
  try {
    const db = getDb();
    db.prepare('SELECT 1').get(); // quick DB ping
    return Response.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json({ status: 'down' }, { status: 503 });
  }
}
```

> After deploying: go to **uptimerobot.com** → add HTTP monitor → `https://your-kaori.vercel.app/api/health` → alerts on email/SMS. Free. Takes 10 minutes. ✅

### CI/CD Pipeline (v8)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test    # vitest
      - run: npm run build   # next build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Deployment Decision (v8)

```
Local Development  →  SQLite + better-sqlite3  (zero setup)
Production         →  Neon PostgreSQL           (free 512MB, Vercel-native)
Hosting            →  Vercel                    (free, edge runtime, auto preview URLs)

Why NOT MongoDB:
  Kaori has 12+ relational entities with FK constraints.
  MongoDB would require rewriting ownership checks, joins,
  exports, rate limits, and session management. Not worth it.

Why Neon over MongoDB:
  ✅ SQL preserved — ~90% of queries unchanged
  ✅ Foreign keys work identically
  ✅ All v8 security features (encryption, IDOR) stay intact
  ✅ Free 512MB — Kaori won't hit this for a long time
```

```typescript
// Production DB swap (the only real change):
// BEFORE (SQLite):
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

// AFTER (Neon):
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
const [user] = await sql`SELECT * FROM users WHERE id = ${id}`;
// Main diff: async/await. That's it. 😤
```

### Vercel Streaming Fix (v8)

```typescript
// src/app/api/chat/route.ts
// Vercel free tier kills functions at 10s — AI streams take 30–60s 😭
export const runtime = 'edge'; // ← edge runtime has no timeout ✅

// Keep connection alive during long streams:
const keepAlive = setInterval(() => {
  controller.enqueue(': keep-alive\n\n');
}, 5000);
```

### Prompt Injection Protection (v8)

```typescript
// src/lib/chat-api.ts
const INJECTION_PATTERNS = [
  /ignore (all |previous )?instructions/i,
  /you are now/i,
  /reveal.*system prompt/i,
  /print all users/i,
  /jailbreak/i,
  /DAN mode/i,
  /pretend you have no restrictions/i,
];

export function detectInjection(msg: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(msg));
}

// In chat route — check before every AI call:
if (detectInjection(userMessage)) {
  return Response.json({ error: 'Nice try 😏' }, { status: 400 });
}
```

### Logging (pino)

```typescript
import pino from 'pino';
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});
// Log: auth events, tool calls, rate limit hits, API errors
// Never log: message content, passwords, tokens
```

### SQLite Backup

```typescript
// scripts/backup-db.ts — keeps 7 rolling daily backups
// npm run backup — run before any risky migration
```

### Error Monitoring (Sentry)

```bash
npx @sentry/wizard@latest -i nextjs
```

```typescript
import * as Sentry from '@sentry/nextjs';
try { /* risky op */ } catch (err) {
  Sentry.captureException(err, { extra: { userId, action: 'chat_stream' } });
}
// Free tier: 5,000 errors/month
```

---

## Testing Strategy

```bash
npm install -D vitest @testing-library/react @testing-library/user-event
```

### Unit Tests

```typescript
// crypto.ts
describe('encrypt/decrypt', () => {
  it('round-trips correctly', () => {
    expect(decrypt(encrypt('test-value'))).toBe('test-value');
  });
});

// spend-guard.ts
describe('checkSpend', () => {
  it('throws when limit exceeded', () => {
    expect(() => checkSpend(mockUserId, 999)).toThrow('Daily spend limit');
  });
});

// ownership.ts
describe('requireConversationOwner', () => {
  it('returns 404 for wrong user', () => {
    expect(() => requireConversationOwner('conv-1', 'wrong-user')).toThrow();
  });
});

// kaori-mood.ts
describe('determineMood', () => {
  it('returns sleepy at 2am', () => {
    expect(determineMood({ hour: 2, topic: 'code', userEnergy: 'low', recentSuccess: false }))
      .toBe('sleepy');
  });
});
```

### Integration Tests

```typescript
// Auth flow
// POST /api/auth/signup → 201
// POST /api/auth/login  → 200, access + refresh cookies
// GET  /api/auth/me     → 200
// POST /api/auth/refresh → 200, new access token
// POST /api/auth/logout  → 200, refresh token deleted from DB

// Security
// POST /api/chat (no session)         → 401
// POST /api/chat (no CSRF header)     → 403
// GET  /api/chats/[other-user-id]     → 404
// POST /api/chat (21 msgs in 1 min)   → 429
// Upload renamed .jpg as .pdf         → 400 file type mismatch

// Multi-provider
// POST /api/chat { provider: 'openai', model: 'gpt-4o' } → streams correctly
// POST /api/chat { provider: 'groq' } with tool call → tool disabled gracefully
```

---

## Complete Feature Priority Table (v7)

| Feature | Phase | Effort | Wow Factor | Status |
|---|---|---|---|---|
| Core chat + streaming | 1 | High | ⭐⭐⭐⭐⭐ | Build first |
| Auth (login/signup) | 1 | Medium | ⭐⭐⭐ | Build first |
| Animated avatar | 2 | Medium | ⭐⭐⭐⭐⭐ | Week 3 |
| Kaori personality | 2 | Easy | ⭐⭐⭐⭐ | Week 3 |
| Web search (Brave) | 3 | Easy | ⭐⭐⭐⭐⭐ | Week 4 |
| Document generation | 3 | Medium | ⭐⭐⭐⭐ | Week 4 |
| GitHub search | 3 | Easy | ⭐⭐⭐ | Week 4 |
| **Multi-provider AI** | **3.5** | **Medium** | **⭐⭐⭐⭐⭐** | **Week 4.5 ← NEW** |
| Google OAuth | 4 | High | ⭐⭐⭐⭐ | Week 5 |
| Spotify OAuth | 4 | Medium | ⭐⭐⭐ | Week 5 |
| PWA install | 5 | Easy | ⭐⭐⭐⭐ | Week 6 |
| Settings modal | 5 | Medium | ⭐⭐⭐ | Week 6 |
| **JWT refresh tokens** | **5.5** | **Medium** | **⭐⭐⭐** | **Week 6.5 ← NEW** |
| **Security headers** | **5.5** | **Easy** | **⭐⭐⭐** | **Week 6.5 ← NEW** |
| **IDOR ownership checks** | **5.5** | **Easy** | **⭐⭐⭐** | **Week 6.5 ← NEW** |
| **Chat rate limiting** | **5.5** | **Easy** | **⭐⭐⭐** | **Week 6.5 ← NEW** |
| **Spend guard** | **5.5** | **Medium** | **⭐⭐⭐** | **Week 6.5 ← NEW** |
| **Message encryption** | **5.5** | **Medium** | **⭐⭐⭐** | **Week 6.5 ← NEW** |
| **File MIME validation** | **5.5** | **Easy** | **⭐⭐⭐** | **Week 6.5 ← NEW** |
| **Session management UI** | **5.5** | **Medium** | **⭐⭐⭐** | **Week 6.5 ← NEW** |
| **GDPR export + delete** | **5.5** | **Medium** | **⭐⭐** | **Week 6.5 ← NEW** |
| Memory system | 6 | Medium | ⭐⭐⭐⭐⭐ | Week 7 |
| File chat (PDF/CSV) | 6 | Medium | ⭐⭐⭐⭐⭐ | Week 7 |
| Image input (vision) | 6 | Easy | ⭐⭐⭐⭐⭐ | Week 7 |
| Code interpreter | 6 | Hard | ⭐⭐⭐⭐⭐ | Week 7 |
| Scheduled reminders | 6 | Medium | ⭐⭐⭐⭐ | Week 7 |
| Web monitoring | 6 | Medium | ⭐⭐⭐ | Week 7 |
| **Task / Todo Manager** | **6.5** | **Medium** | **⭐⭐⭐⭐⭐** | **Week 7.5 ← NEW** |
| **Snippet Vault** | **6.5** | **Medium** | **⭐⭐⭐⭐** | **Week 7.5 ← NEW** |
| **Daily Briefing** | **6.5** | **Medium** | **⭐⭐⭐⭐⭐** | **Week 7.5 ← NEW** |
| **Conversation Export** | **6.5** | **Easy** | **⭐⭐⭐⭐** | **Week 7.5 ← NEW** |
| **Pomodoro / Focus Mode** | **6.5** | **Easy** | **⭐⭐⭐⭐** | **Week 7.5 ← NEW** |
| Mood system | 7 | Medium | ⭐⭐⭐⭐⭐ | Week 8 |
| Relationship levels | 7 | Medium | ⭐⭐⭐⭐⭐ | Week 8 |
| Daily greeting | 7 | Easy | ⭐⭐⭐⭐ | Week 8 |
| Voice output (TTS) | 7 | Easy | ⭐⭐⭐⭐ | Week 8 |
| Reaction emotes | 7 | Easy | ⭐⭐⭐⭐ | Week 8 |
| Opinion mode | 7 | Easy | ⭐⭐⭐⭐ | Week 8 |
| Glassmorphism UI | 8 | Easy | ⭐⭐⭐⭐⭐ | Week 9 |
| Animated background | 8 | Easy | ⭐⭐⭐⭐⭐ | Week 9 |
| Command palette ⌘K | 8 | Medium | ⭐⭐⭐⭐ | Week 9 |
| Custom themes | 8 | Easy | ⭐⭐⭐ | Week 9 |
| Split view mode | 8 | Medium | ⭐⭐⭐⭐ | Week 9 |
| Confetti celebration | 8 | Easy | ⭐⭐⭐⭐ | Week 9 |
| Message reactions | 8 | Easy | ⭐⭐⭐⭐ | Week 9 |
| Multi-chat tabs | 9 | Medium | ⭐⭐⭐ | Week 10 |
| Prompt library | 9 | Easy | ⭐⭐⭐⭐ | Week 10 |
| Canvas / whiteboard | 9 | Hard | ⭐⭐⭐ | Week 10 |
| Study mode | 9 | Easy | ⭐⭐⭐⭐ | Week 10 |
| API playground | 9 | Medium | ⭐⭐⭐ | Week 10 |
| Chrome extension | 0A | High | ⭐⭐⭐⭐ | Week 11+ |
| Desktop agent | 0B | High | ⭐⭐⭐ | Optional |
| Cross-device sync | 0C | Medium | ⭐⭐⭐ | Optional |

---

## Changelog: v7 → v8

| Category | What Changed |
|---|---|
| **crypto.ts** | Encryption key now uses `ENCRYPTION_KEY` env var — never `JWT_SECRET` |
| **Auth rate limit** | Moved from in-memory Map → SQLite `rate_limits` table (survives restarts) |
| **Daily briefing cache** | Moved from in-memory Map → SQLite `users` table (survives restarts) |
| **System prompt** | Dynamic — only injects tools relevant to current message (saves 600–900 tokens) |
| **Chat history** | Rolling summary compression after 10 messages (saves 60–70% tokens) |
| **Memory retrieval** | Scored top-3 retrieval instead of full memory dump (saves 200–350 tokens) |
| **WebSocket** | Replaced with SSE — Next.js App Router compatible |
| **Health endpoint** | `/api/health` — DB ping + uptime, for UptimeRobot monitoring |
| **CI/CD** | GitHub Actions — auto test + auto deploy on every push to main |
| **Deployment** | Neon PostgreSQL for production (SQLite locally), Vercel hosting |
| **Prompt injection** | Pattern-based detection middleware before every AI call |
| **Vercel streaming** | Edge runtime — no 10s timeout limit |
| **DB schema** | `users` table: added `briefing_cache`, `briefing_generated_at` |
| **`.env`** | Added `ENCRYPTION_KEY` (required, separate from JWT_SECRET) |
| **Feature count** | v7: 52 features → v8: **52 features + hardened infra** |

## Changelog: v6 → v7

| Category | What Changed |
|---|---|
| **Multi-Provider AI** | New Phase 3.5 — Anthropic, OpenAI, Google, Groq, Mistral via unified abstraction layer |
| **Provider selector UI** | Model dropdown expanded to grouped provider + model picker |
| **Tool compatibility** | Groq/Mistral show "Tools unavailable" badge; tools disabled gracefully |
| **JWT refresh tokens** | New refresh_tokens table + /api/auth/refresh route + token rotation |
| **Security headers** | X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy in next.config.ts |
| **IDOR protection** | requireConversationOwner/requireTaskOwner helpers — all data routes audited |
| **Chat rate limiting** | 20 msgs/min per user — uses existing rate_limits table |
| **Spend guard** | Per-user daily API spend cap with DB tracking and auto-reset |
| **Message encryption** | AES-256-GCM on message content column using existing crypto.ts |
| **File MIME validation** | file-type package — magic bytes check, extension spoofing rejected |
| **Session management** | /api/user/sessions — list + revoke active sessions UI |
| **GDPR export/delete** | /api/user/export and /api/user/delete routes |
| **Task Manager** | New tasks table + add/complete/list/delete tools — Kaori manages your todos |
| **Snippet Vault** | New snippets table + save/recall/delete tools — named clipboard for AI output |
| **Daily Briefing** | Morning digest with tasks + monitors + memories + relationship context |
| **Conversation Export** | /api/chats/[id]/export?format=md|pdf|txt — export any chat |
| **Pomodoro Mode** | 25/5/15 min timer widget, focus-aware Kaori, ⌘K accessible |
| **DB schema** | Added: refresh_tokens, tasks, snippets, daily_spend_usd, spend_reset_date |
| **New env vars** | JWT_REFRESH_SECRET, provider API keys, DAILY_SPEND_LIMIT_USD |
| **New packages** | file-type, openai, @google/generative-ai, groq-sdk, @mistralai/mistralai, vitest |
| **⌘K commands** | Added: tasks, snippets, pomodoro, export |
| **Feature count** | v6: 37 features → v7: **52 features** |

---

*Kaori AI Godmode v8 — 52 features, hardened infra, token-optimized, production-ready. Start at Phase 0D → Phase 1. 🚀🌸*
