import {
  type MaintenanceAvailabilityEntity,
  getMaintenanceAvailabilityEntities,
  groupAvailabilityEntitiesByArea,
} from "./availability-data";
import {
  getAreasFloorHierarchy,
  getMaintenanceAreas,
  getMaintenanceFloors,
} from "./maintenance-data";
import {
  ATTENTION_AVAILABILITY_NAME,
  limitItems,
  MAINTENANCE_COLUMN_SPAN,
  makeShowMoreCard,
  SUMMARY_COLUMN_SPAN,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  makeAvailabilityCard,
  makeEmptyStateCard,
  makeGridSection,
  makeHeadingCard,
  makeSection,
} from "./maintenance-view-helpers";
import type { AreaRegistryEntry, FloorRegistryEntry, HomeAssistant } from "./types";

const floorHeadingIcon = (floor: FloorRegistryEntry): string =>
  floor.icon || "mdi:floor-plan";

const makeAreaCards = (
  areaIds: string[],
  areas: Record<string, AreaRegistryEntry>,
  hass: HomeAssistant,
  entities: MaintenanceAvailabilityEntity[],
): LovelaceCardConfig[] => {
  const cards: LovelaceCardConfig[] = [];

  for (const areaId of areaIds) {
    const area = areas[areaId];
    if (!area) {
      continue;
    }

    const areaEntities = groupAvailabilityEntitiesByArea(areaId, entities);
    if (areaEntities.length === 0) {
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
    cards.push(...areaEntities.map((entity) => makeAvailabilityCard(entity)));
  }

  return cards;
};

export const makeAvailabilitySummarySection = (
  entities: MaintenanceAvailabilityEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig => {
  const limitedEntities = limitItems(entities, options?.limit);

  return makeSection(
    "Unavailable or unknown",
    "mdi:help-circle-outline",
    entities.length > 0
      ? [
          ...limitedEntities.items.map((entity) =>
            makeAvailabilityCard(entity, {
              name: entity.deviceId ? ATTENTION_AVAILABILITY_NAME : entity.displayName,
            }),
          ),
          ...(options?.showMorePath && limitedEntities.hiddenCount > 0
            ? [
                makeShowMoreCard(
                  limitedEntities.hiddenCount,
                  options.showMorePath,
                ),
              ]
            : []),
        ]
      : [
          makeEmptyStateCard(
            "No availability issues",
            "Home Assistant could not find any unavailable or unknown entities.",
            "mdi:lan-connect",
          ),
        ],
    SUMMARY_COLUMN_SPAN,
    "availability",
  );
};

export const makeAvailabilitySections = async (
  hass: HomeAssistant,
  entities: MaintenanceAvailabilityEntity[],
): Promise<LovelaceSectionConfig[]> => {
  if (entities.length === 0) {
    return [
      makeSection(
        "Availability",
        "mdi:lan-connect",
        [
          makeEmptyStateCard(
            "No availability issues",
            "Home Assistant could not find any unavailable or unknown entities.",
            "mdi:lan-connect",
          ),
        ],
        MAINTENANCE_COLUMN_SPAN,
      ),
    ];
  }

  const [areas, floors] = await Promise.all([
    getMaintenanceAreas(hass),
    getMaintenanceFloors(hass),
  ]);

  if (Object.keys(areas).length === 0) {
    return [
      makeSection(
        "Availability issues",
        "mdi:help-circle-outline",
        entities.map((entity) => makeAvailabilityCard(entity)),
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

    const areaCards = makeAreaCards(floorStructure.areas, areas, hass, entities);
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
    const areaCards = makeAreaCards(hierarchy.areas, areas, hass, entities);

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

  const unassignedCards = entities
    .filter((entity) => !entity.areaId)
    .map((entity) => makeAvailabilityCard(entity));

  if (unassignedCards.length > 0) {
    sections.push(
      makeGridSection(
        [
          makeHeadingCard(sections.length > 0 ? "Other entities" : "Entities"),
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
      "Availability issues",
      "mdi:help-circle-outline",
      entities.map((entity) => makeAvailabilityCard(entity)),
      MAINTENANCE_COLUMN_SPAN,
    ),
  ];
};

export const getAvailabilitySummaryData = async (
  hass: HomeAssistant,
): Promise<MaintenanceAvailabilityEntity[]> => getMaintenanceAvailabilityEntities(hass);
