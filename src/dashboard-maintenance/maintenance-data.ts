import {
  compareText,
  computeDomain,
  computeEntityDisplayName,
  computeStateName,
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
} from "./types";

export const DEFAULT_BATTERY_ATTENTION_THRESHOLD = 30;

export interface MaintenanceBatteryDevice {
  deviceId?: string;
  areaId?: string | null;
  deviceName: string;
  entityId: string;
  level: number | null;
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

export const normalizeBatteryAttentionThreshold = (
  threshold?: number,
): number =>
  typeof threshold === "number" && !Number.isNaN(threshold)
    ? clamp(Math.round(threshold), 0, 100)
    : DEFAULT_BATTERY_ATTENTION_THRESHOLD;

const sortDevices = (
  left: MaintenanceBatteryDevice,
  right: MaintenanceBatteryDevice,
): number =>
  Number(right.needsAttention) - Number(left.needsAttention) ||
  (left.level ?? -1) - (right.level ?? -1) ||
  compareText(left.deviceName, right.deviceName);

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
  attentionThreshold: number,
): MaintenanceBatteryDevice[] =>
  Object.values(hass.states)
    .filter((stateObj) => isMaintenanceBatteryState(stateObj) && isStateVisible(stateObj))
    .map((stateObj) => {
      const level = batteryStateLevel(stateObj);

      return {
        areaId: undefined,
        entityId: stateObj.entity_id,
        deviceName: computeStateName(stateObj),
        level,
        needsAttention: level === null || level < attentionThreshold,
      };
    })
    .sort(sortDevices);

export const getMaintenanceBatteryDevices = async (
  hass: HomeAssistant,
  attentionThreshold?: number,
): Promise<MaintenanceBatteryDevice[]> => {
  const normalizedThreshold =
    normalizeBatteryAttentionThreshold(attentionThreshold);
  const [entities, devices] = await Promise.all([
    fetchEntityRegistry(hass),
    fetchDeviceRegistry(hass),
  ]);

  if (Object.keys(entities).length === 0) {
    return fallbackDevicesFromStates(hass, normalizedThreshold);
  }

  const batteryEntitiesByDevice: Record<string, HassEntity[]> = {};

  for (const entry of Object.values(entities)) {
    if (
      !entry.device_id ||
      entry.disabled_by ||
      entry.hidden_by ||
      !(entry.entity_id in hass.states)
    ) {
      continue;
    }

    const stateObj = hass.states[entry.entity_id];
    if (
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
      const selectedBatteryState = batteryStates.sort(
        (left, right) =>
          batteryStatePriority(left) - batteryStatePriority(right) ||
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
        needsAttention: level === null || level < normalizedThreshold,
      };
    })
    .sort(sortDevices);
};
