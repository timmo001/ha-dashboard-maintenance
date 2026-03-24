import {
  MAINTENANCE_COLUMN_SPAN,
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
): LovelaceSectionConfig => {
  const summaryUpdates = updates.filter(
    (update) =>
      update.inProgress || update.skippedCurrentVersion || updateCanInstall(update),
  );

  return makeSection(
    "Updates",
    "mdi:package-up",
    summaryUpdates.length > 0
      ? summaryUpdates.map(makeUpdateCard)
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

  const sections = [
    inProgressUpdates.length > 0
      ? makeSection(
          "Updates in progress",
          "mdi:progress-download",
          inProgressUpdates.map(makeUpdateCard),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    availableUpdates.length > 0
      ? makeSection(
          "Available updates",
          "mdi:package-up",
          availableUpdates.map(makeUpdateCard),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    skippedUpdates.length > 0
      ? makeSection(
          "Skipped updates",
          "mdi:skip-next-circle-outline",
          skippedUpdates.map(makeUpdateCard),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    otherUpdates.length > 0
      ? makeSection(
          "Other update entities",
          "mdi:package-variant-closed",
          otherUpdates.map(makeUpdateCard),
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
