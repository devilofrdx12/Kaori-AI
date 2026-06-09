import { AnthropicTool } from "@/app/api/lib/anthropic";

export const TOOL_DEFINITIONS: AnthropicTool[] = [
  {
    name: "web_search",
    description:
      "Search the web for real-time information. Use this when the user asks about current events, recent news, live data, or anything that may have changed after your training cutoff. Returns search results with titles, URLs, and snippets.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to look up on the web",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description:
      "Fetch and read the content of a specific webpage URL. Use this when the user provides a URL and wants you to read, summarize, or analyze its content. Returns the text content of the page.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The full URL to fetch content from",
        },
      },
      required: ["url"],
    },
  },
];

export function getToolByName(name: string) {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}
