import { randomUUID } from "node:crypto";
import { decryptContent, encryptContent } from "../crypto";
import { getDb, mapRows, type DBUserMemory } from "../db";

export type MemoryStatus = "pending" | "approved" | "rejected" | "outdated" | "archived";
export type MemoryScope = "global" | "project" | "session" | "temporary";

export type MemorySettings = {
  enabled: boolean;
  readEnabled: boolean;
  suggestionsEnabled: boolean;
  autoSavePreferences: boolean;
};

const DEFAULT_SETTINGS: MemorySettings = {
  enabled: true,
  readEnabled: true,
  suggestionsEnabled: true,
  autoSavePreferences: false,
};

const PROHIBITED_MEMORY_PATTERNS = [
  /\b(?:sk-[a-z0-9_-]{12,}|ghp_[a-z0-9]{20,})\b/i,
  /\b(?:BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)\b/i,
  /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|passcode|recovery code)\s*[:=]\s*["']?[^\s"']{8,}/i,
];

function assertMemoryIsSafe(content: string) {
  if (PROHIBITED_MEMORY_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new Error("Secrets and credentials cannot be saved as memory");
  }
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function tokenize(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
}

async function createEmbedding(text: string): Promise<{ values: number[]; model: string } | null> {
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_KEY?.trim();
  if (geminiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: text.slice(0, 8000) }] }
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        const data = await response.json();
        const embedding = data?.embedding?.values;
        if (Array.isArray(embedding) && embedding.length > 0) {
          return { values: embedding, model: "text-embedding-004" };
        }
      }
    } catch {}
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAiKey) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;
    if (Array.isArray(embedding) && embedding.length > 0 && embedding.every((value: unknown) => typeof value === "number" && Number.isFinite(value))) {
      return { values: embedding, model: "text-embedding-3-small" };
    }
  } catch {}
  
  return null;
}

