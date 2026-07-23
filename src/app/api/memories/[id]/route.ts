import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { deleteUserMemory, updateUserMemory } from "../../lib/db";
import { requireMemoryOwner } from "../../lib/ownership";
import { validateMemoryInput } from "../../lib/validation";

type Context = { params: Promise<{ id: string }> };

async function authorize(id: string) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await requireMemoryOwner(id, user.id);
  return null;
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    requireAjax(req);
    const { id } = await context.params;
    const denied = await authorize(id);
    if (denied) return denied;
    const fields = validateMemoryInput(await req.json().catch(() => ({})));
    const memory = await updateUserMemory(id, fields);
    return NextResponse.json({
      id: memory.id,
      content: memory.content,
      tags: fields.tags,
      createdAt: new Date(memory.created_at * 1000).toISOString(),
      updatedAt: new Date(memory.updated_at * 1000).toISOString(),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid memory" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    requireAjax(req);
    const { id } = await context.params;
    const denied = await authorize(id);
    if (denied) return denied;
    await deleteUserMemory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Unable to delete memory" }, { status: 500 });
  }
}
