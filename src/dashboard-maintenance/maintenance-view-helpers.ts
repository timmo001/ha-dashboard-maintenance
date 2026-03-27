import { computeDomainIcon, groupItemsByArea } from "./entity-helpers";
import type { LocalizeFunc, TranslationKey } from "./localize";
import type { MaintenanceBatteryDevice } from "./maintenance-data";
import {
  getAreasFloorHierarchy,
  getMaintenanceAreas,
  getMaintenanceFloors,
} from "./maintenance-data";
import {
  availabilityIssueIcon,
  type MaintenanceAvailabilityDevice,
  type MaintenanceAvailabilityEntity,
} from "./availability-data";
import { severityIcon, type MaintenanceRepairIssue } from "./repairs-data";
import {
  staleEntityIcon,
  type MaintenanceStaleEntity,
} from "./stale-data";
import type { MaintenanceUpdateEntity } from "./update-data";
import { updateCanInstall } from "./update-data";
import type {
  AreaRegistryEntry,
  FloorRegistryEntry,
  HomeAssistant,
  MaintenanceViewMode,
  MaintenanceViewStrategyConfig,
} from "./types";

// ---------------------------------------------------------------------------
// Brand access token for integration icons
// ---------------------------------------------------------------------------

let brandsAccessToken: string | null = null;

/**
 * Fetch the brands access token from Home Assistant.
 * This token is required for the /api/brands/... proxy endpoints.
 */
export const fetchBrandsAccessToken = async (
  hass: HomeAssistant,
): Promise<string | null> => {
  if (brandsAccessToken) {
    return brandsAccessToken;
  }

  if (!hass.connection) {
    return null;
  }

  try {
    const result = await hass.connection.sendMessagePromise<{ token: string }>({
      type: "brands/access_token",
    });
    brandsAccessToken = result.token;
    return brandsAccessToken;
  } catch {
    return null;
  }
};

export type LovelaceCardConfig = Record<string, unknown>;
export type LovelaceViewConfig = Record<string, unknown>;
export type LovelaceSectionConfig = Record<string, unknown>;
export type EntityNameItem =
  | { type: "entity" | "device" | "area" | "floor" }
  | { type: "text"; text: string };

export const SUMMARY_COLUMN_SPAN = 3;
export const MAINTENANCE_COLUMN_SPAN = 3;

export const ATTENTION_BATTERY_NAME: EntityNameItem[] = [
  { type: "area" },
  { type: "device" },
  { type: "entity" },
];

export const ATTENTION_ENTITY_NAME: EntityNameItem[] = [
  { type: "area" },
  { type: "device" },
  { type: "entity" },
];

export const AREA_BATTERY_NAME: EntityNameItem[] = [
  { type: "device" },
];

export const AREA_ENTITY_NAME: EntityNameItem[] = [
  { type: "device" },
  { type: "entity" },
];

export const VIEW_DEFAULTS: Record<
  MaintenanceViewMode,
  { columnSpan: number; icon: string; path: string; titleKey: TranslationKey }
> = {
  summary: {
    columnSpan: SUMMARY_COLUMN_SPAN,
    titleKey: "view.summary",
    path: "summary",
    icon: "mdi:home-heart",
  },
  batteries: {
    columnSpan: MAINTENANCE_COLUMN_SPAN,
    titleKey: "view.batteries",
    path: "batteries",
    icon: "mdi:battery-heart-variant",
  },
  updates: {
    columnSpan: MAINTENANCE_COLUMN_SPAN,
    titleKey: "view.updates",
    path: "updates",
    icon: "mdi:package-up",
  },
  repairs: {
    columnSpan: MAINTENANCE_COLUMN_SPAN,
    titleKey: "view.repairs",
    path: "repairs",
    icon: "mdi:wrench",
  },
  stale: {
    columnSpan: MAINTENANCE_COLUMN_SPAN,
    titleKey: "view.stale",
    path: "stale",
    icon: "mdi:clock-alert-outline",
  },
  availability: {
    columnSpan: MAINTENANCE_COLUMN_SPAN,
    titleKey: "view.availability",
    path: "availability",
    icon: "mdi:help-circle-outline",
  },
};

// ---------------------------------------------------------------------------
// Low-level card builders
// ---------------------------------------------------------------------------

