"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Zap,
} from "lucide-react";
import type { QuartzwallEvent, QuartzwallStats } from "@/app/api/lib/quartzwall";

type EventsResponse = { events: QuartzwallEvent[] };
type StatsResponse = { stats: QuartzwallStats };

const emptyStats: QuartzwallStats = {
  total: 0,
  blocked: 0,
  suspicious: 0,
  safe: 0,
  averageRisk: 0,
  last24h: 0,
  byType: {
    INPUT_SCAN: 0,
    TOOL_CALL_POLICY: 0,
    TOOL_RESULT_SCAN: 0,
  },
};

function verdictClass(verdict: string) {
  if (verdict === "BLOCKED") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
  if (verdict === "SUSPICIOUS") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
}

function formatTime(unixSeconds: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

function getAttackType(event: QuartzwallEvent) {
  const attackType = event.metadata?.attackType;
  return typeof attackType === "string" ? attackType : null;
}

export default function QuartzwallPage() {
  const [stats, setStats] = useState<QuartzwallStats>(emptyStats);
  const [events, setEvents] = useState<QuartzwallEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const headers = { "X-Requested-With": "XMLHttpRequest" };
      const [statsResp, eventsResp] = await Promise.all([
        fetch("/api/quartzwall/stats", { headers, cache: "no-store" }),
        fetch("/api/quartzwall/events?limit=40", { headers, cache: "no-store" }),
      ]);

      if (!statsResp.ok || !eventsResp.ok) {
        throw new Error("QUARTZWALL telemetry unavailable");
      }

      const statsJson = (await statsResp.json()) as StatsResponse;
      const eventsJson = (await eventsResp.json()) as EventsResponse;
      setStats(statsJson.stats);
      setEvents(eventsJson.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const intervalTimer = window.setInterval(() => void refresh(), 2500);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);

  const threatLevel = useMemo(() => {
    if (stats.blocked > 0) return "Active defense";
    if (stats.suspicious > 0) return "Watching";
    return "Clear";
  }, [stats.blocked, stats.suspicious]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="border-b border-white/10 bg-neutral-950/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyan-100">
              <Shield className="h-4 w-4" />
              QUARTZWALL
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              Agent Firewall Console
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Input scanning, tool policy enforcement, and indirect prompt-injection filtering for Kaori.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        <div className="rounded-md border border-white/10 bg-white/[0.06] p-4">
          <div className="flex items-center justify-between text-sm text-neutral-300">
            <span>Blocked</span>
            <ShieldAlert className="h-4 w-4 text-red-300" />
          </div>
          <div className="mt-3 text-3xl font-semibold text-white">{stats.blocked}</div>
          <div className="mt-1 text-xs text-neutral-400">Hard stops</div>
        </div>

        <div className="rounded-md border border-white/10 bg-white/[0.06] p-4">
          <div className="flex items-center justify-between text-sm text-neutral-300">
            <span>Suspicious</span>
            <AlertTriangle className="h-4 w-4 text-amber-300" />
          </div>
          <div className="mt-3 text-3xl font-semibold text-white">{stats.suspicious}</div>
          <div className="mt-1 text-xs text-neutral-400">Allowed with flags</div>
        </div>

        <div className="rounded-md border border-white/10 bg-white/[0.06] p-4">
          <div className="flex items-center justify-between text-sm text-neutral-300">
            <span>Allowed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="mt-3 text-3xl font-semibold text-white">{stats.safe}</div>
          <div className="mt-1 text-xs text-neutral-400">Policy passes</div>
        </div>

        <div className="rounded-md border border-white/10 bg-white/[0.06] p-4">
          <div className="flex items-center justify-between text-sm text-neutral-300">
            <span>Risk</span>
            <Activity className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="mt-3 text-3xl font-semibold text-white">{stats.averageRisk}/100</div>
          <div className="mt-1 text-xs text-neutral-400">{threatLevel}</div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-8 sm:px-8 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-md border border-white/10 bg-white/[0.05]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Zap className="h-4 w-4 text-cyan-300" />
              Live Event Feed
            </div>
            <span className="text-xs text-neutral-400">{loading ? "Loading" : `${events.length} events`}</span>
          </div>

          {error ? (
            <div className="p-4 text-sm text-red-200">{error}</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-sm text-neutral-400">
              No QUARTZWALL events yet.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {events.map((event) => (
                <article key={event.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[96px_130px_1fr_80px] sm:items-start">
                  <div className="text-xs text-neutral-400">{formatTime(event.createdAt)}</div>
                  <div className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${verdictClass(event.verdict)}`}>
                    {event.verdict}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {event.type.replaceAll("_", " ")}
                      {event.toolName ? <span className="text-neutral-400"> / {event.toolName}</span> : null}
                    </div>
                    {getAttackType(event) ? (
                      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-cyan-200">
                        {getAttackType(event)}
                      </div>
                    ) : null}
                    <p className="mt-1 text-sm leading-5 text-neutral-300">{event.reason}</p>
                    {event.signals.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {event.signals.slice(0, 4).map((signal) => (
                          <span
                            key={`${event.id}-${signal.label}`}
                            className="rounded-md bg-white/10 px-2 py-1 text-xs text-neutral-300"
                          >
                            {signal.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-sm font-semibold text-white">R {event.risk}</div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-md border border-white/10 bg-white/[0.05] p-4">
          <h2 className="text-sm font-medium text-white">Event Mix</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type}>
                <div className="mb-1 flex items-center justify-between text-xs text-neutral-300">
                  <span>{type.replaceAll("_", " ")}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <svg width="100%" height="100%" className="block">
                    <rect
                      width={`${stats.total ? Math.max(8, (count / stats.total) * 100) : 0}%`}
                      height="100%"
                      className="fill-cyan-300"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-md border border-white/10 bg-neutral-950/50 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-400">Last 24h</div>
            <div className="mt-2 text-2xl font-semibold text-white">{stats.last24h}</div>
            <div className="mt-1 text-xs text-neutral-400">security decisions</div>
          </div>
        </aside>
      </section>
    </main>
  );
}
