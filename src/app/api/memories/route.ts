import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../lib/auth-utils";
import { createStructuredMemory, listManagedMemories } from "../lib/memory/service";
import { memoryDto } from "../lib/memory-dto";
import { InputValidationError, validateMemoryInput } from "../lib/validation";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json((await listManagedMemories(user.id)).map(memoryDto));
}

export async function POST(req: NextRequest) {
  try {
    requireAjax(req);
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const fields = validateMemoryInput(await req.json().catch(() => ({})));
    const memory = await createStructuredMemory({
      userId: user.id,
      content: fields.content,
      tags: fields.tags,
      sourceType: "manual",
      status: "approved",
    });
    return NextResponse.json(memoryDto(memory), { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof InputValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Secrets and credentials cannot be saved as memory") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create memory" }, { status: 500 });
  }
}