function cosineSimilarity(left: number[] | null, right: number[] | null) {
  if (!left || !right || left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  return leftMagnitude && rightMagnitude
    ? dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
    : 0;
}

function decryptMemory(memory: DBUserMemory): DBUserMemory {
  return { ...memory, content: decryptContent(memory.content) };
}

function isMemoryVisibleInContext(memory: DBUserMemory, projectId?: string | null) {
  if (memory.scope === "global") return true;
  return memory.scope === "project" && Boolean(projectId) && memory.project_id === projectId;
}

export async function getMemorySettings(userId: string): Promise<MemorySettings> {
  const db = await getDb();
  const rows = mapRows<{
    enabled: number;
    read_enabled: number;
    suggestions_enabled: number;
    auto_save_preferences: number;
  }>(await db.execute({ sql: "SELECT * FROM memory_settings WHERE user_id = ?", args: [userId] }));
  const row = rows[0];
  return row ? {
    enabled: row.enabled === 1,
    readEnabled: row.read_enabled === 1,
    suggestionsEnabled: row.suggestions_enabled === 1,
    autoSavePreferences: row.auto_save_preferences === 1,
  } : DEFAULT_SETTINGS;
}

export async function updateMemorySettings(userId: string, settings: Partial<MemorySettings>) {
  const current = await getMemorySettings(userId);
  const next = { ...current, ...settings };
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO memory_settings
      (user_id, enabled, read_enabled, suggestions_enabled, auto_save_preferences, updated_at)
      VALUES (?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET
        enabled = excluded.enabled,
        read_enabled = excluded.read_enabled,
        suggestions_enabled = excluded.suggestions_enabled,
        auto_save_preferences = excluded.auto_save_preferences,
        updated_at = unixepoch()`,
    args: [userId, next.enabled ? 1 : 0, next.readEnabled ? 1 : 0,
      next.suggestionsEnabled ? 1 : 0, next.autoSavePreferences ? 1 : 0],
  });
  return next;
}

export async function listManagedMemories(userId: string): Promise<DBUserMemory[]> {
  const db = await getDb();
  const rows = mapRows<DBUserMemory>(await db.execute({
    sql: `SELECT * FROM user_memories
      WHERE user_id = ? AND status != 'rejected'
      ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, updated_at DESC`,
    args: [userId],
  }));
  return rows.map(decryptMemory);
}

export async function createStructuredMemory(input: {
  userId: string;
  content: string;
  tags?: string[];
  category?: string;
  scope?: MemoryScope;
  status?: MemoryStatus;
  projectId?: string | null;
  sourceType?: string;
  sourceConversationId?: string | null;
  confidence?: number;
  importance?: number;
}) {
  const content = normalize(input.content).slice(0, 2000);
  if (!content) throw new Error("Memory content is required");
  assertMemoryIsSafe(content);
  const db = await getDb();
  const existing = mapRows<DBUserMemory>(await db.execute({
    sql: "SELECT * FROM user_memories WHERE user_id = ? AND lower(content) = lower(?) AND status IN ('pending','approved') LIMIT 1",
    args: [input.userId, content],
  }))[0];
  // Encrypted rows cannot be compared in SQL, so also check decrypted recent records.
  const recent = await listManagedMemories(input.userId);
  const duplicate = existing || recent.find((memory) => normalize(memory.content).toLowerCase() === content.toLowerCase());
  if (duplicate) return decryptMemory(duplicate);

  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO user_memories
      (id, user_id, content, tags, category, scope, status, project_id, source_type,
       source_conv_id, confidence, importance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.userId, encryptContent(content), JSON.stringify(input.tags || []),
      input.category || "fact", input.scope || "global", input.status || "approved",
      input.projectId || null, input.sourceType || "manual", input.sourceConversationId || null,
      input.confidence ?? 1, input.importance ?? 0.5],
  });
  const embedding = await createEmbedding(content);
  if (embedding) {
    await db.execute({
      sql: "UPDATE user_memories SET embedding = ?, embedding_model = ? WHERE id = ? AND user_id = ?",
      args: [JSON.stringify(embedding.values), embedding.model, id, input.userId],
    });
  }
  await recordMemoryEvent(input.userId, id, "created", { sourceType: input.sourceType || "manual" });
  return (await listManagedMemories(input.userId)).find((memory) => memory.id === id)!;
}

export async function setMemoryStatus(userId: string, memoryId: string, status: MemoryStatus) {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE user_memories SET status = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?",
    args: [status, memoryId, userId],
  });
  await recordMemoryEvent(userId, memoryId, status, {});
}

export async function updateStructuredMemory(
  userId: string,
  memoryId: string,
  fields: { content: string; tags: string[] }
) {
  const content = normalize(fields.content).slice(0, 2000);
  if (!content) throw new Error("Memory content is required");
  assertMemoryIsSafe(content);
  const db = await getDb();
  await db.execute({
    sql: `UPDATE user_memories
      SET content = ?, tags = ?, updated_at = unixepoch()
      WHERE id = ? AND user_id = ?`,
    args: [encryptContent(content), JSON.stringify(fields.tags), memoryId, userId],
  });
  const memory = (await listManagedMemories(userId)).find((item) => item.id === memoryId);
  if (!memory) throw new Error("Memory not found");
  return memory;
}

async function recordMemoryEvent(userId: string, memoryId: string | null, action: string, metadata: object) {
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO memory_events (id, user_id, memory_id, action, metadata) VALUES (?, ?, ?, ?, ?)",
    args: [randomUUID(), userId, memoryId, action, JSON.stringify(metadata)],
  });
}

export async function retrieveRelevantMemories(input: {
  userId: string;
  query: string;
  projectId?: string | null;
  limit?: number;
}): Promise<Array<DBUserMemory & { relevance: number; reason: string }>> {
  const settings = await getMemorySettings(input.userId);
  if (!settings.enabled || !settings.readEnabled) return [];
  const db = await getDb();
  const rows = mapRows<DBUserMemory>(await db.execute({
    sql: `SELECT * FROM user_memories
      WHERE user_id = ? AND status = 'approved'
        AND (expires_at IS NULL OR expires_at > unixepoch())
        AND (scope = 'global' OR (scope = 'project' AND project_id = ?))
      ORDER BY importance DESC, updated_at DESC LIMIT 100`,
    args: [input.userId, input.projectId || null],
  })).map(decryptMemory);
  const queryTokens = tokenize(input.query);
  const queryEmbeddingRes = await createEmbedding(input.query);
  const queryEmbedding = queryEmbeddingRes ? queryEmbeddingRes.values : null;
  return rows.map((memory) => {
    const memoryTokens = tokenize(`${memory.content} ${memory.tags}`);
    let overlap = 0;
    for (const token of queryTokens) if (memoryTokens.has(token)) overlap += 1;
    const lexical = queryTokens.size ? overlap / queryTokens.size : 0;
    let storedEmbedding: number[] | null = null;
    try {
      const parsed = memory.embedding ? JSON.parse(memory.embedding) : null;
      if (Array.isArray(parsed)) storedEmbedding = parsed;
    } catch {}
    const semantic = cosineSimilarity(queryEmbedding, storedEmbedding);
    const projectBoost = memory.project_id && memory.project_id === input.projectId ? 0.35 : 0;
    const relevance = (queryEmbedding ? semantic * 0.45 + lexical * 0.15 : lexical * 0.6)
      + projectBoost + Number(memory.importance || 0.5) * 0.2 + Number(memory.confidence || 1) * 0.2;
    return { ...memory, relevance, reason: projectBoost ? "Relevant project memory" : "Relevant personal memory" };
  }).filter((memory) => memory.relevance >= 0.2)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, input.limit || 8);
}

export async function handleExplicitMemoryCommand(input: {
  userId: string;
  conversationId: string;
  projectId?: string | null;
  message: string;
}): Promise<string | null> {
  const remember = /^(?:please\s+)?remember(?:\s+that)?\s+(.+)/i.exec(input.message.trim());
  if (remember) {
    try {
      const memory = await createStructuredMemory({
        userId: input.userId, content: remember[1], sourceType: "explicit",
        sourceConversationId: input.conversationId, confidence: 1, importance: 0.8,
        scope: input.projectId ? "project" : "global",
        projectId: input.projectId,
      });
      return input.projectId
        ? `Got it — I’ll remember this only inside this project: “${memory.content}”`
        : `Got it — I’ll remember: “${memory.content}”`;
    } catch (error) {
      return error instanceof Error ? error.message : "I couldn’t safely save that memory.";
    }
  }
  const forget = /^(?:please\s+)?forget(?:\s+that|\s+about)?\s+(.+)/i.exec(input.message.trim());
  if (forget) {
    const candidates = (await listManagedMemories(input.userId))
      .filter((memory) => isMemoryVisibleInContext(memory, input.projectId));
    const query = tokenize(forget[1]);
    const match = candidates.map((memory) => ({ memory, score: [...query].filter((token) => tokenize(memory.content).has(token)).length }))
      .sort((a, b) => b.score - a.score)[0];
    if (!match || match.score === 0) return "I couldn’t find a matching saved memory to forget.";
    await setMemoryStatus(input.userId, match.memory.id, "archived");
    return `Forgotten: “${match.memory.content}”`;
  }
  const update = /^(?:please\s+)?update\s+(?:my\s+)?(.+?)\s+to\s+(.+)/i.exec(input.message.trim());
  if (update) {
    const candidates = (await listManagedMemories(input.userId)).filter(
      (memory) => memory.status === "approved"
        && (input.projectId
          ? memory.scope === "project" && memory.project_id === input.projectId
          : memory.scope === "global")
    );
    const query = tokenize(update[1]);
    const match = candidates.map((memory) => ({
      memory,
      score: [...query].filter((token) => tokenize(memory.content).has(token)).length,
    })).sort((a, b) => b.score - a.score)[0];
    try {
      const memory = await createStructuredMemory({
        userId: input.userId,
        content: `${update[1]}: ${update[2]}`,
        category: match?.memory.category || "fact",
        sourceType: "explicit-update",
        sourceConversationId: input.conversationId,
        scope: input.projectId ? "project" : "global",
        projectId: input.projectId,
        confidence: 1,
        importance: 0.8,
      });
      if (match?.score && match.memory.id !== memory.id) {
        await setMemoryStatus(input.userId, match.memory.id, "outdated");
      }
      return `Updated — I’ll now remember: “${memory.content}”`;
    } catch (error) {
      return error instanceof Error ? error.message : "I couldn’t safely update that memory.";
    }
  }
  if (/^(?:what|show me).*(?:remember|know about me)/i.test(input.message.trim())) {
    const memories = (await listManagedMemories(input.userId))
      .filter((memory) => memory.status === "approved" && isMemoryVisibleInContext(memory, input.projectId))
      .slice(0, 20);
    return memories.length
      ? ["Here’s what I currently remember:", ...memories.map((memory) => `- ${memory.content}`)].join("\n")
      : "I don’t have any approved memories about you yet.";
  }
  return null;
}

export async function suggestMemoriesFromMessage(input: {
  userId: string;
  conversationId: string;
  projectId?: string | null;
  message: string;
}) {
  const settings = await getMemorySettings(input.userId);
  if (!settings.enabled || !settings.suggestionsEnabled) return;
  const patterns: Array<{ regex: RegExp; category: string }> = [
    { regex: /\bI prefer\s+(.+)/i, category: "preference" },
    { regex: /\bmy name is\s+(.+)/i, category: "identity" },
    { regex: /\bI(?:'m| am) (?:building|working on)\s+(.+)/i, category: "goal" },
    { regex: /\bmy goal is\s+(.+)/i, category: "goal" },
  ];
  for (const candidate of patterns) {
    const match = candidate.regex.exec(input.message);
    if (!match) continue;
    await createStructuredMemory({
      userId: input.userId,
      content: match[0],
      category: candidate.category,
      scope: input.projectId ? "project" : "global",
      projectId: input.projectId,
      status: candidate.category === "preference" && settings.autoSavePreferences ? "approved" : "pending",
      sourceType: "conversation",
      sourceConversationId: input.conversationId,
      confidence: 0.85,
      importance: 0.7,
    });
    break;
  }
}
