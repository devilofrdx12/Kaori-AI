export type ModelFeatureMode = "auto" | "web" | "deep" | "thinking" | "council";

const DEEP_RESEARCH_MODEL = "gemini-3.8-flash";

/**
 * Normal chat, web search, and reasoning summaries preserve the user's
 * selected model. Deep research is an explicit specialist mode.
 */
export function resolveModelForFeatureMode(
  selectedModel: string,
  featureMode: ModelFeatureMode
): string {
  if (featureMode === "deep") return DEEP_RESEARCH_MODEL;
  return selectedModel;
}
