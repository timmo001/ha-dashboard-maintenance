import {
  compareText,
  computeDomain,
  computeEntityDisplayName,
  computeStateName,
  isEntityRegistryVisible,
  isStateVisible,
} from "./entity-helpers";
import type {
  AreaRegistryEntry,
  ConfigEntry,
  DeviceRegistryEntry,
  EntityRegistryEntry,
  FloorRegistryEntry,
  HassEntity,
  HomeAssistant,
  MaintenanceStrategyConfig,
} from "./types";

export const DEFAULT_BATTERY_ATTENTION_THRESHOLD = 30;

export interface MaintenanceBatteryDevice {
  deviceId?: string;
  areaId?: string | null;
  deviceName: string;
  entityId: string;
  level: number | null;
  isCharging: boolean;
  needsAttention: boolean;
}

export interface MaintenanceAreaHierarchy {
  floors: Array<{
    id: string;
    areas: string[];
  }>;
  areas: string[];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const isBatterySensorEntity = (stateObj: HassEntity): boolean => {
  if (computeDomain(stateObj.entity_id) !== "sensor") {
    return false;
  }

  return stateObj.attributes.device_class === "battery";
};

const isBatteryChargingState = (stateObj: HassEntity): boolean =>
  stateObj.attributes.device_class === "battery_charging" && stateObj.state === "on";

const batteryStateLevel = (stateObj: HassEntity): number | null => {
  if (!isBatterySensorEntity(stateObj)) {
    return null;
  }

  const level = Number(stateObj.state);

  if (Number.isFinite(level) && level >= 0 && level <= 100) {
    return level;
  }

  return null;
};

const isUnknownOrUnavailableBatteryState = (stateObj: HassEntity): boolean =>
  isBatterySensorEntity(stateObj) &&
  (stateObj.state === "unknown" || stateObj.state === "unavailable");

const isMaintenanceBatteryState = (stateObj: HassEntity): boolean =>
  batteryStateLevel(stateObj) !== null ||
  isUnknownOrUnavailableBatteryState(stateObj);

const batteryStatePriority = (stateObj: HassEntity): number => {
  if (stateObj.state === "unavailable") {
    return 0;
  }

  if (stateObj.state === "unknown") {
    return 1;
  }

  return 2;
};

export type BatteryThresholdConfig = Pick<
  MaintenanceStrategyConfig,
  "battery_attention_threshold" | "battery_threshold_overrides"
>;

const normalizeBatteryThreshold = (threshold?: number): number | undefined =>
  threshold !== undefined && !Number.isNaN(threshold)
    ? clamp(Math.round(threshold), 0, 100)
    : undefined;

const createBatteryThresholdResolver = (
  config?: BatteryThresholdConfig,
): ((entityId: string) => number) => {
  const defaultThreshold =
    normalizeBatteryThreshold(config?.battery_attention_threshold) ??
    DEFAULT_BATTERY_ATTENTION_THRESHOLD;

  const overrides = new Map<string, number>();

  for (const override of config?.battery_threshold_overrides ?? []) {
    const threshold = normalizeBatteryThreshold(override?.threshold);

    if (override?.entity_id !== undefined && threshold !== undefined) {
      overrides.set(override.entity_id, threshold);
    }
  }

  return (entityId) => overrides.get(entityId) ?? defaultThreshold;
};

const batteryNeedsAttention = (
  stateObj: HassEntity,
  threshold: number,
): boolean => {
  const level = batteryStateLevel(stateObj);

  return level === null || level < threshold;
};

const sortDevices = (
  left: MaintenanceBatteryDevice,
  right: MaintenanceBatteryDevice,
): number =>
  Number(right.needsAttention) - Number(left.needsAttention) ||
  (left.level ?? -1) - (right.level ?? -1) ||
  compareText(left.deviceName, right.deviceName);

export const isBatteryAttentionPanelDevice = (
  device: MaintenanceBatteryDevice,
): boolean => device.needsAttention && !device.isCharging;

export const fetchEntityRegistry = async (
  hass: HomeAssistant,
): Promise<Record<string, EntityRegistryEntry>> => {
  // Prefer the live HA frontend cache when available so visibility changes
  // (hidden_by / disabled_by) are reflected without stale websocket caching.
  if (hass.entities) {
    return hass.entities;
  }

  if (!hass.connection) {
    return {};
  }

  try {
    const entries = await hass.connection.sendMessagePromise<EntityRegistryEntry[]>({
      type: "config/entity_registry/list",
    });

    return Object.fromEntries(entries.map((entry) => [entry.entity_id, entry]));
  } catch {
    return {};
  }
};

export const fetchDeviceRegistry = async (
  hass: HomeAssistant,
): Promise<Record<string, DeviceRegistryEntry>> => {
  if (hass.devices) {
    return hass.devices;
  }

  if (!hass.connection) {
    return {};
  }

  try {
    const entries = await hass.connection.sendMessagePromise<DeviceRegistryEntry[]>({
      type: "config/device_registry/list",
    });

    return Object.fromEntries(entries.map((entry) => [entry.id, entry]));
  } catch {
    return {};
  }
};

export const getAreasFloorHierarchy = (
  areas: Record<string, AreaRegistryEntry>,
  floors: Record<string, FloorRegistryEntry>,
): MaintenanceAreaHierarchy => {
  const floorAreas: Record<string, string[]> = {};
  const unassignedAreas: string[] = [];

  for (const area of Object.values(areas)) {
    if (area.floor_id) {
      if (!(area.floor_id in floorAreas)) {
        floorAreas[area.floor_id] = [];
      }

      floorAreas[area.floor_id].push(area.area_id);
      continue;
    }

    unassignedAreas.push(area.area_id);
  }

  return {
    floors: Object.values(floors).map((floor) => ({
      id: floor.floor_id,
      areas: floorAreas[floor.floor_id] || [],
    })),
    areas: unassignedAreas,
  };
};

export const getMaintenanceAreas = async (
  hass: HomeAssistant,
): Promise<Record<string, AreaRegistryEntry>> => {
  if (hass.areas) {
    return hass.areas;
  }

  if (!hass.connection) {
    return {};
  }

  try {
    const entries = await hass.connection.sendMessagePromise<AreaRegistryEntry[]>({
      type: "config/area_registry/list",
    });

    return Object.fromEntries(entries.map((entry) => [entry.area_id, entry]));
  } catch {
    return {};
  }
};

export const getMaintenanceFloors = async (
  hass: HomeAssistant,
): Promise<Record<string, FloorRegistryEntry>> => {
  if (hass.floors) {
    return hass.floors;
  }

  if (!hass.connection) {
    return {};
  }

  try {
    const entries = await hass.connection.sendMessagePromise<FloorRegistryEntry[]>({
      type: "config/floor_registry/list",
    });

    return Object.fromEntries(entries.map((entry) => [entry.floor_id, entry]));
  } catch {
    return {};
  }
};

export const fetchConfigEntries = async (
  hass: HomeAssistant,
): Promise<Record<string, ConfigEntry>> => {
  if (hass.configEntries?.entries) {
    return Object.fromEntries(
      (hass.configEntries?.entries ?? []).map((entry) => [entry.entry_id, entry]),
    );
  }

  if (!hass.connection) {
    return {};
  }

  try {
    const entries = await hass.connection.sendMessagePromise<ConfigEntry[]>({
      type: "config_entries/get",
    });

    return Object.fromEntries(entries.map((entry) => [entry.entry_id, entry]));
  } catch {
    return {};
  }
};

const fallbackDevicesFromStates = (
  hass: HomeAssistant,
  thresholdFor: (entityId: string) => number,
): MaintenanceBatteryDevice[] =>
  Object.values(hass.states)
    .filter((stateObj) => isMaintenanceBatteryState(stateObj) && isStateVisible(stateObj))
    .map((stateObj) => ({
      areaId: undefined,
      entityId: stateObj.entity_id,
      deviceName: computeStateName(stateObj),
      level: batteryStateLevel(stateObj),
      isCharging: false,
      needsAttention: batteryNeedsAttention(
        stateObj,
        thresholdFor(stateObj.entity_id),
      ),
    }))
    .sort(sortDevices);

export const getMaintenanceBatteryDevices = async (
  hass: HomeAssistant,
  thresholdConfig?: BatteryThresholdConfig,
): Promise<MaintenanceBatteryDevice[]> => {
  const thresholdFor = createBatteryThresholdResolver(thresholdConfig);

  const [entities, devices] = await Promise.all([
    fetchEntityRegistry(hass),
    fetchDeviceRegistry(hass),
  ]);

  if (Object.keys(entities).length === 0) {
    return fallbackDevicesFromStates(hass, thresholdFor);
  }

  const batteryEntitiesByDevice: Record<string, HassEntity[]> = {};
  const chargingDeviceIds = new Set<string>();

  for (const entry of Object.values(entities)) {
    if (!entry.device_id || !(entry.entity_id in hass.states)) {
      continue;
    }

    const stateObj = hass.states[entry.entity_id];

    if (isBatteryChargingState(stateObj)) {
      chargingDeviceIds.add(entry.device_id);
    }

    if (
      !isEntityRegistryVisible(entry) ||
      !isMaintenanceBatteryState(stateObj) ||
      !isStateVisible(stateObj) ||
      devices[entry.device_id]?.disabled_by
    ) {
      continue;
    }

    if (!(entry.device_id in batteryEntitiesByDevice)) {
      batteryEntitiesByDevice[entry.device_id] = [];
    }

    batteryEntitiesByDevice[entry.device_id].push(stateObj);
  }

  return Object.entries(batteryEntitiesByDevice)
    .map(([deviceId, batteryStates]) => {
      const attentionByEntityId = new Map(
        batteryStates.map((stateObj) => [
          stateObj.entity_id,
          batteryNeedsAttention(stateObj, thresholdFor(stateObj.entity_id)),
        ]),
      );

      const selectedBatteryState = batteryStates.sort(
        (left, right) =>
          batteryStatePriority(left) - batteryStatePriority(right) ||
          Number(attentionByEntityId.get(right.entity_id)) -
            Number(attentionByEntityId.get(left.entity_id)) ||
          (batteryStateLevel(left) ?? Number.POSITIVE_INFINITY) -
            (batteryStateLevel(right) ?? Number.POSITIVE_INFINITY) ||
          compareText(left.entity_id, right.entity_id),
      )[0];

      const level = batteryStateLevel(selectedBatteryState);

      const areaId =
        devices[deviceId]?.area_id ||
        entities[selectedBatteryState.entity_id]?.area_id;

      return {
        deviceId,
        areaId,
        deviceName: computeEntityDisplayName(
          entities[selectedBatteryState.entity_id],
          devices[deviceId],
          selectedBatteryState,
        ),
        entityId: selectedBatteryState.entity_id,
        level,
        isCharging: chargingDeviceIds.has(deviceId),
        needsAttention:
          attentionByEntityId.get(selectedBatteryState.entity_id) ?? false,
      };
    })
    .sort(sortDevices);
};

export const getBatteryPreviewDevice = (
  hass: HomeAssistant,
  entityId: string,
  threshold: number,
): MaintenanceBatteryDevice | undefined => {
  const stateObj = hass.states[entityId];

  if (!stateObj) {
    return undefined;
  }

  const entry = hass.entities?.[entityId];
  const deviceId = entry?.device_id ?? undefined;
  const device = deviceId ? hass.devices?.[deviceId] : undefined;

  return {
    deviceId,
    areaId: device?.area_id || entry?.area_id,
    deviceName: computeEntityDisplayName(entry, device, stateObj),
    entityId,
    level: batteryStateLevel(stateObj),
    isCharging: false,
    needsAttention: batteryNeedsAttention(stateObj, threshold),
  };
};
