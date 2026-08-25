import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { deleteUserMemory } from "../../lib/db";
import { requireMemoryOwner } from "../../lib/ownership";
import { InputValidationError, validateMemoryInput } from "../../lib/validation";
import { memoryDto } from "../../lib/memory-dto";
import { setMemoryStatus, updateStructuredMemory, type MemoryStatus } from "../../lib/memory/service";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Context) {
  try {
    requireAjax(req);
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireMemoryOwner(id, user.id);
    const body = await req.json().catch(() => ({}));
    const requestedStatus = typeof body.status === "string" ? body.status as MemoryStatus : null;
    if (requestedStatus) {
      if (!["pending", "approved", "rejected", "outdated", "archived"].includes(requestedStatus)) {
        return NextResponse.json({ error: "Invalid memory status" }, { status: 400 });
      }
      await setMemoryStatus(user.id, id, requestedStatus);
      return NextResponse.json({ success: true, status: requestedStatus });
    }
    const fields = validateMemoryInput(body);
    const memory = await updateStructuredMemory(user.id, id, fields);
    return NextResponse.json(memoryDto(memory));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof InputValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Secrets and credentials cannot be saved as memory") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update memory" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    requireAjax(req);
    const { id } = await context.params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireMemoryOwner(id, user.id);
    await deleteUserMemory(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Unable to delete memory" }, { status: 500 });
  }
}
