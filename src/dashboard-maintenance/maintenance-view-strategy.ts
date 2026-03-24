import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import {
  getAreasFloorHierarchy,
  getMaintenanceBatteryDevices,
  getMaintenanceAreas,
  getMaintenanceFloors,
  type MaintenanceBatteryDevice,
} from "./maintenance-data";
import {
  getMaintenanceUpdates,
  updateCanInstall,
  updateCanNotInstall,
  type MaintenanceUpdateEntity,
} from "./update-data";
import type {
  AreaRegistryEntry,
  FloorRegistryEntry,
  HomeAssistant,
  MaintenanceViewMode,
  MaintenanceViewStrategyConfig,
} from "./types";

type LovelaceCardConfig = Record<string, unknown>;
type LovelaceViewConfig = Record<string, unknown>;
type LovelaceSectionConfig = Record<string, unknown>;

const SUMMARY_COLUMN_SPAN = 3;
const BATTERIES_COLUMN_SPAN = 3;

const VIEW_DEFAULTS: Record<
  MaintenanceViewMode,
  { columnSpan: number; icon: string; path: string; title: string }
> = {
  summary: {
    columnSpan: SUMMARY_COLUMN_SPAN,
    title: "Summary",
    path: "summary",
    icon: "mdi:home-heart",
  },
  batteries: {
    columnSpan: BATTERIES_COLUMN_SPAN,
    title: "Batteries",
    path: "batteries",
    icon: "mdi:battery-heart-variant",
  },
  updates: {
    columnSpan: BATTERIES_COLUMN_SPAN,
    title: "Updates",
    path: "updates",
    icon: "mdi:package-up",
  },
};

const makeHeadingCard = (
  heading: string,
  options?: {
    headingStyle?: "title" | "subtitle";
    icon?: string;
    navigationPath?: string;
  },
): LovelaceCardConfig => ({
  type: "heading",
  heading,
  heading_style: options?.headingStyle || "title",
  ...(options?.icon ? { icon: options.icon } : {}),
  ...(options?.navigationPath
    ? {
        tap_action: {
          action: "navigate",
          navigation_path: options.navigationPath,
        },
      }
    : {}),
});

const makeEmptyStateCard = (
  title: string,
  content: string,
  icon = "mdi:battery-outline",
): LovelaceCardConfig => ({
  type: "empty-state",
  icon,
  icon_color: "primary",
  content_only: true,
  title,
  content,
});

const makeBatteryCard = (device: MaintenanceBatteryDevice): LovelaceCardConfig => ({
  type: "tile",
  entity: device.entityId,
  name: device.deviceName,
  icon: device.needsAttention ? "mdi:battery-alert-variant-outline" : undefined,
  tap_action: device.deviceId
    ? {
        action: "navigate",
        navigation_path: `/config/devices/device/${device.deviceId}`,
      }
    : { action: "more-info" },
  features: [
    {
      type: "bar-gauge",
      min: 0,
      max: 100,
    },
  ],
});

const makeUpdateCard = (update: MaintenanceUpdateEntity): LovelaceCardConfig => ({
  type: "tile",
  entity: update.entityId,
  name: update.title,
  grid_options: {
    columns: 12,
  },
  tap_action: { action: "more-info" },
  features: updateCanInstall(update)
    ? [
        {
          type: "update-actions",
          backup: "ask",
        },
      ]
    : [],
});

const makeUpdateSummarySection = (
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

const makeUpdatesSections = (
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
        BATTERIES_COLUMN_SPAN,
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
          BATTERIES_COLUMN_SPAN,
        )
      : undefined,
    availableUpdates.length > 0
      ? makeSection(
          "Available updates",
          "mdi:package-up",
          availableUpdates.map(makeUpdateCard),
          BATTERIES_COLUMN_SPAN,
        )
      : undefined,
    skippedUpdates.length > 0
      ? makeSection(
          "Skipped updates",
          "mdi:skip-next-circle-outline",
          skippedUpdates.map(makeUpdateCard),
          BATTERIES_COLUMN_SPAN,
        )
      : undefined,
    otherUpdates.length > 0
      ? makeSection(
          "Other update entities",
          "mdi:package-variant-closed",
          otherUpdates.map(makeUpdateCard),
          BATTERIES_COLUMN_SPAN,
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
      BATTERIES_COLUMN_SPAN,
    ),
  ];
};

