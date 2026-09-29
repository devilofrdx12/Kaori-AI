"use client";

import { ShieldCheck, X, Smartphone, Monitor } from "lucide-react";
import { useState } from "react";

export type ActionProposal = {
  id: string;
  appName: string;
  uriScheme: string;
  fallbackUrl: string;
  /** Optional context like song name or video title */
  detail?: string;
};

// ─── App Deep Link Registry ────────────────────────────────────────
// Maps allowed URI schemes to their valid HTTPS fallback hosts.
// Only schemes in this registry can be launched via Action Passport.

type AppEntry = {
  label: string;
  fallbackHosts: string[];
};

const APP_REGISTRY: Record<string, AppEntry> = {
  // Music & Media
  "spotify:":      { label: "Spotify",        fallbackHosts: ["open.spotify.com", "spotify.com"] },
  "youtube:":      { label: "YouTube",        fallbackHosts: ["www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"] },
  "music:":        { label: "Apple Music",    fallbackHosts: ["music.apple.com"] },
  "soundcloud:":   { label: "SoundCloud",     fallbackHosts: ["soundcloud.com"] },

  // Communication
  "mailto:":       { label: "Email",          fallbackHosts: ["mail.google.com", "outlook.office.com", "outlook.live.com"] },
  "whatsapp:":     { label: "WhatsApp",       fallbackHosts: ["web.whatsapp.com", "whatsapp.com", "wa.me", "api.whatsapp.com"] },
  "tg:":           { label: "Telegram",       fallbackHosts: ["t.me", "web.telegram.org", "telegram.org"] },
  "slack:":        { label: "Slack",          fallbackHosts: ["slack.com", "app.slack.com"] },
  "discord:":      { label: "Discord",        fallbackHosts: ["discord.com", "discord.gg"] },
  "ms-teams:":     { label: "Microsoft Teams",fallbackHosts: ["teams.microsoft.com", "teams.live.com"] },
  "zoommtg:":      { label: "Zoom",           fallbackHosts: ["zoom.us"] },
  "skype:":        { label: "Skype",          fallbackHosts: ["join.skype.com", "web.skype.com"] },

  // Productivity
  "notion:":       { label: "Notion",         fallbackHosts: ["notion.so", "www.notion.so"] },
  "obsidian:":     { label: "Obsidian",       fallbackHosts: ["obsidian.md"] },
  "todoist:":      { label: "Todoist",        fallbackHosts: ["todoist.com", "app.todoist.com"] },
  "linear:":       { label: "Linear",         fallbackHosts: ["linear.app"] },
  "clickup:":      { label: "ClickUp",        fallbackHosts: ["app.clickup.com", "clickup.com"] },
  "trello:":       { label: "Trello",         fallbackHosts: ["trello.com"] },
  "asana:":        { label: "Asana",          fallbackHosts: ["app.asana.com", "asana.com"] },

  // Dev Tools
  "vscode:":       { label: "VS Code",        fallbackHosts: ["vscode.dev", "marketplace.visualstudio.com"] },
  "cursor:":       { label: "Cursor",         fallbackHosts: ["cursor.com", "www.cursor.com"] },
  "github:":       { label: "GitHub",         fallbackHosts: ["github.com"] },
  "figma:":        { label: "Figma",          fallbackHosts: ["figma.com", "www.figma.com"] },

  // Cloud & Storage
  "googledrive:":  { label: "Google Drive",   fallbackHosts: ["drive.google.com"] },
  "dropbox:":      { label: "Dropbox",        fallbackHosts: ["dropbox.com", "www.dropbox.com"] },

  // Maps & Navigation
  "maps:":         { label: "Maps",           fallbackHosts: ["maps.google.com", "www.google.com"] },
  "waze:":         { label: "Waze",           fallbackHosts: ["waze.com", "www.waze.com"] },

  // Social
  "instagram:":    { label: "Instagram",      fallbackHosts: ["instagram.com", "www.instagram.com"] },
  "twitter:":      { label: "X (Twitter)",    fallbackHosts: ["x.com", "twitter.com"] },
  "reddit:":       { label: "Reddit",         fallbackHosts: ["reddit.com", "www.reddit.com", "old.reddit.com"] },
  "linkedin:":     { label: "LinkedIn",       fallbackHosts: ["linkedin.com", "www.linkedin.com"] },
  "fb:":           { label: "Facebook",       fallbackHosts: ["facebook.com", "www.facebook.com", "m.facebook.com"] },
  "snapchat:":     { label: "Snapchat",       fallbackHosts: ["snapchat.com", "www.snapchat.com"] },
  "tiktok:":       { label: "TikTok",         fallbackHosts: ["tiktok.com", "www.tiktok.com"] },

  // E-commerce & Finance
  "amazon:":       { label: "Amazon",         fallbackHosts: ["amazon.com", "www.amazon.com", "amazon.in", "www.amazon.in"] },
  "paypal:":       { label: "PayPal",         fallbackHosts: ["paypal.com", "www.paypal.com"] },
};

