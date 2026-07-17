import type {
  QuartzwallSignal,
  QuartzwallToolPolicyResult,
  QuartzwallVerdict,
} from "./types";
import { scanText } from "./classifier";

const KNOWN_TOOLS = new Set([
  "web_search",
  "web_fetch",
  "open_application",
  "play_spotify",
  "open_youtube",
  "analyze_pdf_visuals",
  "create_document",
]);

const ALLOWED_APP_SCHEMES = new Set([
  "spotify:",
  "notion:",
  "vscode:",
  "obsidian:",
  "slack:",
  "discord:",
  "mailto:",
  "zoommtg:",
  "ms-teams:",
]);

const APP_FALLBACK_HOSTS: Record<string, string[]> = {
  "spotify:": ["open.spotify.com", "spotify.com"],
  "notion:": ["notion.so"],
  "vscode:": ["vscode.dev", "marketplace.visualstudio.com"],
  "obsidian:": ["obsidian.md"],
  "slack:": ["slack.com"],
  "discord:": ["discord.com", "discord.gg"],
  "mailto:": ["mail.google.com", "outlook.office.com", "outlook.live.com"],
  "zoommtg:": ["zoom.us"],
  "ms-teams:": ["teams.microsoft.com", "teams.live.com"],
};

const DOCUMENT_FORMATS = new Set([
  "pdf",
  "docx",
  "md",
  "html",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
  "json",
]);
const MAX_DOCUMENT_CONTENT_CHARS = 240_000;

const BLOCKED_APP_SCHEMES = new Set([
  "about:",
  "blob:",
  "chrome:",
  "chrome-extension:",
  "data:",
  "devtools:",
  "edge:",
  "file:",
  "filesystem:",
  "ftp:",
  "http:",
  "https:",
  "javascript:",
  "powershell:",
  "ssh:",
  "vbscript:",
]);

const SENSITIVE_CONTENT_PATTERN =
  /\b(api[_ -]?key|secret|password|token|credential|private key|recovery phrase|credit card|ssn|social security|\.env)\b/i;

const ABUSIVE_SEARCH_PATTERN =
  /\b(credit card numbers?|password dump|leaked credentials?|api[_ -]?keys?|private keys?|site:pastebin\.com|site:ghostbin|dork|dump)\b/i;

const BLOCKED_FETCH_DOMAINS = [
  "pastebin.com",
  "ghostbin.co",
  "hastebin.com",
  "0bin.net",
  "evil.com",
  "attacker.io",
];

function signal(label: string, weight: number, reason: string): QuartzwallSignal {
  return { layer: "TOOL_POLICY", label, weight, reason };
}

function result(
  allowed: boolean,
  risk: number,
  reason: string,
  signals: QuartzwallSignal[] = []
): QuartzwallToolPolicyResult {
  let verdict: QuartzwallVerdict = "SAFE";
  if (!allowed || risk >= 70) verdict = "BLOCKED";
  else if (risk >= 40) verdict = "SUSPICIOUS";

  return { allowed: allowed && verdict !== "BLOCKED", verdict, risk, reason, signals };
}


function userAskedForDocument(userMessage: string) {
  return /\b(create|make|generate|write|export|download|save)\b[\s\S]{0,100}\b(document|file|pdf|docx|markdown|md|report|essay|notes|html|css|javascript|typescript|json)\b/i.test(
    userMessage
  );
}

function userAskedToOpenApp(userMessage: string) {
  return /\b(open|launch|start)\b[\s\S]{0,100}\b(app|application|spotify|notion|vscode|visual studio code|obsidian|slack|discord|zoom|teams|email|mail)\b/i.test(
    userMessage
  );
}

function userAskedToPlaySpotify(userMessage: string) {
  return /\b(play|listen to|put on)\b[\s\S]{0,100}\b(song|music|track|album|playlist|spotify)\b/i.test(
    userMessage
  );
}

function userAskedToOpenYouTube(userMessage: string) {
  return /\b(open|launch|play|watch|search)\b[\s\S]{0,100}\b(youtube|video)\b/i.test(
    userMessage
  );
}

function domainIsBlocked(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return BLOCKED_FETCH_DOMAINS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`)
  );
}

function validateWebUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) {
    return result(false, 90, "URL is missing or too long", [
      signal("invalid-url", 90, "URL is missing or too long"),
    ]);
  }

  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return result(false, 90, "Only http and https URLs are allowed", [
        signal("blocked-protocol", 90, "Only http and https URLs are allowed"),
      ]);
    }
    if (url.username || url.password) {
      return result(false, 85, "URLs with embedded credentials are blocked", [
        signal("url-credentials", 85, "URL embeds credentials"),
      ]);
    }
    if (domainIsBlocked(url.hostname)) {
      return result(false, 80, "Domain is blocked by QUARTZWALL policy", [
        signal("blocked-domain", 80, "Domain is blocked by policy"),
      ]);
    }
  } catch {
    return result(false, 90, "Invalid URL", [signal("invalid-url", 90, "Invalid URL")]);
  }

  return null;
}

function isAllowedFallbackHost(hostname: string, allowedHosts: string[]) {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return allowedHosts.some(
    (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`)
  );
}

