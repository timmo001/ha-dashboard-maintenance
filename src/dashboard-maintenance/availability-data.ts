import {
  compareText,
  computeDeviceName,
  computeDomain,
  computeEntityDisplayName,
  isEntityRegistryVisible,
  isAvailabilityIssue,
  isDefined,
  parseTimestamp,
  resolveStateContext,
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

export const normalizeAvailabilitySafeListDeviceIds = (
  deviceIds?: string[],
): string[] => {
  if (!deviceIds?.length) {
    return [];
  }

  return [...new Set(deviceIds.map((deviceId) => deviceId.trim()).filter(Boolean))];
};

export interface MaintenanceAvailabilityEntity {
  areaId?: string | null;
  deviceId?: string;
  displayName: string;
  entityId: string;
  lastChanged?: string;
  state: "unavailable";
}

const isRelevantAvailabilityIssue = (
  stateObj: HassEntity,
): stateObj is HassEntity & { state: "unavailable" } =>
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
  safeListDeviceIds?: string[],
): Promise<MaintenanceAvailabilityEntity[]> => {
  const safeListDeviceIdSet = new Set(
    normalizeAvailabilitySafeListDeviceIds(safeListDeviceIds),
  );
  const [entities, devices, configEntries, mostUsedEntities] = await Promise.all([
    fetchEntityRegistry(hass),
    fetchDeviceRegistry(hass),
    fetchConfigEntries(hass),
    getCommonControlUsagePrediction(hass),
  ]);
  const hasEntityRegistry = Object.keys(entities).length > 0;
  const mostUsedEntityOrder = new Map(
    mostUsedEntities.map((entityId, index) => [entityId, index]),
  );

  return Object.values(hass.states)
    .filter(isRelevantAvailabilityIssue)
    .map<MaintenanceAvailabilityEntity | undefined>((stateObj) => {
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
      const relatedConfigEntryIds = new Set<string>(
        [
          entry?.config_entry_id,
          device?.primary_config_entry,
          ...(device?.config_entries ?? []),
        ].filter((configEntryId): configEntryId is string => Boolean(configEntryId)),
      );
      const hasDisabledConfigEntry = [...relatedConfigEntryIds].some(
        (configEntryId) => configEntries[configEntryId]?.disabled_by,
      );

      if (
        (entry && !isEntityRegistryVisible(entry)) ||
        device?.disabled_by ||
        hasDisabledConfigEntry
      ) {
        return undefined;
      }

      if (
        stateObj.state === "unavailable" &&
        deviceId &&
        safeListDeviceIdSet.has(deviceId)
      ) {
        return undefined;
      }

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

const availabilityHeadingIcon = (): string => "mdi:lan-disconnect";

const hasAvailabilityIssues = (
  entities: MaintenanceAvailabilityEntity[],
): boolean => entities.length > 0;

const isAvailabilityDomainRelevant = (entityId: string): boolean =>
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