function isAllowedFallbackHost(hostname: string, allowedHosts: string[]) {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return allowedHosts.some(
    (allowed) => {
      const normalizedAllowed = allowed.replace(/^www\./, "");
      return normalized === normalizedAllowed || normalized.endsWith(`.${normalizedAllowed}`);
    }
  );
}

function getVerifiedAction(action: ActionProposal) {
  try {
    const rawScheme = action.uriScheme.includes(":") ? action.uriScheme : action.uriScheme + "://";
    const uri = new URL(rawScheme);
    
    const rawFallback = /^https?:\/\//i.test(action.fallbackUrl) ? action.fallbackUrl : "https://" + action.fallbackUrl;
    const fallback = new URL(rawFallback);
    
    const protocol = uri.protocol.toLowerCase();
    const appEntry = APP_REGISTRY[protocol];

    if (
      !appEntry ||
      fallback.protocol !== "https:" ||
      fallback.username ||
      fallback.password ||
      !isAllowedFallbackHost(fallback.hostname, appEntry.fallbackHosts)
    ) {
      return null;
    }

    return { uri: uri.toString(), fallback: fallback.toString(), protocol, label: appEntry.label };
  } catch {
    return null;
  }
}

/** Attempt to open a native app via URI scheme, with a timed fallback to HTTPS. */
function smartLaunch(nativeUri: string, fallbackUrl: string) {
  // On mobile browsers, setting location.href to a custom URI scheme
  // will either open the app or silently fail. We set a fallback timer
  // that opens the web URL if the app didn't handle it.
  const start = Date.now();
  const fallbackDelay = 1500; // ms to wait before assuming app isn't installed

  const timer = setTimeout(() => {
    // If the page is still visible after the delay, the native app
    // didn't launch — fall back to the web URL.
    if (document.visibilityState !== "hidden" && Date.now() - start >= fallbackDelay - 100) {
      const opened = window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      if (opened) opened.opener = null;
    }
  }, fallbackDelay);

  // Listen for the page becoming hidden (app opened successfully)
  const cleanup = () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") cleanup();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Try the native URI scheme
  const a = document.createElement("a");
  a.href = nativeUri;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
    smartLaunch(verifiedAction.uri, verifiedAction.fallback);
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
              {action.detail && (
                <p className="mt-0.5 text-xs text-secondary truncate max-w-[280px]">
                  {action.detail}
                </p>
              )}
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
            Kaori verified the requested app protocol. This will try to open the native app first — if it&apos;s not installed, it&apos;ll open in your browser instead.
          </p>

          <div className="mt-2 rounded-lg border border-black/5 bg-white/55 px-2.5 py-2 font-mono text-[11px] text-secondary dark:border-white/10 dark:bg-black/20">
            {verifiedAction
              ? `${verifiedAction.protocol} → ${verifiedAction.label} verified`
              : "Action verification failed"}
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Smartphone size={13} />
              {status === "opening" ? "Opening…" : "Open app"}
            </button>
            <button
              type="button"
              onClick={openFallback}
              disabled={!verifiedAction}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <Monitor size={13} />
              Open in browser
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
