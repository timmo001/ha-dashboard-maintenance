import {
  type MaintenanceStaleEntity,
  staleEntityIcon,
} from "./stale-data";
import type { LocalizeFunc } from "./localize";
import {
  AREA_ENTITY_NAME,
  ATTENTION_ENTITY_NAME,
  limitAndMakeCards,
  makeEmptyStateSection,
  makeHierarchySections,
  makeSection,
  makeStaleCard,
  SUMMARY_COLUMN_SPAN,
  type LovelaceSectionConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant } from "./types";

export const buildStaleAreaShowMorePath = (areaId: string): string =>
  `stale-area-${areaId}`;

export const makeStaleSummarySection = (
  localize: LocalizeFunc,
  entities: MaintenanceStaleEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig | null => {
  if (entities.length === 0) {
    return null;
  }

  return makeSection(
    localize("stale.heading_not_reporting"),
    staleEntityIcon(),
    limitAndMakeCards(
      localize,
      entities,
      (entity) =>
        makeStaleCard(entity, {
          name: entity.deviceId ? ATTENTION_ENTITY_NAME : entity.displayName,
        }),
      options,
    ),
    SUMMARY_COLUMN_SPAN,
    "stale",
  );
};

export const makeStaleSections = async (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  entities: MaintenanceStaleEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig[]> => {
  if (entities.length === 0) {
    return [
      makeEmptyStateSection(
        localize("stale.empty_no_issues_title"),
        localize("stale.empty_no_issues_content"),
        "mdi:clock-check-outline",
      ),
    ];
  }

  return makeHierarchySections(
    localize,
    hass,
    {
      items: entities,
      makeCard: (entity) =>
        makeStaleCard(entity, {
          name: entity.deviceId ? AREA_ENTITY_NAME : entity.displayName,
        }),
      buildAreaShowMorePath: buildStaleAreaShowMorePath,
      heading: localize("stale.heading_issues"),
      icon: staleEntityIcon(),
      unassignedLabel: "common.other_entities",
      unassignedFallbackLabel: "common.entities",
    },
    options,
  );
};