export const makeHeadingCard = (
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

export const makeEmptyStateCard = (
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

export const makeShowMoreCard = (
  localize: LocalizeFunc,
  hiddenCount: number,
  navigationPath: string,
): LovelaceCardConfig => ({
  ...makeHeadingCard(localize("common.show_count_more", { count: hiddenCount }), {
    headingStyle: "subtitle",
    icon: "mdi:chevron-right",
    navigationPath,
  }),
  grid_options: {
    rows: "auto",
  },
});

// ---------------------------------------------------------------------------
// Generic tile card builder
// ---------------------------------------------------------------------------

interface TileCardEntity {
  entityId: string;
  deviceId?: string;
  displayName: string;
}

const makeTileCard = (
  entity: TileCardEntity,
  icon: string | undefined,
  options?: { name?: string | EntityNameItem[]; features?: unknown[] },
): LovelaceCardConfig => ({
  type: "tile",
  entity: entity.entityId,
  name: options?.name || entity.displayName,
  ...(icon ? { icon } : {}),
  tap_action: { action: "more-info" },
  ...(entity.deviceId
    ? {
        hold_action: {
          action: "navigate",
          navigation_path: `/config/devices/device/${entity.deviceId}`,
        },
      }
    : {}),
  ...(options?.features ? { features: options.features } : {}),
});

// ---------------------------------------------------------------------------
// Entity-type card builders (thin wrappers around makeTileCard)
// ---------------------------------------------------------------------------

export const makeBatteryCard = (
  device: MaintenanceBatteryDevice,
  options?: { name?: string | EntityNameItem[] },
): LovelaceCardConfig =>
  makeTileCard(
    { entityId: device.entityId, deviceId: device.deviceId, displayName: device.deviceName },
    device.needsAttention ? "mdi:battery-alert-variant-outline" : undefined,
    {
      ...options,
      ...(device.level !== null
        ? { features: [{ type: "bar-gauge", min: 0, max: 100 }] }
        : {}),
    },
  );

export const makeUpdateCard = (
  update: MaintenanceUpdateEntity,
): LovelaceCardConfig => ({
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

export const makeRepairCard = (
  localize: LocalizeFunc,
  issue: MaintenanceRepairIssue,
): LovelaceCardConfig => {
  const severityLabel = localize(
    `repair.severity_${issue.severity}` as Parameters<LocalizeFunc>[0],
  );
  const learnMoreLink = issue.learnMoreUrl
    ? ` [↗](${issue.learnMoreUrl})`
    : "";

  return {
    type: "markdown",
    content: `**${issue.title}**${learnMoreLink}\n\n${issue.integrationName} · ${severityLabel}`,
    grid_options: {
      columns: 12,
    },
  };
};

export const makeAvailabilityCard = (
  entity: MaintenanceAvailabilityEntity,
  options?: { name?: string | EntityNameItem[] },
): LovelaceCardConfig =>
  makeTileCard(entity, availabilityIssueIcon(entity), options);

export const makeStaleCard = (
  entity: MaintenanceStaleEntity,
  options?: { name?: string | EntityNameItem[] },
): LovelaceCardConfig =>
  makeTileCard(entity, staleEntityIcon(), options);

// ---------------------------------------------------------------------------
// Item limiting & show-more helpers
// ---------------------------------------------------------------------------

export const limitItems = <T,>(
  items: T[],
  limit?: number,
): { hiddenCount: number; items: T[] } => {
  if (limit === undefined || items.length <= limit) {
    return { hiddenCount: 0, items };
  }

  return {
    hiddenCount: items.length - limit,
    items: items.slice(0, limit),
  };
};

/** Limit items, map to cards, and append a show-more card when items are truncated. */
export const limitAndMakeCards = <T,>(
  localize: LocalizeFunc,
  items: T[],
  makeCard: (item: T) => LovelaceCardConfig,
  options?: { limit?: number; showMorePath?: string },
): LovelaceCardConfig[] => {
  const { items: shown, hiddenCount } = limitItems(items, options?.limit);
  const cards = shown.map(makeCard);

  if (options?.showMorePath && hiddenCount > 0) {
    cards.push(makeShowMoreCard(localize, hiddenCount, options.showMorePath));
  }

  return cards;
};

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

export const makeEmptyStateSection = (
  title: string,
  content: string,
  icon: string,
): LovelaceSectionConfig =>
  makeGridSection(
    [
      {
        type: "empty-state",
        icon,
        content_only: true,
        title,
        content,
        grid_options: { columns: 12 },
      },
    ],
    1,
  );

export const makeGridSection = (
  cards: LovelaceCardConfig[],
  columnSpan: number,
): LovelaceSectionConfig => ({
  type: "grid",
  column_span: columnSpan,
  cards,
});

export const makeSection = (
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

export const makeShowMoreSection = (
  localize: LocalizeFunc,
  hiddenCount: number,
  navigationPath: string,
  columnSpan: number,
): LovelaceSectionConfig =>
  makeGridSection(
    [makeShowMoreCard(localize, hiddenCount, navigationPath)],
    columnSpan,
  );

// ---------------------------------------------------------------------------
// Generic area-cards builder (replaces 3 near-identical makeAreaCards functions)
// ---------------------------------------------------------------------------

export const floorHeadingIcon = (floor: FloorRegistryEntry): string =>
  floor.icon || "mdi:floor-plan";

export const makeAreaCards = <T extends { areaId?: string | null }>(
  localize: LocalizeFunc,
  areaIds: string[],
  areas: Record<string, AreaRegistryEntry>,
  hass: HomeAssistant,
  items: T[],
  makeCard: (item: T) => LovelaceCardConfig,
  buildShowMorePath: (areaId: string) => string,
  options?: { limit?: number },
): LovelaceCardConfig[] => {
  const cards: LovelaceCardConfig[] = [];

  for (const areaId of areaIds) {
    const area = areas[areaId];
    if (!area) {
      continue;
    }

    const areaItems = groupItemsByArea(areaId, items);
    if (areaItems.length === 0) {
      continue;
    }

    const shown = limitItems(areaItems, options?.limit);
    if (shown.items.length === 0) {
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

    cards.push(...shown.items.map(makeCard));
    if (shown.hiddenCount > 0) {
      cards.push(
        makeShowMoreCard(localize, shown.hiddenCount, buildShowMorePath(area.area_id)),
      );
    }
  }

  return cards;
};

// ---------------------------------------------------------------------------
// Generic floor/area hierarchy sections builder
// ---------------------------------------------------------------------------

export interface HierarchySectionsConfig<T> {
  items: T[];
  makeCard: (item: T) => LovelaceCardConfig;
  buildAreaShowMorePath: (areaId: string) => string;
  heading: string;
  icon: string;
  /** Label for items not assigned to an area when area sections exist. */
  unassignedLabel: TranslationKey;
  /** Label for items not assigned to an area when no area sections exist. */
  unassignedFallbackLabel: TranslationKey;
}

export const makeHierarchySections = async <T extends { areaId?: string | null }>(
  localize: LocalizeFunc,
  hass: HomeAssistant,
  config: HierarchySectionsConfig<T>,
  options?: { limit?: number; showMorePath?: string },
): Promise<LovelaceSectionConfig[]> => {
  if (config.items.length === 0) {
    return [];
  }

  const [areas, floors] = await Promise.all([
    getMaintenanceAreas(hass),
    getMaintenanceFloors(hass),
  ]);

  if (Object.keys(areas).length === 0) {
    return [
      makeSection(
        config.heading,
        config.icon,
        limitAndMakeCards(localize, config.items, config.makeCard, options),
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
      config.items,
      config.makeCard,
      config.buildAreaShowMorePath,
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
      config.items,
      config.makeCard,
      config.buildAreaShowMorePath,
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

  const unassignedItems = config.items.filter((item) => !item.areaId);
  const unassignedCards = limitItems(unassignedItems, options?.limit);

  if (unassignedCards.items.length > 0) {
    sections.push(
      makeGridSection(
        [
          makeHeadingCard(
            sections.length > 0
              ? localize(config.unassignedLabel)
              : localize(config.unassignedFallbackLabel),
          ),
          ...unassignedCards.items.map(config.makeCard),
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

  // Fallback: flat list when no items match any area
  return [
    makeSection(
      config.heading,
      config.icon,
      limitAndMakeCards(localize, config.items, config.makeCard, options),
      MAINTENANCE_COLUMN_SPAN,
    ),
  ];
};

// ---------------------------------------------------------------------------
// Device tile card builder (for availability device grouping)
// ---------------------------------------------------------------------------

/**
 * Build a custom card that represents a device with availability issues.
 * Uses the `dm-availability-device-card` custom element so we can display
 * the device name and an arbitrary entity-count subtitle — something the
 * built-in tile card cannot do.
 *
 * Shows the integration brand icon via HA's proxy if a token is available,
 * otherwise falls back to the entity's domain icon.
 */
export const makeAvailabilityDeviceCard = (
  device: MaintenanceAvailabilityDevice,
  subtitle: string,
  brandsToken?: string | null,
  options?: {
    enableSafeToggle?: boolean;
  },
): LovelaceCardConfig => {
  const domain = device.integrationDomain || device.entities[0].entityId.split(".")[0];
  const picture = brandsToken
    ? `/api/brands/integration/${domain}/icon.png?token=${brandsToken}`
    : null;

  return {
    type: "custom:dm-availability-device-card",
    device_id: device.deviceId,
    device_name: device.deviceName,
    subtitle,
    picture,
    icon: computeDomainIcon(device.entities[0].entityId),
    grid_options: {
      columns: 6,
    },
    enable_safe_toggle: options?.enableSafeToggle === true,
    navigation_path: `/config/devices/device/${device.deviceId}`,
  };
};

// ---------------------------------------------------------------------------
// View strategy helpers
// ---------------------------------------------------------------------------

/** Build subview limit options, returning undefined for subviews (which show all items). */
export const viewLimitOptions = (
  config: MaintenanceViewStrategyConfig,
  allPath: string,
  limit = 24,
): { limit: number; showMorePath: string } | undefined =>
  config.subview ? undefined : { limit, showMorePath: allPath };

export const makeViewConfig = (
  localize: LocalizeFunc,
  config: MaintenanceViewStrategyConfig,
  view: MaintenanceViewMode,
  sections: LovelaceSectionConfig[],
  options?: { maxColumns?: number },
): LovelaceViewConfig => {
  const defaults = VIEW_DEFAULTS[view];

  return {
    type: "sections",
    title: config.title || localize(defaults.titleKey),
    path: config.path || defaults.path,
    icon: config.icon || defaults.icon,
    ...(config.subview ? { subview: true } : {}),
    show_icon_and_title: true,
    max_columns: options?.maxColumns ?? defaults.columnSpan,
    sections,
  };
};
