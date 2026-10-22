"use client";

import { WifiOff, Wifi, X, RefreshCw } from "lucide-react";
import type { NetworkRecoveryPhase } from "@/hooks/use-network-status";

export type { NetworkRecoveryPhase };

export interface NetworkStatusBannerProps {
  phase: NetworkRecoveryPhase;
  /** Elapsed seconds since going offline */
  elapsed: number;
  /** Max seconds before giving up and falling back to manual retry */
  maxWaitSeconds: number;
  onCancel: () => void;
  onRetry?: () => void;
}

export default function NetworkStatusBanner({
  phase,
  elapsed,
  maxWaitSeconds,
  onCancel,
  onRetry,
}: NetworkStatusBannerProps) {
  if (phase === "online") return null;

  const remaining = Math.max(0, maxWaitSeconds - elapsed);
  const isOffline = phase === "offline";
  const isReconnecting = phase === "reconnecting";
  const isRecovered = phase === "recovered";

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-3xl mb-2 animate-fade-in"
    >
      <div
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 glass-panel border backdrop-blur-xl shadow-lg transition-all duration-300 ${
          isRecovered
            ? "border-emerald-300/40 dark:border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
            : isReconnecting
            ? "border-primary/40 dark:border-primary/30 bg-primary/10 text-primary"
            : "border-amber-300/40 dark:border-amber-500/30 bg-amber-50/90 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200"
        }`}
      >
        {isRecovered ? (
          <Wifi size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : isReconnecting ? (
          <RefreshCw size={18} className="text-primary animate-spin shrink-0" />
        ) : (
          <WifiOff size={18} className="text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isRecovered
              ? "Internet connection restored."
              : isReconnecting
              ? "Reconnected — resuming your conversation\u2026"
              : "Connection lost \u2014 waiting for internet to resume\u2026"}
          </p>
          {isOffline && (
            <p className="text-xs opacity-75 mt-0.5">
              {remaining > 0
                ? `Will auto-retry when back online \u00b7 ${remaining}s remaining`
                : "Auto-retry paused \u00b7 click Reconnect to test your connection"}
            </p>
          )}
          {isRecovered && (
            <p className="text-xs opacity-75 mt-0.5">
              Resuming from where you left off.
            </p>
          )}
        </div>

        {isOffline && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-400/20 dark:hover:bg-amber-400/30 text-amber-900 dark:text-amber-100 transition-colors active:scale-95 shrink-0"
            title="Attempt to reconnect now"
          >
            <RefreshCw size={13} className="shrink-0" />
            <span>Reconnect</span>
          </button>
        )}

        {!isRecovered && (
          <button
            type="button"
            onClick={onCancel}
            className="h-8 w-8 shrink-0 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-90 opacity-70 hover:opacity-100"
            title="Cancel and dismiss"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
