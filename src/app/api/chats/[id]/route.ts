import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import {
  findConversation,
  getConversationMessages,
  updateConversationTitle,
  toggleConversationStar,
  deleteConversation,
} from "../../lib/db";
import { decryptContent } from "../../lib/crypto";
import { validateConversationTitle } from "../../lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const conv = await findConversation(id);

    // IDOR: return 404 if not owner or not found
    if (!conv || conv.user_id !== user.id) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const rawMessages = (await getConversationMessages(id)).map((m) => ({
      ...m,
      content: decryptContent(m.content),
    }));

    const parsedMessages: any[] = [];

    for (let i = 0; i < rawMessages.length; i++) {
      const m = rawMessages[i];
      let content = m.content;
      let toolResults = undefined;
      let skip = false;

      try {
        if (content.trim().startsWith("[")) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            if (m.role === "assistant") {
              const textBlocks = parsed.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
              content = textBlocks;

              const toolUseBlocks = parsed.filter((b: any) => b.type === "tool_use");
              const toolMap = new Map(toolUseBlocks.map((b: any) => [b.id, b.name]));

              if (i + 1 < rawMessages.length && rawMessages[i + 1].role === "user") {
                const nextRaw = rawMessages[i + 1].content;
                if (nextRaw.trim().startsWith("[")) {
                  try {
                    const nextParsed = JSON.parse(nextRaw);
                    const resultBlocks = nextParsed.filter((b: any) => b.type === "tool_result");
                    if (resultBlocks.length > 0) {
                      toolResults = resultBlocks.map((r: any) => ({
                        toolName: toolMap.get(r.tool_use_id) || "tool",
                        result: r.content,
                      }));
                    }
                  } catch {}
                }
              }
            } else if (m.role === "user") {
              const hasToolResult = parsed.some((b: any) => b.type === "tool_result");
              const hasText = parsed.some((b: any) => b.type === "text");

              if (hasToolResult && !hasText) {
                skip = true;
              } else if (hasText) {
                content = parsed.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
              }
            }
          }
        }
      } catch {}

      if (!skip) {
        parsedMessages.push({
          id: m.id,
          role: m.role,
          content,
          toolResults,
          timestamp: new Date(m.created_at * 1000).toISOString(),
        });
      }
    }

    return NextResponse.json({
      id: conv.id,
      userId: conv.user_id,
      title: conv.title,
      isStarred: conv.is_starred === 1,
      messages: parsedMessages,
      createdAt: new Date(conv.created_at * 1000).toISOString(),
      updatedAt: new Date(conv.updated_at * 1000).toISOString(),
    });
  } catch (err: any) {
    console.error("[GET /api/chats/[id]] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    try {
      requireAjax(req);
    } catch (err) {
      if (err instanceof Response) return err;
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const conv = await findConversation(id);

    if (!conv || conv.user_id !== user.id) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    if (body.title !== undefined) {
      await updateConversationTitle(id, validateConversationTitle(body.title));
    }
    if (body.is_starred !== undefined) {
      await toggleConversationStar(id, body.is_starred ? 1 : 0);
    }

    const updated = (await findConversation(id))!;
    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      isStarred: updated.is_starred === 1,
      createdAt: new Date(updated.created_at * 1000).toISOString(),
      updatedAt: new Date(updated.updated_at * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error("PATCH chat error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    requireAjax(req);
  } catch (err) {
    if (err instanceof Response) return err;
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conv = await findConversation(id);

  if (!conv || conv.user_id !== user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  await deleteConversation(id);
  return NextResponse.json({ ok: true });
}
