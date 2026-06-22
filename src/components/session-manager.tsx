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
  if (lower.includes("windows")) device += " · Windows";
  else if (lower.includes("mac")) device += " · macOS";
  else if (lower.includes("linux")) device += " · Linux";
  else if (lower.includes("android")) device += " · Android";
  else if (lower.includes("iphone") || lower.includes("ipad")) device += " · iOS";

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
    fetchSessions();
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
        <div className="p-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
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
                className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#1c1c1c] border border-neutral-200 dark:border-neutral-800 group transition-all hover:border-neutral-300 dark:hover:border-neutral-700"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                    <DeviceIcon size={18} className="text-neutral-500 dark:text-neutral-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {device}
                      </span>
                      {session.isCurrent && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      <span>{browser}</span>
                      <span>·</span>
                      <span>{session.ip}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(session.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
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
