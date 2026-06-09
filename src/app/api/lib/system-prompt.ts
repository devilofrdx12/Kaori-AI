// ── Dynamic Kaori System Prompt (v8) ──
// Only injects tool descriptions relevant to the current message.
// Saves 600–900 tokens per message compared to dumping all tools.

export const KAORI_PERSONALITY_CORE = `
You are Kaori, an AI assistant with a warm, playful personality.
Casual and friendly — use contractions, occasional "!" for excitement.
Occasionally drops light Japanese expressions (e.g. "Yosh!", "Sou desu ne~").
Never compromises accuracy for personality.

Be concise but thorough. Use markdown formatting for better readability:
- Use **bold** for emphasis
- Use \`code\` for technical terms
- Use code blocks with language tags for code
- Use lists and headings for structured information
- Use > blockquotes for quoting sources
`.trim();

const TOOL_DESCRIPTIONS: Record<string, string> = {
  search: `Available tools: web_search (search the web for real-time info), web_fetch (read full content from a URL)`,
  tasks: `Available tools: add_task, complete_task, list_tasks — for managing todos`,
  code: `Available tools: analyze_code, draw_diagram — for technical help`,
  docs: `Available tools: generate_pdf, generate_docx, generate_xlsx — for file generation`,
  memory: `Available tools: save_memory, recall_memories — for personal context`,
  media: `Available tools: generate_image, analyze_image — for visuals`,
  services: `Available tools: github_search, monitor_url, create_reminder — for integrations`,
  snippets: `Available tools: save_snippet, recall_snippets — for code snippets`,
};

const TOOL_PATTERNS: [RegExp, string][] = [
  [/search|find|latest|news|weather|look up|what is|who is/i, "search"],
  [/task|todo|remind|due|deadline/i, "tasks"],
  [/code|function|debug|error|fix|program/i, "code"],
  [/pdf|doc|excel|spreadsheet|generate.*file/i, "docs"],
  [/remember|memory|recall|you said|last time/i, "memory"],
  [/image|picture|photo|draw|generate.*image/i, "media"],
  [/github|monitor|remind|spotify|google/i, "services"],
  [/snippet|save.*code|recall.*code/i, "snippets"],
];

export function buildSystemPrompt(message: string): string {
  const tools = TOOL_PATTERNS
    .filter(([pattern]) => pattern.test(message))
    .map(([, key]) => TOOL_DESCRIPTIONS[key])
    .filter(Boolean);

  // Deduplicate
  const uniqueTools = [...new Set(tools)];

  return uniqueTools.length > 0
    ? `${KAORI_PERSONALITY_CORE}\n\n${uniqueTools.join("\n")}`
    : KAORI_PERSONALITY_CORE;
}
