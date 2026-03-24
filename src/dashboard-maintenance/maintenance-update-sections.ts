import {
  limitItems,
  MAINTENANCE_COLUMN_SPAN,
  makeShowMoreCard,
  SUMMARY_COLUMN_SPAN,
  type LovelaceSectionConfig,
  makeEmptyStateCard,
  makeSection,
  makeUpdateCard,
} from "./maintenance-view-helpers";
import {
  updateCanInstall,
  updateCanNotInstall,
  type MaintenanceUpdateEntity,
} from "./update-data";

export const makeUpdateSummarySection = (
  updates: MaintenanceUpdateEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig => {
  const summaryUpdates = updates.filter(
    (update) =>
      update.inProgress || update.skippedCurrentVersion || updateCanInstall(update),
  );
  const limitedUpdates = limitItems(summaryUpdates, options?.limit);

  return makeSection(
    "Updates",
    "mdi:package-up",
    summaryUpdates.length > 0
      ? [
          ...limitedUpdates.items.map(makeUpdateCard),
          ...(options?.showMorePath && limitedUpdates.hiddenCount > 0
            ? [makeShowMoreCard(limitedUpdates.hiddenCount, options.showMorePath)]
            : []),
        ]
      : [
          makeEmptyStateCard(
            "No updates available",
            "Home Assistant could not find any update entities that need attention.",
            "mdi:package-up",
          ),
        ],
    SUMMARY_COLUMN_SPAN,
    "updates",
  );
};

export const makeUpdatesSections = (
  updates: MaintenanceUpdateEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig[] => {
  if (updates.length === 0) {
    return [
      makeSection(
        "Updates",
        "mdi:package-up",
        [
          makeEmptyStateCard(
            "No update entities found",
            "Home Assistant could not find any update entities.",
            "mdi:package-up",
          ),
        ],
        MAINTENANCE_COLUMN_SPAN,
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
          "Updates in progress",
          "mdi:progress-download",
          [
            ...limitedInProgress.items.map(makeUpdateCard),
            ...(options?.showMorePath && limitedInProgress.hiddenCount > 0
              ? [makeShowMoreCard(limitedInProgress.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    limitedAvailable.items.length > 0
      ? makeSection(
          "Available updates",
          "mdi:package-up",
          [
            ...limitedAvailable.items.map(makeUpdateCard),
            ...(options?.showMorePath && limitedAvailable.hiddenCount > 0
              ? [makeShowMoreCard(limitedAvailable.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    limitedSkipped.items.length > 0
      ? makeSection(
          "Skipped updates",
          "mdi:skip-next-circle-outline",
          [
            ...limitedSkipped.items.map(makeUpdateCard),
            ...(options?.showMorePath && limitedSkipped.hiddenCount > 0
              ? [makeShowMoreCard(limitedSkipped.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    limitedOther.items.length > 0
      ? makeSection(
          "Other update entities",
          "mdi:package-variant-closed",
          [
            ...limitedOther.items.map(makeUpdateCard),
            ...(options?.showMorePath && limitedOther.hiddenCount > 0
              ? [makeShowMoreCard(limitedOther.hiddenCount, options.showMorePath)]
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
    makeSection(
      "Updates",
      "mdi:package-up",
      [
        makeEmptyStateCard(
          "No updates available",
          "All update entities are currently up to date.",
          "mdi:package-up",
        ),
      ],
      MAINTENANCE_COLUMN_SPAN,
    ),
  ];
};
