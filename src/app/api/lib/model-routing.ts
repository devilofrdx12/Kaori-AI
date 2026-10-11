export type ModelFeatureMode = "auto" | "web" | "deep" | "thinking";

const DEEP_RESEARCH_MODEL = "gemini-3.8-flash";
const THINKING_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";

/**
 * Normal chat and web search preserve the user's selected model. Deep and
 * Thinking are explicit specialist modes, so they may deliberately route to
 * their advertised models.
 */
export function resolveModelForFeatureMode(
  selectedModel: string,
  featureMode: ModelFeatureMode
): string {
  if (featureMode === "deep") return DEEP_RESEARCH_MODEL;
  if (featureMode === "thinking") return THINKING_MODEL;
  return selectedModel;
}