const makeGridSection = (
  cards: LovelaceCardConfig[],
  columnSpan: number,
): LovelaceSectionConfig => ({
  type: "grid",
  column_span: columnSpan,
  cards,
});

const makeSection = (
  heading: string,
  icon: string,
  cards: LovelaceCardConfig[],
  columnSpan: number,
  navigationPath?: string,
): LovelaceSectionConfig => ({
  ...makeGridSection(
    [
      makeHeadingCard(heading, {
        icon,
        navigationPath,
      }),
      ...cards,
    ],
    columnSpan,
  ),
});

const floorHeadingIcon = (floor: FloorRegistryEntry): string =>
  floor.icon || "mdi:floor-plan";

const makeAreaCards = (
  areaIds: string[],
  areas: Record<string, AreaRegistryEntry>,
  hass: HomeAssistant,
  devices: MaintenanceBatteryDevice[],
): LovelaceCardConfig[] => {
  const cards: LovelaceCardConfig[] = [];

  for (const areaId of areaIds) {
    const area = areas[areaId];
    if (!area) {
      continue;
    }

    const areaDevices = devices.filter((device) => device.areaId === areaId);
    if (areaDevices.length === 0) {
      continue;
    }

    cards.push(
      makeHeadingCard(area.name, {
        headingStyle: "subtitle",
        navigationPath: hass.panels?.home
          ? `/home/areas-${area.area_id}`
          : undefined,
      }),
    );
    cards.push(...areaDevices.map((device) => makeBatteryCard(device)));
  }

  return cards;
};

const makeBatterySections = async (
  hass: HomeAssistant,
  batteryDevices: MaintenanceBatteryDevice[],
): Promise<LovelaceSectionConfig[]> => {
  if (batteryDevices.length === 0) {
    return [];
  }

  const [areas, floors] = await Promise.all([
    getMaintenanceAreas(hass),
    getMaintenanceFloors(hass),
  ]);

  if (Object.keys(areas).length === 0) {
    return [
      makeSection(
        "Battery devices",
        "mdi:battery-heart-variant",
        batteryDevices.map((device) => makeBatteryCard(device)),
        BATTERIES_COLUMN_SPAN,
      ),
    ];
  }

  const hierarchy = getAreasFloorHierarchy(areas, floors);
  const floorCount =
    hierarchy.floors.length + (hierarchy.areas.length > 0 ? 1 : 0);
  const sections: LovelaceSectionConfig[] = [];

  for (const floorStructure of hierarchy.floors) {
    const floor = floors[floorStructure.id];
    if (!floor) {
      continue;
    }

    const areaCards = makeAreaCards(
      floorStructure.areas,
      areas,
      hass,
      batteryDevices,
    );
    if (areaCards.length === 0) {
      continue;
    }

    sections.push(
      makeGridSection(
        [
          makeHeadingCard(
            floorCount > 1 ? floor.name : "Areas",
            { icon: floorHeadingIcon(floor) },
          ),
          ...areaCards,
        ],
        BATTERIES_COLUMN_SPAN,
      ),
    );
  }

  if (hierarchy.areas.length > 0) {
    const areaCards = makeAreaCards(
      hierarchy.areas,
      areas,
      hass,
      batteryDevices,
    );

    if (areaCards.length > 0) {
      sections.push(
        makeGridSection(
          [
            makeHeadingCard(
              floorCount > 1 ? "Other areas" : "Areas",
            ),
            ...areaCards,
          ],
          BATTERIES_COLUMN_SPAN,
        ),
      );
    }
  }

  const unassignedCards = batteryDevices
    .filter((device) => !device.areaId)
    .map((device) => makeBatteryCard(device));

  if (unassignedCards.length > 0) {
    sections.push(
      makeGridSection(
        [
          makeHeadingCard(sections.length > 0 ? "Other devices" : "Devices"),
          ...unassignedCards,
        ],
        BATTERIES_COLUMN_SPAN,
      ),
    );
  }

  if (sections.length === 0) {
    return [
      makeSection(
        "Battery devices",
        "mdi:battery-heart-variant",
        batteryDevices.map((device) => makeBatteryCard(device)),
        BATTERIES_COLUMN_SPAN,
      ),
    ];
  }

  return sections;
};

