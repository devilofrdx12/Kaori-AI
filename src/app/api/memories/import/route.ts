import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { createStructuredMemory } from "../../lib/memory/service";
import { validateMemoryInput } from "../../lib/validation";
import { logger } from "../../lib/logger";

export async function POST(req: NextRequest) {
  try {
    requireAjax(req);
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const records = Array.isArray(body.memories) ? body.memories.slice(0, 200) : [];
    if (!records.length) return NextResponse.json({ error: "No memories to import" }, { status: 400 });
    let imported = 0;
    for (const record of records) {
      const fields = validateMemoryInput(record);
      await createStructuredMemory({
        userId: user.id,
        content: fields.content,
        tags: fields.tags,
        category: typeof record.category === "string" ? record.category.slice(0, 40) : "fact",
        status: "pending",
        sourceType: "import",
        confidence: 1,
      });
      imported += 1;
    }
    return NextResponse.json({ success: true, imported });
  } catch (error) {
    if (error instanceof Response) return error;
    logger.warn({ error }, "Memory import failed");
    return NextResponse.json({ error: "Memory import failed. Check the file format and try again." }, { status: 400 });
  }
}
