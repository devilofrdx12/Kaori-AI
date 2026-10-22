/** A single message in a Kaori conversation. */
export type KaoriMessage = {
  role: "user" | "assistant";
  content: string | KaoriContentBlock[];
};

/** Discriminated union of content block types within a message. */
export type KaoriContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string; detail?: "fast" | "balanced" | "high" } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown>; extra_content?: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

/** Schema definition for a tool available to the Kaori assistant. */
export type KaoriTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};
