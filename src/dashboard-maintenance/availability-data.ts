import {
  compareText,
  computeDeviceName,
  computeDomain,
  computeEntityDisplayName,
  isAvailabilityIssue,
  isDefined,
  parseTimestamp,
} from "./entity-helpers";
import {
  fetchConfigEntries,
  fetchDeviceRegistry,
  fetchEntityRegistry,
} from "./maintenance-data";
import type {
  HassEntity,
  HomeAssistant,
} from "./types";

export interface MaintenanceAvailabilityEntity {
  areaId?: string | null;
  deviceId?: string;
  displayName: string;
  entityId: string;
  lastChanged?: string;
  state: "unavailable" | "unknown";
}

const isRelevantAvailabilityIssue = (
  stateObj: HassEntity,
): stateObj is HassEntity & { state: "unavailable" | "unknown" } =>
  isAvailabilityIssue(stateObj) && isAvailabilityDomainRelevant(stateObj.entity_id);

interface CommonControlResult {
  entities: string[];
}

const getCommonControlUsagePrediction = async (
  hass: HomeAssistant,
): Promise<string[]> => {
  if (!hass.connection) {
    return [];
  }

  try {
    const result = await hass.connection.sendMessagePromise<CommonControlResult>({
      type: "usage_prediction/common_control",
    });

    return result.entities;
  } catch {
    return [];
  }
};

export const getMaintenanceAvailabilityEntities = async (
  hass: HomeAssistant,
): Promise<MaintenanceAvailabilityEntity[]> => {
  const [entities, devices, mostUsedEntities] = await Promise.all([
    fetchEntityRegistry(hass),
    fetchDeviceRegistry(hass),
    getCommonControlUsagePrediction(hass),
  ]);
  const mostUsedEntityOrder = new Map(
    mostUsedEntities.map((entityId, index) => [entityId, index]),
  );

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
        lastChanged: stateObj.last_changed,
        state: stateObj.state,
      } satisfies MaintenanceAvailabilityEntity;
    })
    .filter(isDefined)
    .sort(
      (left, right) =>
        Number(mostUsedEntityOrder.has(left.entityId) === false) -
          Number(mostUsedEntityOrder.has(right.entityId) === false) ||
        (mostUsedEntityOrder.get(left.entityId) ?? Number.MAX_SAFE_INTEGER) -
          (mostUsedEntityOrder.get(right.entityId) ?? Number.MAX_SAFE_INTEGER) ||
        parseTimestamp(right.lastChanged) - parseTimestamp(left.lastChanged) ||
        compareText(left.displayName, right.displayName),
    );
};

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

// ---------------------------------------------------------------------------
// Device grouping
// ---------------------------------------------------------------------------

export interface MaintenanceAvailabilityDevice {
  deviceId: string;
  deviceName: string;
  devicePicture?: string | null;
  integrationDomain?: string | null;
  areaId?: string | null;
  entities: MaintenanceAvailabilityEntity[];
  unavailableCount: number;
}

/**
 * Group availability entities by their parent device.
 * Returns an array of device groups sorted by entity count descending,
 * plus any ungrouped (device-less) entities in a separate list.
 */
export const groupAvailabilityByDevice = async (
  hass: HomeAssistant,
  entities: MaintenanceAvailabilityEntity[],
): Promise<{
  devices: MaintenanceAvailabilityDevice[];
  ungrouped: MaintenanceAvailabilityEntity[];
}> => {
  const [deviceRegistry, configEntries] = await Promise.all([
    fetchDeviceRegistry(hass),
    fetchConfigEntries(hass),
  ]);

  const deviceMap = new Map<string, MaintenanceAvailabilityEntity[]>();
  const ungrouped: MaintenanceAvailabilityEntity[] = [];

  for (const entity of entities) {
    if (entity.deviceId) {
      const existing = deviceMap.get(entity.deviceId);

      if (existing) {
        existing.push(entity);
      } else {
        deviceMap.set(entity.deviceId, [entity]);
      }
    } else {
      ungrouped.push(entity);
    }
  }

  const devices: MaintenanceAvailabilityDevice[] = [];

  for (const [deviceId, deviceEntities] of deviceMap) {
    const device = deviceRegistry[deviceId];
    const deviceName = computeDeviceName(device) || deviceId;

    // Prefer the primary config entry, then fall back to the first one.
    let integrationDomain: string | null | undefined;
    const configEntryId =
      device?.primary_config_entry || device?.config_entries?.[0];
    if (configEntryId) {
      const configEntry = configEntries[configEntryId];
      integrationDomain = configEntry?.domain;
    }

    devices.push({
      deviceId,
      deviceName,
      devicePicture: device?.picture,
      integrationDomain,
      areaId: device?.area_id || deviceEntities[0]?.areaId,
      entities: deviceEntities,
      unavailableCount: deviceEntities.length,
    });
  }

  devices.sort(
    (left, right) =>
      right.unavailableCount - left.unavailableCount ||
      compareText(left.deviceName, right.deviceName),
  );

  return { devices, ungrouped };
};
