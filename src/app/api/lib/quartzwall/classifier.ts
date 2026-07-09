import type {
  QuartzwallScanContext,
  QuartzwallScanResult,
  QuartzwallSignal,
  QuartzwallAttackType,
} from "./types";

type PatternRule = {
  label: string;
  pattern: RegExp;
  weight: number;
  reason: string;
  hardBlock?: boolean;
};

const CONTROL_PLANE_PATTERNS: PatternRule[] = [
  {
    label: "ignore-instructions",
    pattern: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|system|developer)?\s*instructions?\b/i,
    weight: 45,
    reason: "Attempts to override existing instructions",
    hardBlock: true,
  },
  {
    label: "system-prompt-exfiltration",
    pattern: /\b(reveal|print|show|dump|display|repeat)\b[\s\S]{0,80}\b(system prompt|developer message|hidden instructions|initial instructions)\b/i,
    weight: 50,
    reason: "Attempts to reveal protected control-plane instructions",
    hardBlock: true,
  },
  {
    label: "role-reassignment",
    pattern: /\b(you are now|act as|roleplay as|pretend to be)\b[\s\S]{0,80}\b(unrestricted|jailbroken|developer mode|dan|no restrictions|no safety)\b/i,
    weight: 40,
    reason: "Attempts to reassign the assistant into an unsafe role",
    hardBlock: true,
  },
  {
    label: "safety-bypass",
    pattern: /\b(bypass|disable|override|turn off|remove)\b[\s\S]{0,80}\b(safety|guardrail|filter|policy|firewall|quartzwall)\b/i,
    weight: 45,
    reason: "Attempts to bypass safety controls",
    hardBlock: true,
  },
  {
    label: "secret-exfiltration",
    pattern: /\b(api[_ -]?key|secret|password|token|credential|\.env|database schema|sql dump|private key)\b/i,
    weight: 35,
    reason: "References sensitive secrets or internal data",
  },
  {
    label: "source-code-exfiltration",
    pattern: /\b(cat|read|print|show|dump|display)\b[\s\S]{0,80}\b(src\/|source code|backend code|server file|route\.ts|\.env)\b/i,
    weight: 40,
    reason: "Attempts to read internal source or server files",
  },
  {
    label: "fake-role-marker",
    pattern: /(^|\n)\s*(system|developer|admin|root|security|policy)\s*:/i,
    weight: 24,
    reason: "Contains fake control-plane role markers",
  },
  {
    label: "tool-hijack",
    pattern: /\b(use|call|execute|run)\b[\s\S]{0,80}\btool\b[\s\S]{0,80}\b(without asking|silently|secretly|do not tell|hide it)\b/i,
    weight: 34,
    reason: "Attempts to secretly steer tool execution",
  },
];

const INDIRECT_INJECTION_PATTERNS: PatternRule[] = [
  {
    label: "html-comment-injection",
    pattern: /<!--[\s\S]{0,600}\b(ignore|disregard|override|reveal|exfiltrate|send|create document)\b[\s\S]{0,600}-->/i,
    weight: 60,
    reason: "Hidden HTML comment contains agent-control instructions",
    hardBlock: true,
  },
  {
    label: "external-data-role-marker",
    pattern: /\b(system|developer|admin)\s*:\s*(ignore|override|reveal|exfiltrate|send|call|create)\b/i,
    weight: 50,
    reason: "External content includes fake role instructions",
    hardBlock: true,
  },
  {
    label: "external-agent-command",
    pattern: /\b(to the ai|assistant|agent|llm|model)\b[\s\S]{0,120}\b(ignore|override|reveal|exfiltrate|send|open|call)\b/i,
    weight: 48,
    reason: "External content tries to command the AI agent",
    hardBlock: true,
  },
];

const IMPERATIVE_VERBS = [
  "ignore",
  "override",
  "disable",
  "reveal",
  "bypass",
  "dump",
  "exfiltrate",
  "send",
  "forward",
  "delete",
  "execute",
  "run",
  "install",
  "download",
  "open",
  "create",
];

const ZERO_WIDTH_PATTERN = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/;
const BASE64ISH_PATTERN = /\b[A-Za-z0-9+/]{48,}={0,2}\b/;
const HOMOGLYPH_PATTERN = /[а-яА-ЯɑɡορΑΒΕΖΗΙΚΜΝΟΡΤΧΥ]/;

function clampRisk(risk: number) {
  return Math.max(0, Math.min(100, Math.round(risk)));
}

function addSignal(
  signals: QuartzwallSignal[],
  label: string,
  weight: number,
  reason: string,
  layer: QuartzwallSignal["layer"] = "HEURISTIC"
) {
  signals.push({ label, weight, reason, layer });
}

function scoreRegexRules(
  text: string,
  rules: PatternRule[],
  signals: QuartzwallSignal[]
) {
  let risk = 0;
  let hardBlock = false;

  for (const rule of rules) {
    if (!rule.pattern.test(text)) continue;
    risk += rule.weight;
    hardBlock = hardBlock || rule.hardBlock === true;
    addSignal(signals, rule.label, rule.weight, rule.reason, "REGEX");
  }

  return { risk, hardBlock };
}

