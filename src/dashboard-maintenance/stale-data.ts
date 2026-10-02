import {
  compareText,
  computeDomain,
  computeEntityDisplayName,
  isEntityRegistryVisible,
  isAvailabilityIssue,
  isDefined,
  parseTimestamp,
  resolveStateContext,
} from "./entity-helpers";
import {
  fetchDeviceRegistry,
  fetchEntityRegistry,
} from "./maintenance-data";
import type { HassEntity, HomeAssistant } from "./types";

export const DEFAULT_STALE_THRESHOLD_HOURS = 6;

export const MIN_STALE_THRESHOLD_HOURS = 1;

export const MAX_STALE_THRESHOLD_HOURS = 72;

export interface MaintenanceStaleEntity {
  areaId?: string | null;
  deviceId?: string;
  displayName: string;
  entityId: string;
  lastUpdated: string;
  staleDurationMs: number;
  state: string;
}

/**
 * Domains where staleness indicates a potential device communication issue.
 * These represent entities backed by real hardware or external services that
 * are expected to report state periodically.
 */
const STALE_RELEVANT_DOMAINS = new Set([
  "sensor",
  "binary_sensor",
  "switch",
  "light",
  "cover",
  "climate",
  "fan",
  "lock",
  "media_player",
  "vacuum",
  "camera",
  "device_tracker",
  "alarm_control_panel",
  "water_heater",
  "humidifier",
]);

const isStaleRelevantDomain = (entityId: string): boolean =>
  STALE_RELEVANT_DOMAINS.has(computeDomain(entityId));

const normalizeStaleThresholdHours = (
  hours?: number,
): number => {
  if (hours === undefined || Number.isNaN(hours) || hours <= 0) {
    return DEFAULT_STALE_THRESHOLD_HOURS;
  }

  return Math.min(
    MAX_STALE_THRESHOLD_HOURS,
    Math.max(MIN_STALE_THRESHOLD_HOURS, Math.round(hours)),
  );
};

export const staleThresholdMs = (thresholdHours?: number): number =>
  normalizeStaleThresholdHours(thresholdHours) * 60 * 60 * 1000;

// Use last_updated (when HA last received any state report) in
// preference to last_changed (when the value actually changed).
// A sensor that keeps reporting the same value refreshes
// last_updated but not last_changed.
const staleTimestamp = (stateObj: HassEntity): number =>
  parseTimestamp(stateObj.last_updated || stateObj.last_changed);

export const isStaleState = (
  stateObj: HassEntity,
  thresholdMs: number,
  now: number,
): boolean => {
  if (
    !isStaleRelevantDomain(stateObj.entity_id) ||
    isAvailabilityIssue(stateObj)
  ) {
    return false;
  }

  const lastUpdatedTs = staleTimestamp(stateObj);

  return lastUpdatedTs !== 0 && now - lastUpdatedTs >= thresholdMs;
};

export const getMaintenanceStaleEntities = async (
  hass: HomeAssistant,
  thresholdHours?: number,
): Promise<MaintenanceStaleEntity[]> => {
  const thresholdMs = staleThresholdMs(thresholdHours);
  const now = Date.now();

  const [entities, devices] = await Promise.all([
    fetchEntityRegistry(hass),
    fetchDeviceRegistry(hass),
  ]);

  const hasEntityRegistry = Object.keys(entities).length > 0;

  return Object.values(hass.states)
    .filter((stateObj) => isStaleState(stateObj, thresholdMs, now))
    .map<MaintenanceStaleEntity | undefined>((stateObj) => {
      const ctx = resolveStateContext(
        stateObj,
        entities,
        devices,
        hasEntityRegistry,
      );

      if (!ctx) {
        return undefined;
      }

      const { entry, deviceId, device } = ctx;

      if ((entry && !isEntityRegistryVisible(entry)) || device?.disabled_by) {
        return undefined;
      }

      return {
        areaId: device?.area_id || entry?.area_id,
        deviceId,
        displayName: computeEntityDisplayName(entry, device, stateObj),
        entityId: stateObj.entity_id,
        lastUpdated: stateObj.last_updated || stateObj.last_changed || "",
        staleDurationMs: now - staleTimestamp(stateObj),
        state: stateObj.state,
      } satisfies MaintenanceStaleEntity;
    })
    .filter(isDefined)
    .sort(
      (left, right) =>
        right.staleDurationMs - left.staleDurationMs ||
        compareText(left.displayName, right.displayName),
    );
};

export const staleEntityIcon = (): string => "mdi:clock-alert-outline";
