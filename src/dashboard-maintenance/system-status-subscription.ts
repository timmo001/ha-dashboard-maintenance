import type { HomeAssistant } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemStatusData {
  cpu_percent: number;
  memory_free_mb: number;
  memory_used_mb: number;
  memory_used_percent: number;
  timestamp: string;
}

export interface HostInfoData {
  disk_free: number;
  disk_total: number;
  disk_used: number;
  disk_life_time: number | null;
  boot_timestamp: Date | null;
  startup_time: number;
}

export type SystemStatusCallback = (data: SystemStatusData) => void;

// ---------------------------------------------------------------------------
// Shared hardware/subscribe_system_status subscription (ref-counted singleton)
// ---------------------------------------------------------------------------

let activeSubscription: {
  unsub: (() => void) | null;
  pending: Promise<void> | null;
  subscribers: Set<SystemStatusCallback>;
  lastData: SystemStatusData | null;
  hass: HomeAssistant | null;
} | null = null;

const startSubscription = (hass: HomeAssistant): void => {
  if (!activeSubscription || !hass.connection) {
    return;
  }

  const sub = activeSubscription;
  sub.hass = hass;

  sub.pending = (async () => {
    try {
      const connection = hass.connection as unknown as {
        subscribeMessage: (
          callback: (msg: SystemStatusData) => void,
          params: { type: string },
        ) => Promise<() => void>;
      };

      const unsubscribe = await connection.subscribeMessage(
        (message: SystemStatusData) => {
          if (sub) {
            sub.lastData = message;
            for (const cb of sub.subscribers) {
              cb(message);
            }
          }
        },
        { type: "hardware/subscribe_system_status" },
      );

      sub.unsub = unsubscribe;
    } catch {
      // API not available (not HA OS, hardware component not loaded)
      sub.unsub = null;
    } finally {
      sub.pending = null;
    }
  })();
};

/**
 * Subscribe to real-time system status (CPU, memory).
 * Uses a shared singleton subscription — first caller starts it, last
 * unsubscriber closes it.
 *
 * Returns an unsubscribe function. Call it when the component disconnects.
 * Returns `null` if subscription cannot be established (no connection).
 */
export const subscribeSystemStatus = (
  hass: HomeAssistant,
  callback: SystemStatusCallback,
): (() => void) | null => {
  if (!hass.connection) {
    return null;
  }

  if (!activeSubscription) {
    activeSubscription = {
      unsub: null,
      pending: null,
      subscribers: new Set(),
      lastData: null,
      hass: null,
    };
    startSubscription(hass);
  }

  activeSubscription.subscribers.add(callback);

  // Immediately emit last known data if available
  if (activeSubscription.lastData) {
    callback(activeSubscription.lastData);
  }

  return () => {
    if (!activeSubscription) {
      return;
    }

    activeSubscription.subscribers.delete(callback);

    if (activeSubscription.subscribers.size === 0) {
      if (activeSubscription.unsub) {
        activeSubscription.unsub();
      }
      activeSubscription = null;
    }
  };
};

// ---------------------------------------------------------------------------
// Cached supervisor/api /host/info fetcher
// ---------------------------------------------------------------------------

const HOST_INFO_CACHE_TTL_MS = 30_000;

let hostInfoCache: {
  data: HostInfoData;
  fetchedAt: number;
} | null = null;

let hostInfoFetchPromise: Promise<HostInfoData | null> | null = null;

/**
 * Parse a boot timestamp from the supervisor API into a Date.
 * The supervisor returns `boot_timestamp` as microseconds since epoch.
 * Returns `null` if the value is missing or unparseable.
 */
const parseBootTimestamp = (value: unknown): Date | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Supervisor uses microseconds (16-digit integer like 1778095166926904)
    return new Date(value / 1000);
  }
  if (typeof value === "string" && value.length > 0) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
  }
  return null;
};

const parseHostInfoResponse = (response: unknown): HostInfoData | null => {
  if (typeof response !== "object" || response === null) {
    return null;
  }

  const data = (response as { data?: unknown }).data ?? response;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const disk_free = Number(record.disk_free);
  const disk_total = Number(record.disk_total);
  const disk_used = Number(record.disk_used);
  const boot_timestamp = parseBootTimestamp(record.boot_timestamp);
  const startup_time = Number(record.startup_time);

  if (
    !Number.isFinite(disk_free) ||
    !Number.isFinite(disk_total) ||
    !Number.isFinite(disk_used)
  ) {
    return null;
  }

  return {
    disk_free,
    disk_total,
    disk_used,
    disk_life_time:
      typeof record.disk_life_time === "number" ? record.disk_life_time : null,
    boot_timestamp,
    startup_time: Number.isFinite(startup_time) ? startup_time : 0,
  };
};

