import { NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth-utils";
import { listManagedMemories } from "../../lib/memory/service";
import { memoryDto } from "../../lib/memory-dto";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const memories = (await listManagedMemories(user.id)).map(memoryDto);
  return NextResponse.json({ version: 1, exportedAt: new Date().toISOString(), memories });
}
