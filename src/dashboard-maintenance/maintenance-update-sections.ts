import type { LocalizeFunc } from "./localize";
import { isDefined } from "./entity-helpers";
import {
  limitAndMakeCards,
  MAINTENANCE_COLUMN_SPAN,
  makeEmptyStateSection,
  SUMMARY_COLUMN_SPAN,
  type LovelaceSectionConfig,
  makeSection,
  makeUpdateCard,
} from "./maintenance-view-helpers";
import {
  updateCanInstall,
  updateCanNotInstall,
  type MaintenanceUpdateEntity,
} from "./update-data";

export const makeUpdateSummarySection = (
  localize: LocalizeFunc,
  updates: MaintenanceUpdateEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig | null => {
  const summaryUpdates = updates.filter(
    (update) =>
      update.inProgress || update.skippedCurrentVersion || updateCanInstall(update),
  );

  if (summaryUpdates.length === 0) {
    return null;
  }

  return makeSection(
    localize("update.heading"),
    "mdi:package-up",
    limitAndMakeCards(localize, summaryUpdates, makeUpdateCard, options),
    SUMMARY_COLUMN_SPAN,
    "updates",
  );
};

export const makeUpdatesSections = (
  localize: LocalizeFunc,
  updates: MaintenanceUpdateEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig[] => {
  if (updates.length === 0) {
    return [
      makeEmptyStateSection(
        localize("update.empty_no_entities_title"),
        localize("update.empty_no_entities_content"),
        "mdi:package-up",
      ),
    ];
  }

  const inProgressUpdates = updates.filter((update) => update.inProgress);
  const skippedUpdates = updates.filter(
    (update) => !update.inProgress && update.skippedCurrentVersion,
  );
  const availableUpdates = updates.filter(
    (update) =>
      !update.inProgress &&
      !update.skippedCurrentVersion &&
      updateCanInstall(update),
  );
  const otherUpdates = updates.filter(
    (update) =>
      !update.inProgress &&
      !update.skippedCurrentVersion &&
      updateCanNotInstall(update),
  );

  const sections = [
    inProgressUpdates.length > 0
      ? makeSection(
          localize("update.heading_in_progress"),
          "mdi:progress-download",
          limitAndMakeCards(localize, inProgressUpdates, makeUpdateCard, options),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    availableUpdates.length > 0
      ? makeSection(
          localize("update.heading_available"),
          "mdi:package-up",
          limitAndMakeCards(localize, availableUpdates, makeUpdateCard, options),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    skippedUpdates.length > 0
      ? makeSection(
          localize("update.heading_skipped"),
          "mdi:skip-next-circle-outline",
          limitAndMakeCards(localize, skippedUpdates, makeUpdateCard, options),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    otherUpdates.length > 0
      ? makeSection(
          localize("update.heading_other"),
          "mdi:package-variant-closed",
          limitAndMakeCards(localize, otherUpdates, makeUpdateCard, options),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
  ].filter(isDefined);

  if (sections.length > 0) {
    return sections;
  }

  return [
    makeEmptyStateSection(
      localize("update.empty_no_updates_title"),
      localize("update.empty_up_to_date_content"),
      "mdi:package-up",
    ),
  ];
};
