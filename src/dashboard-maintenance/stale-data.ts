import {
  fetchDeviceRegistry,
  fetchEntityRegistry,
} from "./maintenance-data";
import type {
  DeviceRegistryEntry,
  EntityRegistryEntry,
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

const computeDomain = (entityId: string): string =>
  entityId.split(".", 1)[0] || "";

const computeObjectId = (entityId: string): string =>
  entityId.split(".", 2)[1] || entityId;

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

const computeStateName = (stateObj: HassEntity): string =>
  stateObj.attributes.friendly_name === undefined
    ? computeObjectId(stateObj.entity_id).replace(/_/g, " ")
    : String(stateObj.attributes.friendly_name ?? "");

const computeDeviceName = (device: DeviceRegistryEntry | undefined): string | undefined =>
  (device?.name_by_user || device?.name)?.trim();

const computeEntityEntryName = (
  entry: EntityRegistryEntry | undefined,
): string | undefined => {
  if (entry?.name != null) {
    return String(entry.name);
  }

  if (entry?.original_name != null) {
    return String(entry.original_name);
  }

  return undefined;
};

const computeEntityDisplayName = (
  entry: EntityRegistryEntry | undefined,
  device: DeviceRegistryEntry | undefined,
  stateObj: HassEntity,
): string => {
  const deviceName = computeDeviceName(device);
  const entityName = computeEntityEntryName(entry);

  if (!entityName) {
    return deviceName || computeStateName(stateObj);
  }

  return deviceName ? `${deviceName} ${entityName}` : entityName;
};

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const parseTimestamp = (value?: string): number => {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const isStaleRelevantDomain = (entityId: string): boolean =>
  STALE_RELEVANT_DOMAINS.has(computeDomain(entityId));

const isAvailabilityIssue = (stateObj: HassEntity): boolean =>
  stateObj.state === "unavailable" || stateObj.state === "unknown";

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

  return Object.values(hass.states)
    .filter((stateObj) =>
      isStaleRelevantDomain(stateObj.entity_id) &&
      !isAvailabilityIssue(stateObj),
    )
    .map<MaintenanceStaleEntity | undefined>((stateObj) => {
      const entry = entities[stateObj.entity_id];

      if (entry?.disabled_by || entry?.hidden_by) {
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

      const deviceId = entry?.device_id || undefined;
      const device = deviceId ? devices[deviceId] : undefined;

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

export const groupStaleEntitiesByArea = (
  areaId: string,
  entities: MaintenanceStaleEntity[],
): MaintenanceStaleEntity[] =>
  entities.filter((entity) => entity.areaId === areaId);

export const staleEntityIcon = (): string => "mdi:clock-alert-outline";

export const hasStaleEntities = (
  entities: MaintenanceStaleEntity[],
): boolean => entities.length > 0;
