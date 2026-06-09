// ── Prompt Injection Detection (v8) ──
// Pattern-based detection checked before every AI call.

const INJECTION_PATTERNS = [
  /ignore (all |previous )?instructions/i,
  /you are now/i,
  /reveal.*system prompt/i,
  /print all users/i,
  /jailbreak/i,
  /DAN mode/i,
  /pretend you have no restrictions/i,
  /disregard.*above/i,
  /forget.*rules/i,
  /override.*safety/i,
  /act as.*unrestricted/i,
  /bypass.*filter/i,
];

/**
 * Returns true if the message appears to contain a prompt injection attempt.
 */
export function detectInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(message));
}
