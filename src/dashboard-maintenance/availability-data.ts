import {
  compareText,
  computeDomain,
  computeEntityDisplayName,
  isAvailabilityIssue,
  isDefined,
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
