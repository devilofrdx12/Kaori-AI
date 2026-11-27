import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { listManagedMemories } from "../../lib/memory/service";
import { memoryDto } from "../../lib/memory-dto";

export async function GET(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const memories = (await listManagedMemories(user.id)).map(memoryDto);
  return NextResponse.json({ version: 1, exportedAt: new Date().toISOString(), memories });
}
