import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth-utils";
import {
  findConversation,
  getConversationMessages,
  updateConversationTitle,
  deleteConversation,
} from "../../lib/db";
import { decryptContent } from "../../lib/crypto";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conv = findConversation(id);

  // IDOR: return 404 if not owner or not found
  if (!conv || conv.user_id !== user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const messages = getConversationMessages(id).map((m) => ({
    id: m.id,
    role: m.role,
    content: decryptContent(m.content),
    timestamp: new Date(m.created_at * 1000).toISOString(),
  }));

  return NextResponse.json({
    id: conv.id,
    userId: conv.user_id,
    title: conv.title,
    messages,
    createdAt: new Date(conv.created_at * 1000).toISOString(),
    updatedAt: new Date(conv.updated_at * 1000).toISOString(),
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const conv = findConversation(id);

  if (!conv || conv.user_id !== user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  if (body.title) {
    updateConversationTitle(id, body.title);
  }

  const updated = findConversation(id)!;
  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    createdAt: new Date(updated.created_at * 1000).toISOString(),
    updatedAt: new Date(updated.updated_at * 1000).toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conv = findConversation(id);

  if (!conv || conv.user_id !== user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  deleteConversation(id); // CASCADE deletes messages too
  return NextResponse.json({ ok: true });
}
