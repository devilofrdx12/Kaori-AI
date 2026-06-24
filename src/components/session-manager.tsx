"use client";

import { useState, useEffect, useCallback } from "react";
import { Monitor, Smartphone, Globe, Trash2, Loader2, Shield } from "lucide-react";

type Session = {
  id: string;
  userAgent: string;
  ip: string;
  createdAt: number;
  expiresAt: number;
  isCurrent: boolean;
};

const AJAX_HEADERS: HeadersInit = {
  "X-Requested-With": "XMLHttpRequest",
};

function parseUserAgent(ua: string): { device: string; browser: string; icon: typeof Monitor } {
  const lower = ua.toLowerCase();

  let device = "Unknown device";
  let browser = "Unknown browser";
  let icon: typeof Monitor = Globe;

  // Detect device
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
    device = "Mobile";
    icon = Smartphone;
  } else {
    device = "Desktop";
    icon = Monitor;
  }

  // Detect OS
  if (lower.includes("windows")) device += " - Windows";
  else if (lower.includes("mac")) device += " - macOS";
  else if (lower.includes("linux")) device += " - Linux";
  else if (lower.includes("android")) device += " - Android";
  else if (lower.includes("iphone") || lower.includes("ipad")) device += " - iOS";

  // Detect browser
  if (lower.includes("chrome") && !lower.includes("edg")) browser = "Chrome";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "Safari";
  else if (lower.includes("edg")) browser = "Edge";
  else if (lower.includes("opera") || lower.includes("opr")) browser = "Opera";

  return { device, browser, icon };
}

function formatRelativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function SessionManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/user/sessions", { headers: AJAX_HEADERS });
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchSessions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchSessions]);

  const revokeSession = async (sessionId: string) => {
    if (!confirm("Revoke this session? The device will be logged out.")) return;

    try {
      setRevoking(sessionId);
      const res = await fetch("/api/user/sessions", {
        method: "DELETE",
        headers: { ...AJAX_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("Failed to revoke session");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke session");
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-neutral-400" />
        <span className="ml-2 text-sm text-neutral-500">Loading sessions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="settings-glass-danger rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-8">
          <Shield size={32} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No active sessions found.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const { device, browser, icon: DeviceIcon } = parseUserAgent(session.userAgent);
            return (
              <div
                key={session.id}
                className="settings-glass-card group flex flex-col gap-4 rounded-2xl border border-white/45 bg-white/30 p-4 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35)] transition-all hover:bg-white/40 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/45 bg-white/45 dark:border-white/10 dark:bg-white/[0.06]">
                    <DeviceIcon size={18} className="text-neutral-500 dark:text-neutral-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {device}
                      </span>
                      {session.isCurrent && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{browser}</span>
                      <span>-</span>
                      <span>{session.ip}</span>
                      <span>-</span>
                      <span>{formatRelativeTime(session.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="self-start rounded-xl p-2 text-neutral-400 opacity-100 transition-all hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20 sm:self-center sm:opacity-0 sm:group-hover:opacity-100"
                    title="Revoke session"
                  >
                    {revoking === session.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-4">
        Sessions are created when you log in. Revoking a session will log that device out.
      </p>
    </div>
  );
}
