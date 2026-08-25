export type ModelFeatureMode = "auto" | "web" | "deep" | "thinking";

const DEEP_RESEARCH_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
const THINKING_MODEL = "nvidia/llama-3.1-nemotron-70b-instruct";

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
