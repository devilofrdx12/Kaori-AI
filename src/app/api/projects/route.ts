import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAjax } from "../lib/auth-utils";
import { createProject, getProjectConversationCount, getUserProjects } from "../lib/db";
import { validateProjectInput } from "../lib/validation";

function projectDto(project: Awaited<ReturnType<typeof createProject>>, chatCount: number) {
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

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await getUserProjects(user.id);
  return NextResponse.json(await Promise.all(projects.map(async (project) =>
    projectDto(project, await getProjectConversationCount(project.id))
  )));
}

export async function POST(req: NextRequest) {
  try {
    requireAjax(req);
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fields = validateProjectInput(await req.json().catch(() => ({})));
    const project = await createProject({ id: randomUUID(), user_id: user.id, ...fields });
    return NextResponse.json(projectDto(project, 0), { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && !/database|sql|turso/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create project" }, { status: 500 });
  }
}