function scoreHeuristics(text: string, context: QuartzwallScanContext, signals: QuartzwallSignal[]) {
  let risk = 0;
  const lower = text.toLowerCase();
  const words = lower.match(/\b[a-z][a-z_-]{2,}\b/g) || [];
  const imperativeCount = words.filter((word) => IMPERATIVE_VERBS.includes(word)).length;
  const imperativeDensity = words.length ? imperativeCount / words.length : 0;

  if (ZERO_WIDTH_PATTERN.test(text)) {
    risk += 28;
    addSignal(signals, "invisible-characters", 28, "Contains invisible control characters");
  }

  if (HOMOGLYPH_PATTERN.test(text)) {
    risk += 20;
    addSignal(signals, "unicode-homoglyphs", 20, "Contains mixed-script homoglyph characters");
  }

  if (BASE64ISH_PATTERN.test(text)) {
    risk += 16;
    addSignal(signals, "encoded-blob", 16, "Contains long encoded-looking text");
  }

  if (imperativeDensity > 0.18 && imperativeCount >= 3) {
    risk += 22;
    addSignal(signals, "imperative-density", 22, "High density of command-style verbs");
  }

  if ((text.match(/[>#`]{3,}/g) || []).length >= 2) {
    risk += 10;
    addSignal(signals, "instruction-markers", 10, "Contains repeated instruction-like formatting markers");
  }

  if (context === "tool_result" && /\bignore\b|\boverride\b|\bsystem prompt\b/i.test(text)) {
    risk += 18;
    addSignal(signals, "untrusted-control-language", 18, "Untrusted tool output contains control-plane language");
  }

  return risk;
}

function buildReason(signals: QuartzwallSignal[]) {
  if (signals.length === 0) return "No prompt-injection indicators detected";

  return signals
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((signal) => signal.reason)
    .join("; ");
}

function classifyAttack(signals: QuartzwallSignal[]): QuartzwallAttackType {
  const labels = new Set(signals.map((signal) => signal.label));

  if (labels.has("system-prompt-exfiltration")) return "System Prompt Extraction";
  if (labels.has("ignore-instructions")) return "Instruction Override";
  if (labels.has("role-reassignment")) return "Role Hijack";
  if (labels.has("safety-bypass")) return "Safety Bypass";
  if (labels.has("secret-exfiltration")) return "Secret Exfiltration";
  if (labels.has("source-code-exfiltration")) return "Source Code Extraction";
  if (labels.has("fake-role-marker") || labels.has("external-data-role-marker")) return "Fake Role Injection";
  if (labels.has("tool-hijack")) return "Tool Hijack";
  if (labels.has("html-comment-injection") || labels.has("external-agent-command")) return "Indirect Prompt Injection";
  if (
    labels.has("invisible-characters") ||
    labels.has("unicode-homoglyphs") ||
    labels.has("encoded-blob")
  ) {
    return "Obfuscated Injection";
  }
  if (signals.length > 0) return "Suspicious Instruction Pattern";
  return "No Attack Detected";
}

export function scanText(
  input: unknown,
  context: QuartzwallScanContext = "user_input"
): QuartzwallScanResult {
  const text = typeof input === "string" ? input : JSON.stringify(input ?? "");
  const normalized = text.normalize("NFKC");
  const signals: QuartzwallSignal[] = [];
  const direct = scoreRegexRules(normalized, CONTROL_PLANE_PATTERNS, signals);
  const indirect =
    context === "tool_result"
      ? scoreRegexRules(normalized, INDIRECT_INJECTION_PATTERNS, signals)
      : { risk: 0, hardBlock: false };
  const heuristicRisk = scoreHeuristics(normalized, context, signals);

  const risk = clampRisk(direct.risk + indirect.risk + heuristicRisk);
  const hardBlock = direct.hardBlock || indirect.hardBlock;
  const verdict = hardBlock || risk >= 70 ? "BLOCKED" : risk >= 40 ? "SUSPICIOUS" : "SAFE";
  const reason = buildReason(signals);
  const attackType = classifyAttack(signals);

  return {
    verdict,
    risk,
    attackType,
    reason,
    signals,
    sanitizedText:
      context === "tool_result" && verdict === "BLOCKED"
        ? sanitizeToolResult(normalized)
        : undefined,
  };
}

export function sanitizeToolResult(result: string) {
  return result
    .replace(/<!--[\s\S]*?-->/g, "[QUARTZWALL removed hidden instructions]")
    .replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|system|developer)?\s*instructions?\b[\s\S]{0,220}/gi, "[QUARTZWALL removed instruction override]")
    .replace(/\b(reveal|print|show|dump|display|repeat)\b[\s\S]{0,100}\b(system prompt|developer message|hidden instructions|initial instructions)\b[\s\S]{0,180}/gi, "[QUARTZWALL removed control-plane extraction attempt]")
    .replace(/\b(bypass|disable|override|turn off|remove)\b[\s\S]{0,100}\b(safety|guardrail|filter|policy|firewall|quartzwall)\b[\s\S]{0,180}/gi, "[QUARTZWALL removed safety bypass instruction]")
    .replace(/(^|\n)\s*(system|developer|admin)\s*:[^\n]*/gi, "$1[QUARTZWALL removed fake role instruction]")
    .replace(/\b(to the ai|assistant|agent|llm|model)\b[\s\S]{0,240}\b(ignore|override|reveal|exfiltrate|send|open|call)\b[\s\S]{0,240}/gi, "[QUARTZWALL removed indirect prompt injection]");
}

export function detectInjection(message: string): boolean {
  return scanText(message).verdict === "BLOCKED";
}
