import {
  computeEntityDisplayName,
  computeDomain,
  isEntityRegistryVisible,
  isStateVisible,
} from "./entity-helpers";
import {
  fetchConfigEntries,
  fetchDeviceRegistry,
  fetchEntityRegistry,
} from "./maintenance-data";
import {
  fetchHostInfo,
  probeHardwareStatusAvailable,
  probeSupervisorAvailable,
} from "./system-status-subscription";
import type { SystemMetricType } from "./dm-system-metric-card";
import type { HomeAssistant } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Domains whose config entries are considered "system" integrations. */
const DEFAULT_SYSTEM_DOMAINS: ReadonlySet<string> = new Set([
  "systemmonitor",
  "cert_expiry",
]);

/** Entity domains we include from system integrations. */
const ALLOWED_ENTITY_DOMAINS: ReadonlySet<string> = new Set([
  "sensor",
  "binary_sensor",
]);

export interface SystemEntitySensor {
  entityId: string;
  displayName: string;
  deviceId?: string;
  icon?: string;
}

export interface SystemApiAvailability {
  /** Whether hardware/subscribe_system_status works (CPU + memory). */
  hardwareStatus: boolean;
  /** Whether supervisor/api /host/info works (disk + uptime). */
  supervisor: boolean;
}

export interface SystemMetricDescriptor {
  metric: SystemMetricType;
  label?: string;
  icon?: string;
}

// ---------------------------------------------------------------------------
// API availability probing
// ---------------------------------------------------------------------------

let cachedApiAvailability: SystemApiAvailability | null = null;

/**
 * Probe whether system APIs are available.
 * Caches the result for the lifetime of the page (APIs don't come/go).
 */
export const getSystemApiAvailability = async (
  hass: HomeAssistant,
): Promise<SystemApiAvailability> => {
  if (cachedApiAvailability) {
    return cachedApiAvailability;
  }

  const [hardwareStatus, supervisor] = await Promise.all([
    probeHardwareStatusAvailable(hass),
    probeSupervisorAvailable(hass),
  ]);

  cachedApiAvailability = { hardwareStatus, supervisor };
  return cachedApiAvailability;
};

/**
 * Build the list of API-driven system metrics available on this installation.
 */
export const getAvailableSystemMetrics = async (
  hass: HomeAssistant,
): Promise<SystemMetricDescriptor[]> => {
  const availability = await getSystemApiAvailability(hass);
  const metrics: SystemMetricDescriptor[] = [];

  if (availability.hardwareStatus) {
    metrics.push(
      { metric: "cpu" },
      { metric: "memory_percent" },
    );
  }

  if (availability.supervisor) {
    metrics.push({ metric: "disk_percent" });

    // Only show drive health if the hardware reports disk_life_time
    const hostInfo = await fetchHostInfo(hass);
    if (hostInfo?.disk_life_time !== null && hostInfo?.disk_life_time !== undefined) {
      metrics.push({ metric: "disk_health" });
    }

    metrics.push({ metric: "uptime" });
  }

  return metrics;
};

// ---------------------------------------------------------------------------
// Entity-based system sensor discovery
// ---------------------------------------------------------------------------

/**
 * Discover entity-based sensors from system integrations
 * (systemmonitor, cert_expiry, etc.).
 */
export const getSystemEntitySensors = async (
  hass: HomeAssistant,
): Promise<SystemEntitySensor[]> => {
  const [entities, devices, configEntries] = await Promise.all([
    fetchEntityRegistry(hass),
    fetchDeviceRegistry(hass),
    fetchConfigEntries(hass),
  ]);

  // Find config entry IDs for system domains
  const systemConfigEntryIds = new Set<string>();
  for (const entry of Object.values(configEntries)) {
    if (DEFAULT_SYSTEM_DOMAINS.has(entry.domain)) {
      systemConfigEntryIds.add(entry.entry_id);
    }
  }

  if (systemConfigEntryIds.size === 0) {
    return [];
  }

  const results: SystemEntitySensor[] = [];

  for (const entry of Object.values(entities)) {
    // Must belong to a system integration config entry
    if (!entry.config_entry_id || !systemConfigEntryIds.has(entry.config_entry_id)) {
      continue;
    }

    // Must be a visible sensor or binary_sensor
    if (!ALLOWED_ENTITY_DOMAINS.has(computeDomain(entry.entity_id))) {
      continue;
    }

    if (!isEntityRegistryVisible(entry)) {
      continue;
    }

    // Must have a state object
    const stateObj = hass.states[entry.entity_id];
    if (!stateObj || !isStateVisible(stateObj)) {
      continue;
    }

    const device = entry.device_id ? devices[entry.device_id] : undefined;
    const displayName = computeEntityDisplayName(entry, device, stateObj);
    const deviceId = entry.device_id || undefined;

    results.push({
      entityId: entry.entity_id,
      displayName,
      deviceId,
    });
  }

  return results;
};

/**
 * Check whether the system module has any data to show.
 * Returns true if either API metrics or entity sensors are available.
 */
export const hasSystemData = async (
  hass: HomeAssistant,
): Promise<boolean> => {
  const [metrics, sensors] = await Promise.all([
    getAvailableSystemMetrics(hass),
    getSystemEntitySensors(hass),
  ]);

  return metrics.length > 0 || sensors.length > 0;
};
