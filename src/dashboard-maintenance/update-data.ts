import { compareText, computeDomain, isStateVisible } from "./entity-helpers";
import { fetchEntityRegistry } from "./maintenance-data";
import type { HassEntity, HomeAssistant } from "./types";

const UPDATE_FEATURE_INSTALL = 1;

const HOME_ASSISTANT_CORE_TITLE = "Home Assistant Core";
const HOME_ASSISTANT_OS_TITLE = "Home Assistant Operating System";
const HOME_ASSISTANT_SUPERVISOR_TITLE = "Home Assistant Supervisor";

interface UpdateAttributes {
  friendly_name?: string;
  in_progress?: boolean;
  latest_version?: string | null;
  skipped_version?: string | null;
  supported_features?: number;
  title?: string | null;
}

export interface MaintenanceUpdateEntity {
  entityId: string;
  inProgress: boolean;
  isAvailable: boolean;
  isUnavailable: boolean;
  skippedCurrentVersion: boolean;
  supportsInstall: boolean;
  title: string;
}

const asUpdateAttributes = (stateObj: HassEntity): UpdateAttributes =>
  stateObj.attributes as UpdateAttributes;

const updateAvailable = (stateObj: HassEntity, showSkipped = false): boolean => {
  const attributes = asUpdateAttributes(stateObj);

  return stateObj.state === "on" || (showSkipped && !!attributes.skipped_version);
};

const supportsInstall = (stateObj: HassEntity): boolean => {
  const supportedFeatures = Number(asUpdateAttributes(stateObj).supported_features) || 0;

  return (supportedFeatures & UPDATE_FEATURE_INSTALL) !== 0;
};

export const updateCanInstall = (
  update: MaintenanceUpdateEntity,
): boolean => update.isAvailable && update.supportsInstall && !update.isUnavailable;

export const updateCanNotInstall = (
  update: MaintenanceUpdateEntity,
): boolean => update.isAvailable && !update.supportsInstall && !update.isUnavailable;

const isVisibleUpdateEntity = (
  entityId: string,
  entities: Record<string, { disabled_by?: string | null; hidden_by?: string | null }>,
  hasEntityRegistry: boolean,
): boolean => {
  const entry = entities[entityId];

  if (!entry) {
    return !hasEntityRegistry;
  }

  return !entry.disabled_by && !entry.hidden_by;
};

export const getMaintenanceUpdates = async (
  hass: HomeAssistant,
): Promise<MaintenanceUpdateEntity[]> => {
  const entities = await fetchEntityRegistry(hass);
  const hasEntityRegistry = Object.keys(entities).length > 0;

  return (
    Object.values(hass.states)
      .filter(
        (stateObj) =>
          computeDomain(stateObj.entity_id) === "update" &&
          isStateVisible(stateObj) &&
          isVisibleUpdateEntity(stateObj.entity_id, entities, hasEntityRegistry),
      )
      .map((stateObj) => {
        const attributes = asUpdateAttributes(stateObj);
        const title =
          attributes.title || attributes.friendly_name || stateObj.entity_id;
        const skippedCurrentVersion = !!(
          attributes.latest_version &&
          attributes.skipped_version === attributes.latest_version
        );

        return {
          entityId: stateObj.entity_id,
          inProgress: !!attributes.in_progress,
          isAvailable: updateAvailable(stateObj, true),
          isUnavailable:
            stateObj.state === "unavailable" || stateObj.state === "unknown",
          skippedCurrentVersion,
          supportsInstall: supportsInstall(stateObj),
          title,
        };
      })
      .sort((left, right) => {
        if (left.title === HOME_ASSISTANT_CORE_TITLE) {
          return -3;
        }

        if (right.title === HOME_ASSISTANT_CORE_TITLE) {
          return 3;
        }

        if (left.title === HOME_ASSISTANT_OS_TITLE) {
          return -2;
        }

        if (right.title === HOME_ASSISTANT_OS_TITLE) {
          return 2;
        }

        if (left.title === HOME_ASSISTANT_SUPERVISOR_TITLE) {
          return -1;
        }

        if (right.title === HOME_ASSISTANT_SUPERVISOR_TITLE) {
          return 1;
        }

        return compareText(left.title, right.title, hass.locale?.language);
      })
  );
};