/**
 * Fetch host info from the supervisor API. Caches the result for 30 seconds.
 * Returns `null` if supervisor is unavailable (container/core install).
 */
export const fetchHostInfo = async (
  hass: HomeAssistant,
): Promise<HostInfoData | null> => {
  if (
    hostInfoCache &&
    Date.now() - hostInfoCache.fetchedAt < HOST_INFO_CACHE_TTL_MS
  ) {
    return hostInfoCache.data;
  }

  if (hostInfoFetchPromise) {
    return hostInfoFetchPromise;
  }

  if (!hass.connection) {
    return null;
  }

  hostInfoFetchPromise = (async (): Promise<HostInfoData | null> => {
    try {
      const response = await hass.connection!.sendMessagePromise<unknown>({
        type: "supervisor/api",
        endpoint: "/host/info",
        method: "get",
      });

      const parsed = parseHostInfoResponse(response);
      if (parsed) {
        hostInfoCache = { data: parsed, fetchedAt: Date.now() };
      }
      return parsed;
    } catch {
      return null;
    } finally {
      hostInfoFetchPromise = null;
    }
  })();

  return hostInfoFetchPromise;
};

/**
 * Probe whether the hardware status subscription is likely available.
 * Attempts a quick subscription/unsubscription cycle.
 */
export const probeHardwareStatusAvailable = async (
  hass: HomeAssistant,
): Promise<boolean> => {
  if (!hass.connection) {
    return false;
  }

  try {
    const connection = hass.connection as unknown as {
      subscribeMessage: (
        callback: (msg: unknown) => void,
        params: { type: string },
      ) => Promise<() => void>;
    };

    const unsub = await connection.subscribeMessage(
      () => {},
      { type: "hardware/subscribe_system_status" },
    );
    unsub();
    return true;
  } catch {
    return false;
  }
};

/**
 * Probe whether the supervisor API is available.
 */
export const probeSupervisorAvailable = async (
  hass: HomeAssistant,
): Promise<boolean> => {
  const info = await fetchHostInfo(hass);
  return info !== null;
};

// ---------------------------------------------------------------------------
// Integration setup time (integration/setup_info)
// ---------------------------------------------------------------------------

export interface IntegrationSetupData {
  /** Setup time of the slowest integration (seconds) — the actual startup bottleneck. */
  slowestSeconds: number;
  /** Domain of the slowest integration. */
  slowestDomain: string;
}

let setupInfoCache: {
  data: IntegrationSetupData;
  fetchedAt: number;
} | null = null;

let setupInfoFetchPromise: Promise<IntegrationSetupData | null> | null = null;

const SETUP_INFO_CACHE_TTL_MS = 60_000;

/**
 * Fetch integration setup times. Caches for 60 seconds.
 * Returns `null` if the API is unavailable.
 */
export const fetchIntegrationSetupInfo = async (
  hass: HomeAssistant,
): Promise<IntegrationSetupData | null> => {
  if (
    setupInfoCache &&
    Date.now() - setupInfoCache.fetchedAt < SETUP_INFO_CACHE_TTL_MS
  ) {
    return setupInfoCache.data;
  }

  if (setupInfoFetchPromise) {
    return setupInfoFetchPromise;
  }

  if (!hass.connection) {
    return null;
  }

  setupInfoFetchPromise = (async (): Promise<IntegrationSetupData | null> => {
    try {
      const response = await hass.connection!.sendMessagePromise<
        Array<{ domain: string; seconds?: number }>
      >({ type: "integration/setup_info" });

      if (!Array.isArray(response) || response.length === 0) {
        return null;
      }

      let slowestDomain = "";
      let slowestSeconds = 0;

      for (const entry of response) {
        const s = entry.seconds ?? 0;
        if (s > slowestSeconds) {
          slowestSeconds = s;
          slowestDomain = entry.domain;
        }
      }

      const data: IntegrationSetupData = { slowestDomain, slowestSeconds };
      setupInfoCache = { data, fetchedAt: Date.now() };
      return data;
    } catch {
      return null;
    } finally {
      setupInfoFetchPromise = null;
    }
  })();

  return setupInfoFetchPromise;
};
