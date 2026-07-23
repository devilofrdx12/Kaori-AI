export type Project = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  chatCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Memory = {
  id: string;
  content: string;
  tags: string[];
  sourceConversationId?: string | null;
  createdAt: string;
  updatedAt: string;
};

const HEADERS = { "X-Requested-With": "XMLHttpRequest" };

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

export const listProjects = () => request<Project[]>("/api/projects", { headers: HEADERS });

export const createProject = (fields: Pick<Project, "name" | "description" | "instructions">) =>
  request<Project>("/api/projects", {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });

export const updateProject = (id: string, fields: Pick<Project, "name" | "description" | "instructions">) =>
  request<Project>(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });

export const deleteProject = (id: string) =>
  request<{ success: true }>(`/api/projects/${id}`, { method: "DELETE", headers: HEADERS });

export const listMemories = () => request<Memory[]>("/api/memories", { headers: HEADERS });

export const createMemory = (content: string, tags: string[]) =>
  request<Memory>("/api/memories", {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ content, tags }),
  });

export const deleteMemory = (id: string) =>
  request<{ success: true }>(`/api/memories/${id}`, { method: "DELETE", headers: HEADERS });
