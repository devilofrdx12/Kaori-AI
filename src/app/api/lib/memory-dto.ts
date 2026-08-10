import type { DBUserMemory } from "./db";

export function parseMemoryTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

export function memoryDto(memory: DBUserMemory) {
  return {
    id: memory.id,
    content: memory.content,
    tags: parseMemoryTags(memory.tags),
    category: memory.category,
    scope: memory.scope,
    status: memory.status,
    projectId: memory.project_id,
    sourceType: memory.source_type,
    sourceConversationId: memory.source_conv_id,
    expiresAt: memory.expires_at
      ? new Date(memory.expires_at * 1000).toISOString()
      : null,
    createdAt: new Date(memory.created_at * 1000).toISOString(),
    updatedAt: new Date(memory.updated_at * 1000).toISOString(),
  };
}
