export type KaoriMessage = {
  role: "user" | "assistant";
  content: string | KaoriContentBlock[];
};

export type KaoriContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export type KaoriTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};
