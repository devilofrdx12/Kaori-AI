"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";

export type NetworkRecoveryPhase =
  | "online"        // Normal — connection active, banner hidden
  | "offline"       // Connection lost — waiting for internet
  | "reconnecting"  // Came back online or probing — validating server reachability
  | "recovered";    // Connection restored successfully

export interface NetworkStatusOptions {
  /** Maximum seconds to wait before auto-retry gives up (default: 60) */
  maxWaitSeconds?: number;
  /** Callback triggered when connection is successfully restored */
  onReconnect?: () => void;
  /** Callback triggered when connection is lost */
  onOffline?: () => void;
}

/** Return type for {@link useNetworkStatus}. */
export type NetworkStatus = {
  /** Whether the browser currently reports an active connection and is reachable. */
  readonly isOnline: boolean;
  /** `true` for 3 seconds after a reconnection — useful for recovery flows. */
  readonly wasOffline: boolean;
  /** Epoch-ms timestamp of the most recent reconnection, or `null`. */
  readonly reconnectedAt: number | null;
  /** Current phase of the network recovery lifecycle. */
  readonly phase: NetworkRecoveryPhase;
  /** Elapsed seconds since entering offline state. */
  readonly elapsed: number;
  /** Maximum seconds configured for auto-reconnect wait. */
  readonly maxWaitSeconds: number;
  /** Seconds remaining before auto-wait times out. */
  readonly remainingSeconds: number;
  /** Whether currently waiting for network. */
  readonly isWaiting: boolean;
  /** Whether currently in the reconnecting/probing phase. */
  readonly isReconnecting: boolean;
  /** Manually probe connection and attempt immediate reconnection. */
  readonly reconnectNow: () => Promise<boolean>;
  /** Cancel auto-reconnection / dismiss waiting banner. */
  readonly cancel: () => void;
  /** Reset network state back to online. */
  readonly reset: () => void;
};

const DEFAULT_MAX_WAIT_SECONDS = 60;
const RECONNECT_GRACE_MS = 3_000;

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerSnapshot() {
  return true;
}

async function probeServer(timeoutMs = 4000): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (!navigator.onLine) return false;
  try {
    const res = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Tracks browser online/offline status reactively and manages reconnection lifecycle.
 * When internet drops, tracks elapsed wait time and provides options to reconnect
 * or cancel. When internet returns, validates connectivity via server probe,
 * smoothly transitions to recovered, and triggers recovery/proceed flows so
 * user input continues from where it left off.
 */
export function useNetworkStatus(options: NetworkStatusOptions = {}): NetworkStatus {
  const {
    maxWaitSeconds = DEFAULT_MAX_WAIT_SECONDS,
    onReconnect,
    onOffline,
  } = options;

  const browserOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [phase, setPhase] = useState<NetworkRecoveryPhase>(() => (browserOnline ? "online" : "offline"));
  const [elapsed, setElapsed] = useState(0);
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null);

  const offlineStartRef = useRef<number | null>(null);
  const wasOfflineRef = useRef(!browserOnline);
  const isCancelledRef = useRef(false);
  const probeInProgressRef = useRef(false);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep callback refs fresh via effect
  const onReconnectRef = useRef(onReconnect);
  const onOfflineRef = useRef(onOffline);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
    onOfflineRef.current = onOffline;
  }, [onReconnect, onOffline]);

  const markReconnected = useCallback(() => {
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    const now = Date.now();
    wasOfflineRef.current = false;
    offlineStartRef.current = null;
    isCancelledRef.current = false;
    setElapsed(0);
    setReconnectedAt(now);
    setPhase("recovered");
    onReconnectRef.current?.();

    // After brief grace period, switch to clean "online"
    recoveryTimerRef.current = setTimeout(() => {
      setPhase("online");
      setReconnectedAt(null);
    }, RECONNECT_GRACE_MS);
  }, []);

  const reconnectNow = useCallback(async (): Promise<boolean> => {
    if (probeInProgressRef.current) return false;
    probeInProgressRef.current = true;
    setPhase("reconnecting");

    try {
      const reachable = await probeServer(4000);
      if (reachable) {
        markReconnected();
        // Dispatch synthetic window online event so chat-api waitForInternet resolves immediately
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("online"));
        }
        return true;
      } else {
        setPhase("offline");
        return false;
      }
    } finally {
      probeInProgressRef.current = false;
    }
  }, [markReconnected]);

  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    setPhase("online");
    setElapsed(0);
    offlineStartRef.current = null;
  }, []);

  const reset = useCallback(() => {
    isCancelledRef.current = false;
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    offlineStartRef.current = null;
    setElapsed(0);
    setPhase(typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline");
    setReconnectedAt(null);
  }, []);

  // Sync with browser online/offline store
  useEffect(() => {
    if (!browserOnline) {
      if (!isCancelledRef.current) {
        wasOfflineRef.current = true;
        offlineStartRef.current = Date.now();
        setPhase("offline");
        setElapsed(0);
        onOfflineRef.current?.();
      }
      return;
    }

    // Browser transitioned to online — verify server is actually reachable
    if (wasOfflineRef.current && !isCancelledRef.current) {
      let active = true;
      setPhase("reconnecting");

      void probeServer(4000).then((reachable) => {
        if (!active) return;
        if (reachable) {
          markReconnected();
        } else {
          setPhase("offline");
        }
      });

      return () => {
        active = false;
      };
    }
  }, [browserOnline, markReconnected]);

  // Elapsed timer while offline
  useEffect(() => {
    if (phase !== "offline") return;

    if (!offlineStartRef.current) {
      offlineStartRef.current = Date.now();
    }

    const interval = setInterval(() => {
      if (offlineStartRef.current) {
        const diff = Math.floor((Date.now() - offlineStartRef.current) / 1000);
        setElapsed(diff);

        // Periodically probe every 5 seconds while offline in case online event was missed
        if (diff > 0 && diff % 5 === 0 && !probeInProgressRef.current) {
          void probeServer(3000).then((reachable) => {
            if (reachable) {
              markReconnected();
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("online"));
              }
            }
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, markReconnected]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
  }, []);

  const remainingSeconds = Math.max(0, maxWaitSeconds - elapsed);
  const isOnline = phase === "online" || phase === "recovered";

  return {
    isOnline,
    wasOffline: reconnectedAt !== null || phase === "recovered",
    reconnectedAt,
    phase,
    elapsed,
    maxWaitSeconds,
    remainingSeconds,
    isWaiting: phase === "offline",
    isReconnecting: phase === "reconnecting",
    reconnectNow,
    cancel,
    reset,
  };
}
