import {
  getAreasFloorHierarchy,
  getMaintenanceAreas,
  getMaintenanceFloors,
  type MaintenanceBatteryDevice,
} from "./maintenance-data";
import {
  ATTENTION_BATTERY_NAME,
  MAINTENANCE_COLUMN_SPAN,
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

export const makeBatteryAttentionSection = (
  batteryDevices: MaintenanceBatteryDevice[],
  config: MaintenanceViewStrategyConfig,
): LovelaceSectionConfig => {
  const attentionDevices = batteryDevices.filter((device) => device.needsAttention);

  return makeSection(
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
        : attentionDevices.map((device) =>
            makeBatteryCard(device, {
              name: device.deviceId ? ATTENTION_BATTERY_NAME : device.deviceName,
            }),
          ),
    SUMMARY_COLUMN_SPAN,
    config.heading_navigation_path,
  );
};

export const makeBatterySections = async (
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
    const areaCards = makeAreaCards(hierarchy.areas, areas, hass, batteryDevices);

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
        MAINTENANCE_COLUMN_SPAN,
      ),
    );
  }

  if (sections.length > 0) {
    return sections;
  }

  return [
    makeSection(
      "Battery devices",
      "mdi:battery-heart-variant",
      batteryDevices.map((device) => makeBatteryCard(device)),
      MAINTENANCE_COLUMN_SPAN,
    ),
  ];
};
