import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

// Usage guidance:
// ✅ Log: auth events, tool calls, rate limit hits, API errors
// ❌ Never log: message content, passwords, tokens, API keys