@customElement("ll-strategy-view-maintenance")
export class MaintenanceViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const view = config.view || "batteries";
    const viewDefaults = VIEW_DEFAULTS[view];
    const viewColumnSpan = viewDefaults.columnSpan;
    const viewTitle = config.title || viewDefaults.title;
    const viewPath = config.path || viewDefaults.path;
    const viewIcon = config.icon || viewDefaults.icon;
    let contentSections: LovelaceSectionConfig[];

    if (view === "summary") {
      const [batteryDevices, updates] = await Promise.all([
        getMaintenanceBatteryDevices(hass, config.battery_attention_threshold),
        getMaintenanceUpdates(hass),
      ]);
      const attentionDevices = batteryDevices.filter(
        (device) => device.needsAttention,
      );

      contentSections = [
        makeSection(
          "Batteries needing attention",
          "mdi:alert",
          batteryDevices.length === 0
            ? [
                makeEmptyStateCard(
                  "No battery devices found",
                  "Home Assistant could not find any devices with numeric battery sensors.",
                ),
              ]
            : attentionDevices.length === 0
              ? [
                  makeEmptyStateCard(
                    "No batteries need attention",
                    "All battery devices are at or above the attention threshold.",
                  ),
                ]
              : attentionDevices.map((device) => makeBatteryCard(device)),
          SUMMARY_COLUMN_SPAN,
          config.heading_navigation_path,
        ),
        makeUpdateSummarySection(updates),
      ];
    } else if (view === "updates") {
      contentSections = makeUpdatesSections(getMaintenanceUpdates(hass));
    } else {
      const batteryDevices = await getMaintenanceBatteryDevices(
        hass,
        config.battery_attention_threshold,
      );
      const attentionDevices = batteryDevices.filter(
        (device) => device.needsAttention,
      );
      const showAttentionBatteriesInAreas =
        config.show_attention_batteries_in_areas ?? true;
      const areaSectionDevices = showAttentionBatteriesInAreas
        ? batteryDevices
        : batteryDevices.filter((device) => !device.needsAttention);

      contentSections =
        batteryDevices.length === 0
          ? [
              makeSection(
                "Battery devices",
                "mdi:battery-heart-variant",
                [
                  makeEmptyStateCard(
                    "No battery devices found",
                    "Home Assistant could not find any devices with numeric battery sensors.",
                  ),
                ],
                BATTERIES_COLUMN_SPAN,
              ),
            ]
          : [
              ...(attentionDevices.length > 0
                ? [
                    makeSection(
                      "Needs attention",
                      "mdi:alert",
                      attentionDevices.map((device) => makeBatteryCard(device)),
                      BATTERIES_COLUMN_SPAN,
                    ),
                  ]
                : []),
              ...(await makeBatterySections(hass, areaSectionDevices)),
            ];
    }

    return {
      type: "sections",
      title: viewTitle,
      path: viewPath,
      icon: viewIcon,
      show_icon_and_title: true,
      max_columns: viewColumnSpan,
      sections: contentSections,
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance": MaintenanceViewStrategy;
  }
}
