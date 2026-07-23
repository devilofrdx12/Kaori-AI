import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../lib/auth-utils";
import { createUserMemory, getUserMemories, type DBUserMemory } from "../lib/db";
import { validateMemoryInput } from "../lib/validation";

function memoryDto(memory: DBUserMemory) {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(memory.tags);
    if (Array.isArray(parsed)) tags = parsed.filter((tag): tag is string => typeof tag === "string");
  } catch {}
  return {
    id: memory.id,
    content: memory.content,
    tags,
    sourceConversationId: memory.source_conv_id,
    createdAt: new Date(memory.created_at * 1000).toISOString(),
    updatedAt: new Date(memory.updated_at * 1000).toISOString(),
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json((await getUserMemories(user.id)).map(memoryDto));
}

export async function POST(req: NextRequest) {
  try {
    requireAjax(req);
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const fields = validateMemoryInput(await req.json().catch(() => ({})));
    const memory = await createUserMemory({ id: randomUUID(), user_id: user.id, ...fields });
    return NextResponse.json(memoryDto(memory), { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid memory" },
      { status: 400 }
    );
  }
}
