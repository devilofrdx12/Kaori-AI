"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Brain,
  FolderPlus,
  MessageSquarePlus,
  Plus,
  Save,
  Trash2,
  X,
  Sparkles,
  Hash,
  FileText,
  ChevronRight,
} from "lucide-react";
import {
  createMemory,
  createProject,
  deleteMemory,
  deleteProject,
  listMemories,
  listProjects,
  updateProject,
  type Memory,
  type Project,
} from "@/lib/workspace-api";

type ProjectDraft = Pick<Project, "name" | "description" | "instructions">;
const EMPTY_PROJECT: ProjectDraft = {
  name: "",
  description: "",
  instructions: "",
};

export default function ProjectsWorkspace({
  onStartChat,
}: {
  onStartChat: (project: Project) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [view, setView] = useState<"projects" | "memory">("projects");
  const [editing, setEditing] = useState<Project | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_PROJECT);
  const [memoryText, setMemoryText] = useState("");
  const [memoryTags, setMemoryTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [projectData, memoryData] = await Promise.all([
        listProjects(),
        listMemories(),
      ]);
      setProjects(projectData);
      setMemories(memoryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workspace");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = editing
        ? await updateProject(editing.id, draft)
        : await createProject(draft);
      setProjects((items) =>
        editing
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items]
      );
      setEditing(null);
      setDraft(EMPTY_PROJECT);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save project");
    } finally {
      setBusy(false);
    }
  }

  async function removeProject(project: Project) {
    if (
      !window.confirm(
        `Delete "${project.name}"? Its chats will be kept outside the project.`
      )
    )
      return;
    try {
      await deleteProject(project.id);
      setProjects((items) => items.filter((item) => item.id !== project.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete project");
    }
  }

  async function submitMemory(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await createMemory(
        memoryText,
        memoryTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      );
      setMemories((items) => [saved, ...items]);
      setMemoryText("");
      setMemoryTags("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save memory");
    } finally {
      setBusy(false);
    }
  }

  function openCreateForm() {
    setEditing(null);
    setDraft(EMPTY_PROJECT);
    setShowForm(true);
  }

  function openEditForm(project: Project) {
    setEditing(project);
    setDraft(project);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setDraft(EMPTY_PROJECT);
  }

  const inputClass =
    "mt-1.5 w-full rounded-2xl border border-white/45 dark:border-white/10 bg-white/35 dark:bg-white/[0.04] px-4 py-3 text-neutral-900 dark:text-neutral-100 outline-none backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-[hsl(var(--primary)/0.25)] focus:border-[hsl(var(--primary)/0.3)] transition-all duration-300 font-light";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-8">
      <div className="mx-auto max-w-5xl animate-spring-up">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div className="animate-fade-in">
            <p className="text-xs uppercase tracking-[0.24em] text-primary mb-2 font-medium">
              Kaori workspace
            </p>
            <h1 className="font-headline text-3xl sm:text-4xl text-neutral-900 dark:text-neutral-100 font-light tracking-tight">
              Projects & memory
            </h1>
            <p className="text-secondary mt-2 font-light">
              Group chats around a goal and control what Kaori remembers.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="settings-glass-card flex rounded-2xl border border-white/45 dark:border-white/10 bg-white/30 dark:bg-white/[0.04] p-1.5 self-start backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)]">
            {(["projects", "memory"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className={`px-5 py-2.5 rounded-xl text-sm capitalize transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover-lift active-press font-headline tracking-tight ${
                  view === tab
                    ? "bg-white/60 dark:bg-white/10 shadow-sm text-neutral-900 dark:text-neutral-100 font-medium"
                    : "text-secondary font-light hover:bg-white/30 dark:hover:bg-white/[0.06]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-900/20 px-5 py-4 text-sm text-red-700 dark:text-red-400 animate-spring-down backdrop-blur-xl"
          >
            {error}
          </div>
        )}

        {/* ═══════════════ PROJECTS VIEW ═══════════════ */}
        {view === "projects" ? (
          <div className="animate-fade-in">
            {/* Create/Edit Form */}
            {showForm ? (
              <form
                onSubmit={submitProject}
                className="settings-glass-pane rounded-[1.75rem] border border-white/45 dark:border-white/10 bg-white/30 dark:bg-white/[0.04] p-5 sm:p-7 mb-7 space-y-5 backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] animate-spring-up"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-lg text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5 font-light tracking-tight">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FolderPlus
                        size={18}
                        className="text-primary"
                      />
                    </div>
                    {editing ? "Edit project" : "Create a project"}
                  </h2>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="h-9 w-9 grid place-items-center rounded-xl text-secondary hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-white/45 dark:hover:bg-white/10 hover-lift active-press transition-colors"
                    aria-label="Cancel"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm text-neutral-500 font-medium">
                    Name
                    <input
                      required
                      maxLength={80}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                      className={inputClass}
                      placeholder="Study companion"
                    />
                  </label>
                  <label className="text-sm text-neutral-500 font-medium">
                    Description
                    <input
                      maxLength={500}
                      value={draft.description}
                      onChange={(e) =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                      className={inputClass}
                      placeholder="What this project is for"
                    />
                  </label>
                </div>

                <label className="block text-sm text-neutral-500 font-medium">
                  Project instructions
                  <textarea
                    maxLength={8000}
                    rows={3}
                    value={draft.instructions}
                    onChange={(e) =>
                      setDraft({ ...draft, instructions: e.target.value })
                    }
                    className={`${inputClass} resize-y`}
                    placeholder="How should Kaori help inside this project?"
                  />
                </label>

                <button
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-medium text-white disabled:opacity-50 hover-lift active-press hover:brightness-110 transition-all duration-300 shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.35)]"
                >
                  <Save size={16} />
                  {busy ? "Saving…" : editing ? "Save changes" : "Create project"}
                </button>
              </form>
            ) : (
              /* New Project Button */
              <button
                onClick={openCreateForm}
                className="glass-shine w-full rounded-[1.75rem] border border-dashed border-primary/30 dark:border-primary/20 bg-transparent p-5 mb-7 flex items-center justify-center gap-3 text-secondary hover:text-primary hover-lift active-press transition-all duration-500 group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300 group-hover:scale-110 transform">
                  <Plus
                    size={20}
                    className="text-primary"
                  />
                </div>
                <span className="font-headline text-sm tracking-tight font-light">
                  Create a new project
                </span>
              </button>
            )}

            {/* Project Cards */}
            <div className="grid md:grid-cols-2 gap-4 stagger-children">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="settings-glass-card glass-shine rounded-[1.75rem] border border-white/45 dark:border-white/10 bg-white/30 dark:bg-white/[0.04] p-5 sm:p-6 flex flex-col min-h-[13rem] backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors duration-300">
                        <FileText
                          size={18}
                          className="text-primary"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-headline text-lg text-neutral-900 dark:text-neutral-100 font-medium tracking-tight truncate">
                          {project.name}
                        </h3>
                        <p className="text-sm text-secondary mt-0.5 font-light line-clamp-2">
                          {project.description || "No description yet"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => void removeProject(project)}
                      className="h-9 w-9 grid place-items-center rounded-xl text-secondary hover:text-red-500 hover:bg-red-50/70 dark:hover:bg-red-500/10 hover-lift active-press transition-all shrink-0 opacity-0 group-hover:opacity-100"
                      aria-label={`Delete ${project.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {project.instructions && (
                    <p className="mt-4 line-clamp-3 text-sm text-secondary font-light border-l-2 border-primary/30 pl-3 italic">
                      {project.instructions}
                    </p>
                  )}

                  <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-secondary bg-white/40 dark:bg-white/[0.06] px-2.5 py-1.5 rounded-lg font-medium">
                      <Hash size={12} />
                      {project.chatCount}{" "}
                      {project.chatCount === 1 ? "chat" : "chats"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditForm(project)}
                        className="px-3.5 py-2 rounded-xl text-sm text-secondary hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-white/45 dark:hover:bg-white/10 hover-lift active-press transition-all font-light"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onStartChat(project)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-[hsl(var(--primary))] text-white font-medium hover-lift active-press hover:brightness-110 transition-all shadow-[0_6px_20px_-4px_hsl(var(--primary)/0.3)]"
                      >
                        <MessageSquarePlus size={15} />
                        Start chat
                        <ChevronRight
                          size={14}
                          className="opacity-60 group-hover:translate-x-0.5 transition-transform"
                        />
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {projects.length === 0 && (
                <div className="md:col-span-2 rounded-[1.75rem] border border-dashed border-primary/25 dark:border-primary/15 p-12 text-center text-secondary backdrop-blur-xl animate-fade-in">
                  <div className="w-14 h-14 rounded-2xl glass-panel mx-auto mb-4 flex items-center justify-center animate-float animate-breathe">
                    <FolderPlus
                      size={24}
                      className="text-primary/60"
                    />
                  </div>
                  <p className="font-headline font-light text-neutral-900 dark:text-neutral-100 mb-1">
                    No projects yet
                  </p>
                  <p className="text-sm font-light">
                    Create your first project to give Kaori focused context.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ═══════════════ MEMORY VIEW ═══════════════ */
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-5 animate-fade-in">
            {/* Add Memory Form */}
            <form
              onSubmit={submitMemory}
              className="settings-glass-pane rounded-[1.75rem] border border-white/45 dark:border-white/10 bg-white/30 dark:bg-white/[0.04] p-5 sm:p-6 h-fit space-y-4 backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] animate-slide-in-left"
            >
              <h2 className="font-headline text-lg text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5 font-light tracking-tight">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Brain size={18} className="text-primary" />
                </div>
                Add a memory
              </h2>
              <p className="text-sm text-secondary font-light">
                Only save information you want Kaori to reuse later.
              </p>
              <textarea
                required
                maxLength={2000}
                rows={5}
                value={memoryText}
                onChange={(e) => setMemoryText(e.target.value)}
                className={`${inputClass} resize-y`}
                placeholder="I prefer concise answers with examples…"
              />
              <input
                maxLength={200}
                value={memoryTags}
                onChange={(e) => setMemoryTags(e.target.value)}
                className={inputClass}
                placeholder="Tags separated by commas"
              />
              <button
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-medium text-white disabled:opacity-50 hover-lift active-press hover:brightness-110 transition-all duration-300 shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.35)]"
              >
                <Plus size={16} />
                {busy ? "Saving…" : "Save memory"}
              </button>
            </form>

            {/* Memory List */}
            <div className="space-y-3 stagger-children">
              {memories.map((memory) => (
                <article
                  key={memory.id}
                  className="settings-glass-card rounded-[1.75rem] border border-white/45 dark:border-white/10 bg-white/30 dark:bg-white/[0.04] p-4 sm:p-5 flex gap-4 backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] group"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors duration-300">
                    <Brain size={17} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap font-light leading-relaxed">
                      {memory.content}
                    </p>
                    {memory.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {memory.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary font-medium tracking-wide"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      await deleteMemory(memory.id);
                      setMemories((items) =>
                        items.filter((item) => item.id !== memory.id)
                      );
                    }}
                    className="h-9 w-9 grid place-items-center rounded-xl text-secondary hover:text-red-500 hover:bg-red-50/70 dark:hover:bg-red-500/10 hover-lift active-press transition-all shrink-0 self-start opacity-0 group-hover:opacity-100"
                    aria-label="Delete memory"
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}

              {memories.length === 0 && (
                <div className="rounded-[1.75rem] border border-dashed border-primary/25 dark:border-primary/15 p-12 text-center text-secondary backdrop-blur-xl animate-fade-in">
                  <div className="w-14 h-14 rounded-2xl glass-panel mx-auto mb-4 flex items-center justify-center animate-float animate-breathe">
                    <Sparkles
                      size={24}
                      className="text-primary/60"
                    />
                  </div>
                  <p className="font-headline font-light text-neutral-900 dark:text-neutral-100 mb-1">
                    No memories yet
                  </p>
                  <p className="text-sm font-light">
                    Kaori will remember what you teach it here.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
