import type { LocalizeFunc } from "./localize";
import {
  limitItems,
  MAINTENANCE_COLUMN_SPAN,
  makeEmptyStateSection,
  makeShowMoreCard,
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

  const limitedUpdates = limitItems(summaryUpdates, options?.limit);

  return makeSection(
    localize("update.heading"),
    "mdi:package-up",
    [
      ...limitedUpdates.items.map(makeUpdateCard),
      ...(options?.showMorePath && limitedUpdates.hiddenCount > 0
        ? [makeShowMoreCard(localize, limitedUpdates.hiddenCount, options.showMorePath)]
        : []),
    ],
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

  const limitedInProgress = limitItems(inProgressUpdates, options?.limit);
  const limitedAvailable = limitItems(availableUpdates, options?.limit);
  const limitedSkipped = limitItems(skippedUpdates, options?.limit);
  const limitedOther = limitItems(otherUpdates, options?.limit);

  const sections = [
    limitedInProgress.items.length > 0
      ? makeSection(
          localize("update.heading_in_progress"),
          "mdi:progress-download",
          [
            ...limitedInProgress.items.map(makeUpdateCard),
            ...(options?.showMorePath && limitedInProgress.hiddenCount > 0
              ? [makeShowMoreCard(localize, limitedInProgress.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    limitedAvailable.items.length > 0
      ? makeSection(
          localize("update.heading_available"),
          "mdi:package-up",
          [
            ...limitedAvailable.items.map(makeUpdateCard),
            ...(options?.showMorePath && limitedAvailable.hiddenCount > 0
              ? [makeShowMoreCard(localize, limitedAvailable.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    limitedSkipped.items.length > 0
      ? makeSection(
          localize("update.heading_skipped"),
          "mdi:skip-next-circle-outline",
          [
            ...limitedSkipped.items.map(makeUpdateCard),
            ...(options?.showMorePath && limitedSkipped.hiddenCount > 0
              ? [makeShowMoreCard(localize, limitedSkipped.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    limitedOther.items.length > 0
      ? makeSection(
          localize("update.heading_other"),
          "mdi:package-variant-closed",
          [
            ...limitedOther.items.map(makeUpdateCard),
            ...(options?.showMorePath && limitedOther.hiddenCount > 0
              ? [makeShowMoreCard(localize, limitedOther.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
  ].filter(Boolean) as LovelaceSectionConfig[];

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
