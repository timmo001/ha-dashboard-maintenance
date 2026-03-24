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

export interface MaintenanceAvailabilityEntity {
  areaId?: string | null;
  deviceId?: string;
  displayName: string;
  entityId: string;
  state: "unavailable" | "unknown";
}

const computeDomain = (entityId: string): string =>
  entityId.split(".", 1)[0] || "";

const computeObjectId = (entityId: string): string =>
  entityId.split(".", 2)[1] || entityId;

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

const isAvailabilityIssue = (
  stateObj: HassEntity,
): stateObj is HassEntity & { state: "unavailable" | "unknown" } =>
  stateObj.state === "unavailable" || stateObj.state === "unknown";

const isRelevantAvailabilityIssue = (
  stateObj: HassEntity,
): stateObj is HassEntity & { state: "unavailable" | "unknown" } =>
  isAvailabilityIssue(stateObj) && isAvailabilityDomainRelevant(stateObj.entity_id);

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

const issueSeverity = (state: MaintenanceAvailabilityEntity["state"]): number =>
  state === "unavailable" ? 0 : 1;

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

export const getMaintenanceAvailabilityEntities = async (
  hass: HomeAssistant,
): Promise<MaintenanceAvailabilityEntity[]> => {
  const [entities, devices] = await Promise.all([
    fetchEntityRegistry(hass),
    fetchDeviceRegistry(hass),
  ]);

  return Object.values(hass.states)
    .filter(isRelevantAvailabilityIssue)
    .map<MaintenanceAvailabilityEntity | undefined>((stateObj) => {
      const entry = entities[stateObj.entity_id];

      if (entry?.disabled_by || entry?.hidden_by) {
        return undefined;
      }

      const deviceId = entry?.device_id || undefined;
      const device = deviceId ? devices[deviceId] : undefined;

      return {
        areaId: device?.area_id || entry?.area_id,
        deviceId,
        displayName: computeEntityDisplayName(entry, device, stateObj),
        entityId: stateObj.entity_id,
        state: stateObj.state,
      } satisfies MaintenanceAvailabilityEntity;
    })
    .filter(isDefined)
    .sort(
      (left, right) =>
        issueSeverity(left.state) - issueSeverity(right.state) ||
        compareText(left.displayName, right.displayName),
    );
};

export const groupAvailabilityEntitiesByArea = (
  areaId: string,
  entities: MaintenanceAvailabilityEntity[],
): MaintenanceAvailabilityEntity[] =>
  entities.filter((entity) => entity.areaId === areaId);

export const availabilityIssueIcon = (
  entity: MaintenanceAvailabilityEntity,
): string =>
  entity.state === "unavailable"
    ? "mdi:lan-disconnect"
    : "mdi:help-rhombus-outline";

export const availabilityHeadingIcon = (): string => "mdi:lan-disconnect";

export const hasAvailabilityIssues = (
  entities: MaintenanceAvailabilityEntity[],
): boolean => entities.length > 0;

export const isAvailabilityDomainRelevant = (entityId: string): boolean =>
  computeDomain(entityId) !== "group";
