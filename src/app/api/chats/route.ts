import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser, requireAjax } from "../lib/auth-utils";
import {
  getUserConversations,
  createConversation,
  deleteUserConversations,
} from "../lib/db";
import { validateConversationTitle } from "../lib/validation";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawConvs = await getUserConversations(user.id);

    const convs = rawConvs.map((c) => ({
      id: c.id,
      title: c.title,
      isStarred: c.is_starred === 1,
      createdAt: c.created_at
        ? new Date(c.created_at * 1000).toISOString()
        : new Date().toISOString(),
      updatedAt: c.updated_at
        ? new Date(c.updated_at * 1000).toISOString()
        : new Date().toISOString(),
    }));

    return NextResponse.json(convs);
  } catch (err) {
    console.error("[GET /api/chats] Error:", err);
    return NextResponse.json({ error: "Unable to load chats right now." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = validateConversationTitle(body.title);

  const conv = await createConversation({
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

export async function DELETE(req: NextRequest) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteUserConversations(user.id);

  return NextResponse.json({ success: true });
}
