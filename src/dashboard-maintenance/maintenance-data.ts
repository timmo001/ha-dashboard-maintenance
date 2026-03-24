import type {
  AreaRegistryEntry,
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
  level: number;
  needsAttention: boolean;
}

export interface MaintenanceAreaHierarchy {
  floors: Array<{
    id: string;
    areas: string[];
  }>;
  areas: string[];
}

let entityRegistryPromise:
  | Promise<Record<string, EntityRegistryEntry>>
  | undefined;

let deviceRegistryPromise:
  | Promise<Record<string, DeviceRegistryEntry>>
  | undefined;

let areaRegistryPromise:
  | Promise<Record<string, AreaRegistryEntry>>
  | undefined;

let floorRegistryPromise:
  | Promise<Record<string, FloorRegistryEntry>>
  | undefined;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const computeDomain = (entityId: string): string =>
  entityId.split(".", 1)[0] || "";

const computeObjectId = (entityId: string): string =>
  entityId.split(".", 2)[1] || entityId;

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

const isNumericBatteryState = (stateObj: HassEntity): boolean => {
  if (computeDomain(stateObj.entity_id) !== "sensor") {
    return false;
  }

  if (stateObj.attributes.device_class !== "battery") {
    return false;
  }

  const level = Number(stateObj.state);
  return Number.isFinite(level) && level >= 0 && level <= 100;
};

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
  left.level - right.level ||
  compareText(left.deviceName, right.deviceName);

export const fetchEntityRegistry = async (
  hass: HomeAssistant,
): Promise<Record<string, EntityRegistryEntry>> => {
  if (hass.entities) {
    return hass.entities;
  }

  if (!hass.connection) {
    return {};
  }

  entityRegistryPromise ??= hass.connection
    .sendMessagePromise<EntityRegistryEntry[]>({
      type: "config/entity_registry/list",
    })
    .then((entries) =>
      Object.fromEntries(entries.map((entry) => [entry.entity_id, entry])),
    )
    .catch(() => ({}));

  return entityRegistryPromise;
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

  deviceRegistryPromise ??= hass.connection
    .sendMessagePromise<DeviceRegistryEntry[]>({
      type: "config/device_registry/list",
    })
    .then((entries) =>
      Object.fromEntries(entries.map((entry) => [entry.id, entry])),
    )
    .catch(() => ({}));

  return deviceRegistryPromise;
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

  areaRegistryPromise ??= hass.connection
    .sendMessagePromise<AreaRegistryEntry[]>({
      type: "config/area_registry/list",
    })
    .then((entries) =>
      Object.fromEntries(entries.map((entry) => [entry.area_id, entry])),
    )
    .catch(() => ({}));

  return areaRegistryPromise;
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

  floorRegistryPromise ??= hass.connection
    .sendMessagePromise<FloorRegistryEntry[]>({
      type: "config/floor_registry/list",
    })
    .then((entries) =>
      Object.fromEntries(entries.map((entry) => [entry.floor_id, entry])),
    )
    .catch(() => ({}));

  return floorRegistryPromise;
};

const fallbackDevicesFromStates = (
  hass: HomeAssistant,
  attentionThreshold: number,
): MaintenanceBatteryDevice[] =>
  Object.values(hass.states)
    .filter(isNumericBatteryState)
    .map((stateObj) => {
      const level = Number(stateObj.state);

      return {
        areaId: undefined,
        entityId: stateObj.entity_id,
        deviceName: computeStateName(stateObj),
        level,
        needsAttention: level < attentionThreshold,
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
    if (!isNumericBatteryState(stateObj)) {
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
          Number(left.state) - Number(right.state) ||
          compareText(left.entity_id, right.entity_id),
      )[0];

      const level = Number(selectedBatteryState.state);
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
        needsAttention: level < normalizedThreshold,
      };
    })
    .sort(sortDevices);
};
