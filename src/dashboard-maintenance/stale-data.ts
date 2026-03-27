import {
  compareText,
  computeDomain,
  computeEntityDisplayName,
  isEntityRegistryVisible,
  isAvailabilityIssue,
  isDefined,
  isStateVisible,
  parseTimestamp,
} from "./entity-helpers";
import {
  fetchDeviceRegistry,
  fetchEntityRegistry,
} from "./maintenance-data";
import type {
  HassEntity,
  HomeAssistant,
} from "./types";

export const DEFAULT_STALE_THRESHOLD_HOURS = 6;

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

export const normalizeStaleThresholdHours = (
  hours?: number,
): number =>
  typeof hours === "number" && !Number.isNaN(hours) && hours > 0
    ? Math.round(hours)
    : DEFAULT_STALE_THRESHOLD_HOURS;

export const getMaintenanceStaleEntities = async (
  hass: HomeAssistant,
  thresholdHours?: number,
): Promise<MaintenanceStaleEntity[]> => {
  const normalizedThreshold = normalizeStaleThresholdHours(thresholdHours);
  const thresholdMs = normalizedThreshold * 60 * 60 * 1000;
  const now = Date.now();

  const [entities, devices] = await Promise.all([
    fetchEntityRegistry(hass),
    fetchDeviceRegistry(hass),
  ]);
  const hasEntityRegistry = Object.keys(entities).length > 0;

  return Object.values(hass.states)
    .filter((stateObj) =>
      isStaleRelevantDomain(stateObj.entity_id) &&
      !isAvailabilityIssue(stateObj),
    )
    .map<MaintenanceStaleEntity | undefined>((stateObj) => {
      if (!isStateVisible(stateObj)) {
        return undefined;
      }

      const entry = entities[stateObj.entity_id];
      if (hasEntityRegistry && !entry) {
        return undefined;
      }

      const deviceId = entry?.device_id || undefined;
      const device = deviceId ? devices[deviceId] : undefined;

      if ((entry && !isEntityRegistryVisible(entry)) || device?.disabled_by) {
        return undefined;
      }

      // Use last_updated (when HA last received any state report) in
      // preference to last_changed (when the value actually changed).
      // A sensor that keeps reporting the same value refreshes
      // last_updated but not last_changed.
      const lastUpdatedTs = parseTimestamp(
        stateObj.last_updated || stateObj.last_changed,
      );

      if (lastUpdatedTs === 0) {
        return undefined;
      }

      const staleDurationMs = now - lastUpdatedTs;

      if (staleDurationMs < thresholdMs) {
        return undefined;
      }

      return {
        areaId: device?.area_id || entry?.area_id,
        deviceId,
        displayName: computeEntityDisplayName(entry, device, stateObj),
        entityId: stateObj.entity_id,
        lastUpdated: stateObj.last_updated || stateObj.last_changed || "",
        staleDurationMs,
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

export const hasStaleEntities = (
  entities: MaintenanceStaleEntity[],
): boolean => entities.length > 0;
