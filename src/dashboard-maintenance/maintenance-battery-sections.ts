import type { LocalizeFunc } from "./localize";
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
  localize: LocalizeFunc,
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
          localize,
          shownDevices.hiddenCount,
          buildBatteryAreaShowMorePath(area.area_id),
        ),
      );
    }
  }

  return cards;
};

export const makeBatteryAttentionSection = (
  localize: LocalizeFunc,
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
            localize("battery.empty_no_devices_title"),
            localize("battery.empty_no_devices_content"),
          ),
        ]
      : attentionDevices.length === 0
        ? [
            makeEmptyStateCard(
              localize("battery.empty_no_attention_title"),
              localize("battery.empty_no_attention_content"),
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
                    localize,
                    limitedAttentionDevices.hiddenCount,
                    options.showMorePath,
                  ),
                ]
              : []),
          ];

  return makeSection(
    localize("battery.heading_needing_attention"),
    "mdi:alert",
    cards,
    SUMMARY_COLUMN_SPAN,
    config.heading_navigation_path,
  );
};

export const makeBatterySections = async (
  localize: LocalizeFunc,
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
        localize("battery.heading_devices"),
        "mdi:battery-heart-variant",
        [
          ...limitedDevices.items.map((device) => makeBatteryCard(device)),
          ...(options?.showMorePath && limitedDevices.hiddenCount > 0
            ? [
                makeShowMoreCard(
                  localize,
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
      localize,
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
          makeHeadingCard(
            floorCount > 1 ? floor.name : localize("common.areas"),
            { icon: floorHeadingIcon(floor) },
          ),
          ...areaCards,
        ],
        MAINTENANCE_COLUMN_SPAN,
      ),
    );
  }

  if (hierarchy.areas.length > 0) {
    const areaCards = makeAreaCards(
      localize,
      hierarchy.areas,
      areas,
      hass,
      batteryDevices,
      { limit: options?.limit },
    );

    if (areaCards.length > 0) {
      sections.push(
        makeGridSection(
          [
            makeHeadingCard(
              floorCount > 1
                ? localize("common.other_areas")
                : localize("common.areas"),
            ),
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
          makeHeadingCard(
            sections.length > 0
              ? localize("common.other_devices")
              : localize("common.devices"),
          ),
          ...unassignedCards.items.map((device) => makeBatteryCard(device)),
          ...(options?.showMorePath && unassignedCards.hiddenCount > 0
            ? [makeShowMoreCard(localize, unassignedCards.hiddenCount, options.showMorePath)]
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
      localize("battery.heading_devices"),
      "mdi:battery-heart-variant",
      [
        ...fallbackDevices.items.map((device) => makeBatteryCard(device)),
        ...(options?.showMorePath && fallbackDevices.hiddenCount > 0
          ? [makeShowMoreCard(localize, fallbackDevices.hiddenCount, options.showMorePath)]
          : []),
      ],
      MAINTENANCE_COLUMN_SPAN,
    ),
  ];
};