function validateAppFallback(value: unknown, protocol: string) {
  if (typeof value !== "string" || value.length > 2048) {
    return result(false, 85, "Application fallback URL is missing or too long", [
      signal("invalid-app-fallback", 85, "Application fallback URL is missing or too long"),
    ]);
  }

  try {
    const fallback = new URL(value);
    const allowedHosts = APP_FALLBACK_HOSTS[protocol] || [];
    if (
      fallback.protocol !== "https:" ||
      fallback.username ||
      fallback.password ||
      !isAllowedFallbackHost(fallback.hostname, allowedHosts)
    ) {
      return result(false, 85, "Application fallback URL is not approved for this app", [
        signal("blocked-app-fallback", 85, "Fallback URL is not approved for the app protocol"),
      ]);
    }
  } catch {
    return result(false, 85, "Invalid application fallback URL", [
      signal("invalid-app-fallback", 85, "Application fallback URL is invalid"),
    ]);
  }

  return null;
}

export function validateToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  userMessage = ""
): QuartzwallToolPolicyResult {
  if (!KNOWN_TOOLS.has(toolName)) {
    return result(false, 95, `Unknown tool blocked: ${toolName}`, [
      signal("unknown-tool", 95, "Unknown tool blocked"),
    ]);
  }

  const argScan = scanText(toolInput, "tool_argument");
  if (argScan.verdict === "BLOCKED") {
    return result(false, Math.max(75, argScan.risk), argScan.reason, argScan.signals);
  }

  if (toolName === "web_search") {
    const query = String(toolInput.query || "");
    if (!query.trim()) {
      return result(false, 70, "Search query is empty", [
        signal("empty-query", 70, "Search query is empty"),
      ]);
    }
    if (ABUSIVE_SEARCH_PATTERN.test(query)) {
      return result(false, 85, "Search query looks like credential or data-harvesting abuse", [
        signal("abusive-search", 85, "Query targets leaked credentials or sensitive data"),
      ]);
    }
  }

  if (toolName === "web_fetch") {
    const urlPolicy = validateWebUrl(toolInput.url);
    if (urlPolicy) return urlPolicy;
  }

  if (toolName === "open_application") {
    if (!userAskedToOpenApp(userMessage)) {
      return result(false, 72, "Opening apps requires explicit user intent", [
        signal("missing-user-intent", 72, "Opening apps requires explicit user intent"),
      ]);
    }

    const rawScheme = String(toolInput.uriScheme || "");
    try {
      const uri = new URL(rawScheme);
      const protocol = uri.protocol.toLowerCase();
      if (BLOCKED_APP_SCHEMES.has(protocol) || !ALLOWED_APP_SCHEMES.has(protocol)) {
        return result(false, 88, "URI scheme is not allowed", [
          signal("blocked-uri-scheme", 88, "URI scheme is not allowed"),
        ]);
      }

      const fallbackPolicy = validateAppFallback(toolInput.fallbackUrl, protocol);
      if (fallbackPolicy) return fallbackPolicy;
    } catch {
      return result(false, 80, "Invalid application URI", [
        signal("invalid-app-uri", 80, "Invalid application URI"),
      ]);
    }
  }

  if (toolName === "play_spotify" && !userAskedToPlaySpotify(userMessage)) {
    return result(false, 72, "Playing music requires explicit user intent", [
      signal("missing-user-intent", 72, "Playing music requires explicit user intent"),
    ]);
  }

  if (toolName === "open_youtube" && !userAskedToOpenYouTube(userMessage)) {
    return result(false, 72, "Opening YouTube requires explicit user intent", [
      signal("missing-user-intent", 72, "Opening YouTube requires explicit user intent"),
    ]);
  }

  if (toolName === "create_document") {
    const content = String(toolInput.content || "");
    const filename = String(toolInput.filename || "");
    const format = String(toolInput.format || "").toLowerCase();

    let docRisk = argScan.risk;
    const docSignals = [...argScan.signals];
    let docReason = argScan.reason;

    if (!userAskedForDocument(userMessage)) {
      docRisk = Math.max(docRisk, 45);
      docSignals.push(signal("missing-user-intent", 45, "Document creation may lack explicit user intent"));
      if (docReason === "Clean") docReason = "Document creation without explicit user intent";
    }

    if (!DOCUMENT_FORMATS.has(format)) {
      return result(false, 80, "Document format is not allowed", [
        signal("blocked-document-format", 80, "Document format is not allowed"),
      ]);
    }

    if (!new RegExp(`^[\\w .()-]{1,120}\\.${format}$`, "i").test(filename)) {
      return result(false, 75, "Document filename is unsafe", [
        signal("unsafe-filename", 75, "Document filename is unsafe"),
      ]);
    }

    if (!content.trim() || content.length > MAX_DOCUMENT_CONTENT_CHARS) {
      return result(false, 78, "Document content is empty or too large", [
        signal("invalid-document-content", 78, "Document content is empty or exceeds the allowed size"),
      ]);
    }

    if (SENSITIVE_CONTENT_PATTERN.test(content)) {
      return result(false, 86, "Document content appears to contain sensitive data", [
        signal("sensitive-document-content", 86, "Document content appears sensitive"),
      ]);
    }

    return result(true, docRisk, docReason, docSignals);
  }

  return result(true, argScan.risk, argScan.reason, argScan.signals);
}
