import {
  getAreasFloorHierarchy,
  getMaintenanceAreas,
  getMaintenanceFloors,
  type MaintenanceBatteryDevice,
} from "./maintenance-data";
import {
  ATTENTION_BATTERY_NAME,
  limitItems,
  MAINTENANCE_COLUMN_SPAN,
  makeShowMoreCard,
  SUMMARY_COLUMN_SPAN,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  makeBatteryCard,
  makeEmptyStateCard,
  makeGridSection,
  makeHeadingCard,
  makeSection,
} from "./maintenance-view-helpers";
import type {
  AreaRegistryEntry,
  FloorRegistryEntry,
  HomeAssistant,
  MaintenanceViewStrategyConfig,
} from "./types";

const floorHeadingIcon = (floor: FloorRegistryEntry): string =>
  floor.icon || "mdi:floor-plan";

export const buildBatteryAreaShowMorePath = (areaId: string): string =>
  `batteries-area-${areaId}`;

const makeAreaCards = (
  areaIds: string[],
  areas: Record<string, AreaRegistryEntry>,
  hass: HomeAssistant,
  devices: MaintenanceBatteryDevice[],
  options?: {
    limit?: number;
  },
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

    const shownDevices = limitItems(areaDevices, options?.limit);

    if (shownDevices.items.length === 0) {
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

    cards.push(...shownDevices.items.map((device) => makeBatteryCard(device)));
    if (shownDevices.hiddenCount > 0) {
      cards.push(
        makeShowMoreCard(
          shownDevices.hiddenCount,
          buildBatteryAreaShowMorePath(area.area_id),
        ),
      );
    }
  }

  return cards;
};

export const makeBatteryAttentionSection = (
  batteryDevices: MaintenanceBatteryDevice[],
  config: MaintenanceViewStrategyConfig,
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig => {
  const attentionDevices = batteryDevices.filter((device) => device.needsAttention);
  const limitedAttentionDevices = limitItems(attentionDevices, options?.limit);
  const cards =
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
        : [
            ...limitedAttentionDevices.items.map((device) =>
              makeBatteryCard(device, {
                name: device.deviceId ? ATTENTION_BATTERY_NAME : device.deviceName,
              }),
            ),
            ...(options?.showMorePath && limitedAttentionDevices.hiddenCount > 0
              ? [
                  makeShowMoreCard(
                    limitedAttentionDevices.hiddenCount,
                    options.showMorePath,
                  ),
                ]
              : []),
          ];

  return makeSection(
    "Batteries needing attention",
    "mdi:alert",
    cards,
    SUMMARY_COLUMN_SPAN,
    config.heading_navigation_path,
  );
};

export const makeBatterySections = async (
  hass: HomeAssistant,
  batteryDevices: MaintenanceBatteryDevice[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig[]> => {
  if (batteryDevices.length === 0) {
    return [];
  }

  const [areas, floors] = await Promise.all([
    getMaintenanceAreas(hass),
    getMaintenanceFloors(hass),
  ]);

  if (Object.keys(areas).length === 0) {
    const limitedDevices = limitItems(batteryDevices, options?.limit);

    return [
      makeSection(
        "Battery devices",
        "mdi:battery-heart-variant",
        [
          ...limitedDevices.items.map((device) => makeBatteryCard(device)),
          ...(options?.showMorePath && limitedDevices.hiddenCount > 0
            ? [
                makeShowMoreCard(
                  limitedDevices.hiddenCount,
                  options.showMorePath,
                ),
              ]
            : []),
        ],
        MAINTENANCE_COLUMN_SPAN,
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
      { limit: options?.limit },
    );
    if (areaCards.length === 0) {
      continue;
    }

    sections.push(
      makeGridSection(
        [
          makeHeadingCard(floorCount > 1 ? floor.name : "Areas", {
            icon: floorHeadingIcon(floor),
          }),
          ...areaCards,
        ],
        MAINTENANCE_COLUMN_SPAN,
      ),
    );
  }

  if (hierarchy.areas.length > 0) {
    const areaCards = makeAreaCards(hierarchy.areas, areas, hass, batteryDevices, {
      limit: options?.limit,
    });

    if (areaCards.length > 0) {
      sections.push(
        makeGridSection(
          [
            makeHeadingCard(floorCount > 1 ? "Other areas" : "Areas"),
            ...areaCards,
          ],
          MAINTENANCE_COLUMN_SPAN,
        ),
      );
    }
  }

  const unassignedDevices = batteryDevices.filter((device) => !device.areaId);
  const unassignedCards = limitItems(unassignedDevices, options?.limit);

  if (unassignedCards.items.length > 0) {
    sections.push(
      makeGridSection(
        [
          makeHeadingCard(sections.length > 0 ? "Other devices" : "Devices"),
          ...unassignedCards.items.map((device) => makeBatteryCard(device)),
          ...(options?.showMorePath && unassignedCards.hiddenCount > 0
            ? [makeShowMoreCard(unassignedCards.hiddenCount, options.showMorePath)]
            : []),
        ],
        MAINTENANCE_COLUMN_SPAN,
      ),
    );
  }

  if (sections.length > 0) {
    return sections;
  }

  const fallbackDevices = limitItems(batteryDevices, options?.limit);

  return [
    makeSection(
      "Battery devices",
      "mdi:battery-heart-variant",
      [
        ...fallbackDevices.items.map((device) => makeBatteryCard(device)),
        ...(options?.showMorePath && fallbackDevices.hiddenCount > 0
          ? [makeShowMoreCard(fallbackDevices.hiddenCount, options.showMorePath)]
          : []),
      ],
      MAINTENANCE_COLUMN_SPAN,
    ),
  ];
};
