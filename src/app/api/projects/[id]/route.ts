import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../../lib/auth-utils";
import { deleteProject, findProject, getProjectConversationCount, updateProject } from "../../lib/db";
import { requireProjectOwner } from "../../lib/ownership";
import { validateProjectInput } from "../../lib/validation";

type Context = { params: Promise<{ id: string }> };

async function authorize(id: string) {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const ownership = await requireProjectOwner(id, user.id);
  if (!ownership.ok) {
    return { response: NextResponse.json({ error: ownership.error }, { status: ownership.status }) };
  }
  return { user };
}

function dto(project: NonNullable<Awaited<ReturnType<typeof findProject>>>, chatCount: number) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    instructions: project.instructions,
    chatCount,
    createdAt: new Date(project.created_at * 1000).toISOString(),
    updatedAt: new Date(project.updated_at * 1000).toISOString(),
  };
}

export async function GET(_req: NextRequest, context: Context) {
  const { id } = await context.params;
  const auth = await authorize(id);
  if (auth.response) return auth.response;
  const project = await findProject(id);
  return NextResponse.json(dto(project!, await getProjectConversationCount(id)));
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    requireAjax(req);
    const { id } = await context.params;
    const auth = await authorize(id);
    if (auth.response) return auth.response;
    const fields = validateProjectInput(await req.json().catch(() => ({})));
    const project = await updateProject(id, fields);
    return NextResponse.json(dto(project, await getProjectConversationCount(id)));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid project" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    requireAjax(req);
    const { id } = await context.params;
    const auth = await authorize(id);
    if (auth.response) return auth.response;
    await deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Unable to delete project" }, { status: 500 });
  }
}
