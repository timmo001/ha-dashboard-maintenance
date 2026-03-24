import {
  getMaintenanceAvailabilityEntities,
  type MaintenanceAvailabilityEntity,
} from "./availability-data";
import type { LocalizeFunc } from "./localize";
import {
  ATTENTION_ENTITY_NAME,
  limitAndMakeCards,
  makeAvailabilityCard,
  makeEmptyStateSection,
  makeHierarchySections,
  makeSection,
  SUMMARY_COLUMN_SPAN,
  type LovelaceSectionConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant } from "./types";

export const buildAvailabilityAreaShowMorePath = (areaId: string): string =>
  `availability-area-${areaId}`;

export const makeAvailabilitySummarySection = (
  localize: LocalizeFunc,
  entities: MaintenanceAvailabilityEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig | null => {
  if (entities.length === 0) {
    return null;
  }

  return makeSection(
    localize("availability.heading_unavailable_or_unknown"),
    "mdi:help-circle-outline",
    limitAndMakeCards(
      localize,
      entities,
      (entity) =>
        makeAvailabilityCard(entity, {
          name: entity.deviceId ? ATTENTION_ENTITY_NAME : entity.displayName,
        }),
      options,
    ),
    SUMMARY_COLUMN_SPAN,
    "availability",
  );
};

export const makeAvailabilitySections = async (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  entities: MaintenanceAvailabilityEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig[]> => {
  if (entities.length === 0) {
    return [
      makeEmptyStateSection(
        localize("availability.empty_no_issues_title"),
        localize("availability.empty_no_issues_content"),
        "mdi:lan-connect",
      ),
    ];
  }

  return makeHierarchySections(
    localize,
    hass,
    {
      items: entities,
      makeCard: (entity) => makeAvailabilityCard(entity),
      buildAreaShowMorePath: buildAvailabilityAreaShowMorePath,
      heading: localize("availability.heading_issues"),
      icon: "mdi:help-circle-outline",
      unassignedLabel: "common.other_entities",
      unassignedFallbackLabel: "common.entities",
    },
    options,
  );
};

export const getAvailabilitySummaryData = async (
  hass: HomeAssistant,
): Promise<MaintenanceAvailabilityEntity[]> => getMaintenanceAvailabilityEntities(hass);
