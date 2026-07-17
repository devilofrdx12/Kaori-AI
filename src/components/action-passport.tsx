"use client";

import { ExternalLink, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

export type ActionProposal = {
  id: string;
  appName: string;
  uriScheme: string;
  fallbackUrl: string;
};

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

function isAllowedFallbackHost(hostname: string, allowedHosts: string[]) {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return allowedHosts.some(
    (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`)
  );
}

function getVerifiedAction(action: ActionProposal) {
  try {
    const uri = new URL(action.uriScheme);
    const fallback = new URL(action.fallbackUrl);
    const protocol = uri.protocol.toLowerCase();
    const allowedHosts = APP_FALLBACK_HOSTS[protocol] || [];

    if (
      !ALLOWED_APP_SCHEMES.has(protocol) ||
      fallback.protocol !== "https:" ||
      fallback.username ||
      fallback.password ||
      !isAllowedFallbackHost(fallback.hostname, allowedHosts)
    ) {
      return null;
    }

    return { uri: uri.toString(), fallback: fallback.toString(), protocol };
  } catch {
    return null;
  }
}

export default function ActionPassport({
  action,
  onDismiss,
}: {
  action: ActionProposal;
  onDismiss: (id: string) => void;
}) {
  const [status, setStatus] = useState<"ready" | "opening" | "invalid">("ready");
  const verifiedAction = getVerifiedAction(action);

  const launchApp = () => {
    if (!verifiedAction) {
      setStatus("invalid");
      return;
    }

    setStatus("opening");
    window.location.assign(verifiedAction.uri);
  };

  const openFallback = () => {
    if (!verifiedAction) {
      setStatus("invalid");
      return;
    }

    const opened = window.open(verifiedAction.fallback, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  };

  return (
    <section className="mx-auto mb-3 w-full max-w-3xl rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5 shadow-sm backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                Action Passport
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-on-surface">
                Open {action.appName}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(action.id)}
              aria-label="Dismiss action request"
              className="rounded-lg p-1 text-secondary transition-colors hover:bg-black/5 hover:text-on-surface dark:hover:bg-white/10"
            >
              <X size={15} />
            </button>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-secondary">
            Kaori verified the requested app protocol, but this device action will only run after your approval. No private chat data is sent by this card.
          </p>

          <div className="mt-2 rounded-lg border border-black/5 bg-white/55 px-2.5 py-2 font-mono text-[11px] text-secondary dark:border-white/10 dark:bg-black/20">
            {verifiedAction ? `${verifiedAction.protocol} verified` : "Action verification failed"}
          </div>

          {status === "invalid" && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              This action failed local verification and was not opened.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={launchApp}
              disabled={!verifiedAction || status === "opening"}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "opening" ? "Opening app…" : "Approve & open app"}
            </button>
            <button
              type="button"
              onClick={openFallback}
              disabled={!verifiedAction}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <ExternalLink size={13} />
              Open web fallback
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
