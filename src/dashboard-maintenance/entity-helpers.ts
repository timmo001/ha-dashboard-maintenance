import type {
  DeviceRegistryEntry,
  EntityRegistryEntry,
  HassEntity,
} from "./types";

export const computeDomain = (entityId: string): string =>
  entityId.split(".", 1)[0] || "";

export const computeObjectId = (entityId: string): string =>
  entityId.split(".", 2)[1] || entityId;

/** Map of entity domains to their Material Design icons. */
const DOMAIN_ICONS: Record<string, string> = {
  alert: "mdi:alert",
  automation: "mdi:robot",
  binary_sensor: "mdi:binary-sensor",
  button: "mdi:button-pointer",
  camera: "mdi:camera",
  climate: "mdi:thermostat",
  cover: "mdi:blinds",
  device_tracker: "mdi:device-tracker",
  fan: "mdi:fan",
  group: "mdi:group",
  light: "mdi:lightbulb",
  lock: "mdi:lock",
  media_player: "mdi:cast",
  notify: "mdi:bell",
  number: "mdi:numeric",
  scene: "mdi:palette",
  script: "mdi:script-text",
  select: "mdi:form-dropdown",
  sensor: "mdi:sensor",
  siren: "mdi:bullhorn",
  switch: "mdi:switch",
  text: "mdi:text",
  update: "mdi:package-up",
  vacuum: "mdi:vacuum",
  water_heater: "mdi:water-boiler",
};

/**
 * Get the default icon for an entity domain.
 * Returns the domain-specific icon if known, otherwise falls back to mdi:exclamation.
 */
export const computeDomainIcon = (entityId: string): string => {
  const domain = computeDomain(entityId);
  return DOMAIN_ICONS[domain] || "mdi:exclamation-thick";
};

export const compareText = (left: string, right: string, language?: string): number =>
  left.localeCompare(right, language, { sensitivity: "base" });

export const computeStateName = (stateObj: HassEntity): string =>
  stateObj.attributes.friendly_name === undefined
    ? computeObjectId(stateObj.entity_id).replace(/_/g, " ")
    : String(stateObj.attributes.friendly_name ?? "");

export const computeDeviceName = (device: DeviceRegistryEntry | undefined): string | undefined =>
  (device?.name_by_user || device?.name)?.trim();

export const computeEntityEntryName = (
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

export const computeEntityDisplayName = (
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

export const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

export const parseTimestamp = (value?: string): number => {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const isAvailabilityIssue = (
  stateObj: HassEntity,
): stateObj is HassEntity & { state: "unavailable" | "unknown" } =>
  stateObj.state === "unavailable" || stateObj.state === "unknown";

/** Filter items by area ID. Works with any entity/device that has an areaId field. */
export const filterItemsByArea = <T extends { areaId?: string | null }>(
  items: T[],
  areaId?: string,
): T[] => (areaId ? items.filter((item) => item.areaId === areaId) : items);

/** Group items belonging to a specific area. */
export const groupItemsByArea = <T extends { areaId?: string | null }>(
  areaId: string,
  items: T[],
): T[] => items.filter((item) => item.areaId === areaId);
