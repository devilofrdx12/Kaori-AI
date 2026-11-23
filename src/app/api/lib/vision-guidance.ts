/**
 * Vision Task Guidance Module
 * Provides structured prompts and protocol directions based on the user's intent.
 */

export function buildVisionGuidance(message: string): string {
  const trimmed = message.trim();

  // Tier 1: Real-time price, current news, buying options, or external verification explicitly requested
  if (/\b(?:price|cost|how much|buy|where to buy|stock|current news|release date|verify|source link)\b/i.test(trimmed)) {
    return [
      "Vision Task (Grounded External Verification):",
      "1. Inspect the image for any exact brand name, model number, serial code, publication, or distinctive text.",
      "2. Call web_search using those EXACT grounded textual anchors (e.g. 'Sony WH-1000XM5 price' or 'ISBN 9780143127741').",
      "3. Do NOT search vague subjective visual descriptions (like 'black headphones' or 'modern room'). If no model identifier is legible, state that exact pricing/availability requires a visible model code.",
      "4. Synthesize the verified web information with your direct visual observations.",
    ].join("\n");
  }

  // Tier 2: OCR, Document, Code, Receipt, Invoice, or Error Screen
  if (/\b(?:read|text|ocr|document|receipt|invoice|bill|code|terminal|stack trace|error|translate)\b/i.test(trimmed)) {
    return [
      "Vision Task (Document / Code / OCR):",
      "1. Transcribe visible text, code, numbers, and layout faithfully directly from the image.",
      "2. Answer the user's questions directly using direct visual inspection without web search.",
      "3. If an error message or code problem is shown and the fix requires current external documentation, call web_search with the exact transcribed error string.",
    ].join("\n");
  }

  // Tier 3: Math, Equations, Diagrams, Charts, or Technical Graphs
  if (/\b(?:solve|math|equation|calculate|chart|graph|plot|axis|legend|table|diagram|schematic)\b/i.test(trimmed)) {
    return [
      "Vision Task (Technical / Analytical):",
      "1. Identify the formulas, axes, units, legends, and visible values directly from the image.",
      "2. Provide step-by-step reasoning and solution directly from your visual tokens. Do not invent unreadable values.",
      "3. Do not perform web searches unless current external reference tables or live constants are specifically requested.",
    ].join("\n");
  }

  // Tier 4: Comparison
  if (/\b(?:compare|difference|both images|these images)\b/i.test(trimmed)) {
    return [
      "Vision Task (Visual Comparison):",
      "1. Analyze each image systematically, listing clear direct observations.",
      "2. Compare and contrast specific visual elements, layout, colors, and features directly.",
      "3. Only use web_search if comparing specific real-world products or external historical facts.",
    ].join("\n");
  }

  // Tier 5: General Vision Observation / Analysis / Critique / Identification
  return [
    "Vision Task (Direct Observation & Entity Recognition):",
    "1. Directly inspect the image: recognize landmarks, architecture, artwork, plants, animals, objects, or style using your native multimodal vision capabilities.",
    "2. Provide a thorough, insightful, and helpful answer directly from your visual observations.",
    "3. Only call web_search if the user specifically asked for recent events or external information that cannot be determined from visual observation alone.",
  ].join("\n");
}
