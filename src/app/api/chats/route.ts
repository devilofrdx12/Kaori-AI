import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "../lib/auth-utils";
import {
  getUserConversations,
  createConversation,
} from "../lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convs = getUserConversations(user.id).map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: new Date(c.created_at * 1000).toISOString(),
    updatedAt: new Date(c.updated_at * 1000).toISOString(),
  }));

  return NextResponse.json(convs);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = body.title || "New chat";

  const conv = createConversation({
    id: uuid(),
    user_id: user.id,
    title,
  });

  return NextResponse.json({
    id: conv.id,
    title: conv.title,
    createdAt: new Date(conv.created_at * 1000).toISOString(),
    updatedAt: new Date(conv.updated_at * 1000).toISOString(),
  });
}
