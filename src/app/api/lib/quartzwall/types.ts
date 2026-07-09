export type QuartzwallVerdict = "SAFE" | "SUSPICIOUS" | "BLOCKED";

export type QuartzwallLayer =
  | "REGEX"
  | "HEURISTIC"
  | "TOOL_POLICY"
  | "TOOL_RESULT";

export type QuartzwallEventType =
  | "INPUT_SCAN"
  | "TOOL_CALL_POLICY"
  | "TOOL_RESULT_SCAN";

export type QuartzwallSignal = {
  layer: QuartzwallLayer;
  label: string;
  weight: number;
  reason: string;
};

export type QuartzwallAttackType =
  | "Instruction Override"
  | "System Prompt Extraction"
  | "Role Hijack"
  | "Safety Bypass"
  | "Secret Exfiltration"
  | "Source Code Extraction"
  | "Fake Role Injection"
  | "Tool Hijack"
  | "Indirect Prompt Injection"
  | "Obfuscated Injection"
  | "Suspicious Instruction Pattern"
  | "No Attack Detected";

export type QuartzwallScanContext =
  | "user_input"
  | "tool_argument"
  | "tool_result";

export type QuartzwallScanResult = {
  verdict: QuartzwallVerdict;
  risk: number;
  attackType: QuartzwallAttackType;
  reason: string;
  signals: QuartzwallSignal[];
  sanitizedText?: string;
};

export type QuartzwallToolPolicyResult = {
  allowed: boolean;
  verdict: QuartzwallVerdict;
  risk: number;
  reason: string;
  signals: QuartzwallSignal[];
};

export type QuartzwallEvent = {
  id: string;
  userId: string;
  type: QuartzwallEventType;
  verdict: QuartzwallVerdict;
  risk: number;
  reason: string;
  toolName?: string | null;
  signals: QuartzwallSignal[];
  metadata?: Record<string, unknown>;
  createdAt: number;
};

export type QuartzwallStats = {
  total: number;
  blocked: number;
  suspicious: number;
  safe: number;
  averageRisk: number;
  last24h: number;
  byType: Record<QuartzwallEventType, number>;
};
