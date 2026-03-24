import {
  type MaintenanceStaleEntity,
  groupStaleEntitiesByArea,
  staleEntityIcon,
} from "./stale-data";
import type { LocalizeFunc } from "./localize";
import {
  getAreasFloorHierarchy,
  getMaintenanceAreas,
  getMaintenanceFloors,
} from "./maintenance-data";
import {
  ATTENTION_STALE_NAME,
  limitItems,
  MAINTENANCE_COLUMN_SPAN,
  makeEmptyStateSection,
  makeShowMoreCard,
  SUMMARY_COLUMN_SPAN,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
  makeStaleCard,
  makeGridSection,
  makeHeadingCard,
  makeSection,
} from "./maintenance-view-helpers";
import type { AreaRegistryEntry, FloorRegistryEntry, HomeAssistant } from "./types";

const floorHeadingIcon = (floor: FloorRegistryEntry): string =>
  floor.icon || "mdi:floor-plan";

export const buildStaleAreaShowMorePath = (areaId: string): string =>
  `stale-area-${areaId}`;

const makeAreaCards = (
  localize: LocalizeFunc,
  areaIds: string[],
  areas: Record<string, AreaRegistryEntry>,
  hass: HomeAssistant,
  entities: MaintenanceStaleEntity[],
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

    const areaEntities = groupStaleEntitiesByArea(areaId, entities);
    if (areaEntities.length === 0) {
      continue;
    }

    const shownEntities = limitItems(areaEntities, options?.limit);
    if (shownEntities.items.length === 0) {
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

    cards.push(...shownEntities.items.map((entity) => makeStaleCard(entity)));
    if (shownEntities.hiddenCount > 0) {
      cards.push(
        makeShowMoreCard(
          localize,
          shownEntities.hiddenCount,
          buildStaleAreaShowMorePath(area.area_id),
        ),
      );
    }
  }

  return cards;
};

export const makeStaleSummarySection = (
  localize: LocalizeFunc,
  entities: MaintenanceStaleEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig | null => {
  if (entities.length === 0) {
    return null;
  }

  const limitedEntities = limitItems(entities, options?.limit);

  return makeSection(
    localize("stale.heading_not_reporting"),
    staleEntityIcon(),
    [
      ...limitedEntities.items.map((entity) =>
        makeStaleCard(entity, {
          name: entity.deviceId ? ATTENTION_STALE_NAME : entity.displayName,
        }),
      ),
      ...(options?.showMorePath && limitedEntities.hiddenCount > 0
        ? [
            makeShowMoreCard(
              localize,
              limitedEntities.hiddenCount,
              options.showMorePath,
            ),
          ]
        : []),
    ],
    SUMMARY_COLUMN_SPAN,
    "stale",
  );
};

export const makeStaleSections = async (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  entities: MaintenanceStaleEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig[]> => {
  if (entities.length === 0) {
    return [
      makeEmptyStateSection(
        localize("stale.empty_no_issues_title"),
        localize("stale.empty_no_issues_content"),
        "mdi:clock-check-outline",
      ),
    ];
  }

  const [areas, floors] = await Promise.all([
    getMaintenanceAreas(hass),
    getMaintenanceFloors(hass),
  ]);

  if (Object.keys(areas).length === 0) {
    const limitedEntities = limitItems(entities, options?.limit);

    return [
      makeSection(
        localize("stale.heading_issues"),
        staleEntityIcon(),
        [
          ...limitedEntities.items.map((entity) => makeStaleCard(entity)),
          ...(options?.showMorePath && limitedEntities.hiddenCount > 0
            ? [
                makeShowMoreCard(
                  localize,
                  limitedEntities.hiddenCount,
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

    const areaCards = makeAreaCards(localize, floorStructure.areas, areas, hass, entities, {
      limit: options?.limit,
    });
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
    const areaCards = makeAreaCards(localize, hierarchy.areas, areas, hass, entities, {
      limit: options?.limit,
    });

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

  const unassignedEntities = entities.filter((entity) => !entity.areaId);
  const unassignedCards = limitItems(unassignedEntities, options?.limit);

  if (unassignedCards.items.length > 0) {
    sections.push(
      makeGridSection(
        [
          makeHeadingCard(
            sections.length > 0
              ? localize("common.other_entities")
              : localize("common.entities"),
          ),
          ...unassignedCards.items.map((entity) => makeStaleCard(entity)),
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

  const fallbackEntities = limitItems(entities, options?.limit);

  return [
    makeSection(
      localize("stale.heading_issues"),
      staleEntityIcon(),
      [
        ...fallbackEntities.items.map((entity) => makeStaleCard(entity)),
        ...(options?.showMorePath && fallbackEntities.hiddenCount > 0
          ? [makeShowMoreCard(localize, fallbackEntities.hiddenCount, options.showMorePath)]
          : []),
      ],
      MAINTENANCE_COLUMN_SPAN,
    ),
  ];
};
