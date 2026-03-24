import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import {
  getAreasFloorHierarchy,
  getMaintenanceBatteryDevices,
  getMaintenanceAreas,
  getMaintenanceFloors,
  type MaintenanceBatteryDevice,
} from "./maintenance-data";
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
    icon: "mdi:view-dashboard-outline",
  },
  batteries: {
    columnSpan: BATTERIES_COLUMN_SPAN,
    title: "Batteries",
    path: "batteries",
    icon: "mdi:battery-heart-variant",
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
): LovelaceCardConfig => ({
  type: "empty-state",
  icon: "mdi:battery-outline",
  icon_color: "primary",
  content_only: true,
  title,
  content,
});

const makeBatteryCard = (device: MaintenanceBatteryDevice): LovelaceCardConfig => ({
  type: "tile",
  entity: device.entityId,
  name: device.deviceName,
  color: device.needsAttention ? "warning" : undefined,
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
    cards.push(...areaDevices.map(makeBatteryCard));
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
        batteryDevices.map(makeBatteryCard),
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
    .map(makeBatteryCard);

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
        batteryDevices.map(makeBatteryCard),
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

    const contentSections: LovelaceSectionConfig[] =
      view === "summary"
        ? [
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
                  : attentionDevices.map(makeBatteryCard),
              SUMMARY_COLUMN_SPAN,
              config.heading_navigation_path,
            ),
          ]
        : batteryDevices.length === 0
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
                    attentionDevices.map(makeBatteryCard),
                    BATTERIES_COLUMN_SPAN,
                  ),
                ]
              : []),
            ...(await makeBatterySections(hass, areaSectionDevices)),
          ];

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
