import type {
  DeviceRegistryEntry,
  EntityRegistryEntry,
  HassEntity,
  HomeAssistant,
} from "./types";

export const DEFAULT_BATTERY_ATTENTION_THRESHOLD = 30;

export interface MaintenanceBatteryDevice {
  deviceId?: string;
  deviceName: string;
  entityId: string;
  level: number;
  needsAttention: boolean;
}

let entityRegistryPromise:
  | Promise<Record<string, EntityRegistryEntry>>
  | undefined;

let deviceRegistryPromise:
  | Promise<Record<string, DeviceRegistryEntry>>
  | undefined;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const computeDomain = (entityId: string): string =>
  entityId.split(".", 1)[0] || "";

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

const computeDeviceName = (
  device: DeviceRegistryEntry | undefined,
  stateObj: HassEntity,
): string =>
  device?.name_by_user ||
  device?.name ||
  stateObj.attributes.friendly_name ||
  stateObj.entity_id;

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

const fetchEntityRegistry = async (
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

const fetchDeviceRegistry = async (
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

const fallbackDevicesFromStates = (
  hass: HomeAssistant,
  attentionThreshold: number,
): MaintenanceBatteryDevice[] =>
  Object.values(hass.states)
    .filter(isNumericBatteryState)
    .map((stateObj) => {
      const level = Number(stateObj.state);

      return {
        entityId: stateObj.entity_id,
        deviceName: stateObj.attributes.friendly_name || stateObj.entity_id,
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

      return {
        deviceId,
        deviceName: computeDeviceName(devices[deviceId], selectedBatteryState),
        entityId: selectedBatteryState.entity_id,
        level,
        needsAttention: level < normalizedThreshold,
      };
    })
    .sort(sortDevices);
};
