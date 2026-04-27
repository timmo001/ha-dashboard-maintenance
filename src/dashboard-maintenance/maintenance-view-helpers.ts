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
import type { MaintenanceRepairIssue } from "./repairs-data";
import {
  staleEntityIcon,
  type MaintenanceStaleEntity,
} from "./stale-data";
import type { MaintenanceUpdateEntity } from "./update-data";
import { updateCanInstall } from "./update-data";
import type {
  AreaRegistryEntry,
  ConfigEntry,
  FloorRegistryEntry,
  HomeAssistant,
  MaintenanceViewMode,
  MaintenanceViewStrategyConfig,
} from "./types";

export type LovelaceCardConfig = Record<string, unknown>;
export type LovelaceViewConfig = Record<string, unknown>;
export type LovelaceSectionConfig = Record<string, unknown>;
export type EntityNameItem =
  | { type: "entity" | "device" | "area" | "floor" }
  | { type: "text"; text: string };

export interface HeadingCardOptions {
  headingStyle?: "title" | "subtitle";
  icon?: string;
  navigationPath?: string;
}

export interface TileCardOptions {
  name?: string | EntityNameItem[];
  features?: unknown[];
}

export type NameOnlyTileOptions = Pick<TileCardOptions, "name">;

export interface LimitOptions {
  limit?: number;
}

export interface LimitAndShowMoreOptions extends LimitOptions {
  showMorePath?: string;
}

interface AreaScopedItem {
  areaId?: string | null;
}

// ---------------------------------------------------------------------------
// Layout defaults
// ---------------------------------------------------------------------------

export const SUMMARY_COLUMN_SPAN = 3;
export const MAINTENANCE_COLUMN_SPAN = 3;

// ---------------------------------------------------------------------------
// Tile naming presets
// ---------------------------------------------------------------------------

export const NAME_AREA_DEVICE_ENTITY: EntityNameItem[] = [
  { type: "area" },
  { type: "device" },
  { type: "entity" },
];

export const NAME_AREA_DEVICE: EntityNameItem[] = [
  { type: "area" },
  { type: "device" },
];

export const NAME_DEVICE: EntityNameItem[] = [
  { type: "device" },
];

export const NAME_DEVICE_ENTITY: EntityNameItem[] = [
  { type: "device" },
  { type: "entity" },
];

// ---------------------------------------------------------------------------
// Tile naming aliases by view context
// ---------------------------------------------------------------------------

export const ATTENTION_BATTERY_NAME = NAME_AREA_DEVICE;
export const AREA_BATTERY_NAME = NAME_DEVICE;
export const AVAILABILITY_ENTITY_NAME = NAME_AREA_DEVICE_ENTITY;
export const STALE_ENTITY_NAME = NAME_DEVICE_ENTITY;

export const batteryAttentionTileName = (
  device: MaintenanceBatteryDevice,
): string | EntityNameItem[] =>
  device.deviceId ? ATTENTION_BATTERY_NAME : device.deviceName;

export const batteryAreaTileName = (
  device: MaintenanceBatteryDevice,
): string | EntityNameItem[] =>
  device.deviceId ? AREA_BATTERY_NAME : device.deviceName;

export const availabilityEntityTileName = (): EntityNameItem[] =>
  AVAILABILITY_ENTITY_NAME;

export const staleEntityTileName = (
  entity: MaintenanceStaleEntity,
): string | EntityNameItem[] =>
  entity.deviceId ? STALE_ENTITY_NAME : entity.displayName;

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
  integrations: {
    columnSpan: MAINTENANCE_COLUMN_SPAN,
    titleKey: "view.integrations",
    path: "integrations",
    icon: "mdi:puzzle",
  },
};

// ---------------------------------------------------------------------------
// Low-level card builders
// ---------------------------------------------------------------------------

export const makeHeadingCard = (
  heading: string,
  options?: HeadingCardOptions,
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

const makeShortcutCard = (
  label: string,
  description: string,
  icon: string,
  navigationPath: string,
): LovelaceCardConfig => ({
  type: "shortcut",
  label,
  description,
  icon,
  grid_options: {
    columns: 6,
  },
  tap_action: {
    action: "navigate",
    navigation_path: navigationPath,
  },
});

const makeTileCard = (
  entity: TileCardEntity,
  icon: string | undefined,
  options?: TileCardOptions,
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
  options?: NameOnlyTileOptions,
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

/**
 * Opens the integration page with the config entry row highlighted (HA reads hash as URLSearchParams).
 * Optional `subentryId` is included for forward compatibility if the UI gains hash support.
 */
export const configEntryNavigationPath = (
  domain: string,
  entryId: string,
  subentryId?: string,
): string => {
  const base = `/config/integrations/integration/${encodeURIComponent(domain)}`;
  const params = new URLSearchParams();
  params.set("config_entry", entryId);
  if (subentryId) {
    params.set("subentry", subentryId);
  }
  return `${base}#${params.toString()}`;
};

const INTEGRATION_STATE_LABEL: Partial<Record<string, TranslationKey>> = {
  setup_error: "integration.state.setup_error",
  migration_error: "integration.state.migration_error",
  setup_retry: "integration.state.setup_retry",
  failed_unload: "integration.state.failed_unload",
};

export const makeIntegrationEntryCard = (
  localize: LocalizeFunc,
  entry: ConfigEntry,
  options?: {
    representativeEntityId?: string;
    subentryId?: string;
  },
): LovelaceCardConfig => {
  const domain = entry.domain;
  const navPath = configEntryNavigationPath(domain, entry.entry_id, options?.subentryId);
  const stateKey = entry.state ? INTEGRATION_STATE_LABEL[entry.state] : undefined;
  const stateText = stateKey ? localize(stateKey) : (entry.state ?? "");
  const subtitle = entry.reason?.trim() ? `${stateText}: ${entry.reason.trim()}` : stateText;
  const fallbackEntity = options?.representativeEntityId ?? `${domain}.integration`;

  return makeShortcutCard(
    entry.title || domain,
    subtitle,
    computeDomainIcon(fallbackEntity),
    navPath,
  );
};

export const makeAvailabilityCard = (
  entity: MaintenanceAvailabilityEntity,
  options?: NameOnlyTileOptions,
): LovelaceCardConfig =>
  makeTileCard(entity, availabilityIssueIcon(entity), options);

export const makeStaleCard = (
  entity: MaintenanceStaleEntity,
  options?: NameOnlyTileOptions,
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
  options?: LimitAndShowMoreOptions,
): LovelaceCardConfig[] =>
  makeLimitedCards(
    localize,
    items,
    makeCard,
    options?.showMorePath,
    options?.limit,
  );

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

export const makeEmptyStateSection = (
  title: string,
  content: string,
  icon: string,
): LovelaceSectionConfig =>
  makeGridSection([
    {
      ...makeEmptyStateCard(title, content, icon),
      grid_options: { columns: 12 },
    },
  ], 1);

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

// ---------------------------------------------------------------------------
// Generic area-cards builder (replaces 3 near-identical makeAreaCards functions)
// ---------------------------------------------------------------------------

const floorHeadingIcon = (floor: FloorRegistryEntry): string =>
  floor.icon || "mdi:floor-plan";

const makeAreaHeadingCard = (
  area: AreaRegistryEntry,
  hass: HomeAssistant,
): LovelaceCardConfig =>
  makeHeadingCard(area.name, {
    headingStyle: "subtitle",
    navigationPath: hass.panels?.home ? `/home/areas-${area.area_id}` : undefined,
  });

const makeLimitedCards = <T,>(
  localize: LocalizeFunc,
  items: T[],
  makeCard: (item: T) => LovelaceCardConfig,
  showMorePath?: string,
  limit?: number,
): LovelaceCardConfig[] => {
  const { items: shown, hiddenCount } = limitItems(items, limit);

  return [
    ...shown.map(makeCard),
    ...(showMorePath && hiddenCount > 0
      ? [makeShowMoreCard(localize, hiddenCount, showMorePath)]
      : []),
  ];
};

const makeAreaCards = <T extends AreaScopedItem>(
  localize: LocalizeFunc,
  areaIds: string[],
  areas: Record<string, AreaRegistryEntry>,
  hass: HomeAssistant,
  items: T[],
  makeCard: (item: T) => LovelaceCardConfig,
  buildShowMorePath: (areaId: string) => string,
  options?: LimitOptions,
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

    cards.push(makeAreaHeadingCard(area, hass));

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

const makeFloorSection = <T extends AreaScopedItem>(
  localize: LocalizeFunc,
  hass: HomeAssistant,
  config: HierarchySectionsConfig<T>,
  floor: FloorRegistryEntry,
  areaIds: string[],
  areas: Record<string, AreaRegistryEntry>,
  floorCount: number,
  limit?: number,
): LovelaceSectionConfig | null => {
  const areaCards = makeAreaCards(
    localize,
    areaIds,
    areas,
    hass,
    config.items,
    config.makeCard,
    config.buildAreaShowMorePath,
    { limit },
  );

  if (areaCards.length === 0) {
    return null;
  }

  return makeGridSection(
    [
      makeHeadingCard(floorCount > 1 ? floor.name : localize("common.areas"), {
        icon: floorHeadingIcon(floor),
      }),
      ...areaCards,
    ],
    MAINTENANCE_COLUMN_SPAN,
  );
};

const makeTopLevelAreasSection = <T extends AreaScopedItem>(
  localize: LocalizeFunc,
  hass: HomeAssistant,
  config: HierarchySectionsConfig<T>,
  areaIds: string[],
  areas: Record<string, AreaRegistryEntry>,
  floorCount: number,
  limit?: number,
): LovelaceSectionConfig | null => {
  const areaCards = makeAreaCards(
    localize,
    areaIds,
    areas,
    hass,
    config.items,
    config.makeCard,
    config.buildAreaShowMorePath,
    { limit },
  );

  if (areaCards.length === 0) {
    return null;
  }

  return makeGridSection(
    [
      makeHeadingCard(
        floorCount > 1 ? localize("common.other_areas") : localize("common.areas"),
      ),
      ...areaCards,
    ],
    MAINTENANCE_COLUMN_SPAN,
  );
};

const makeUnassignedSection = <T extends AreaScopedItem>(
  localize: LocalizeFunc,
  config: HierarchySectionsConfig<T>,
  sections: LovelaceSectionConfig[],
  options?: LimitAndShowMoreOptions,
): LovelaceSectionConfig | null => {
  const unassignedItems = config.items.filter((item) => !item.areaId);
  if (unassignedItems.length === 0) {
    return null;
  }

  return makeGridSection(
    [
      makeHeadingCard(
        sections.length > 0
          ? localize(config.unassignedLabel)
          : localize(config.unassignedFallbackLabel),
      ),
      ...makeLimitedCards(
        localize,
        unassignedItems,
        config.makeCard,
        options?.showMorePath,
        options?.limit,
      ),
    ],
    MAINTENANCE_COLUMN_SPAN,
  );
};

const makeFlatFallbackSection = <T extends AreaScopedItem>(
  localize: LocalizeFunc,
  config: HierarchySectionsConfig<T>,
  options?: LimitAndShowMoreOptions,
): LovelaceSectionConfig =>
  makeSection(
    config.heading,
    config.icon,
    limitAndMakeCards(localize, config.items, config.makeCard, options),
    MAINTENANCE_COLUMN_SPAN,
  );

export const makeHierarchySections = async <T extends AreaScopedItem>(
  localize: LocalizeFunc,
  hass: HomeAssistant,
  config: HierarchySectionsConfig<T>,
  options?: LimitAndShowMoreOptions,
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

    const floorSection = makeFloorSection(
      localize,
      hass,
      config,
      floor,
      floorStructure.areas,
      areas,
      floorCount,
      options?.limit,
    );

    if (floorSection) {
      sections.push(floorSection);
    }
  }

  if (hierarchy.areas.length > 0) {
    const topLevelAreasSection = makeTopLevelAreasSection(
      localize,
      hass,
      config,
      hierarchy.areas,
      areas,
      floorCount,
      options?.limit,
    );

    if (topLevelAreasSection) {
      sections.push(topLevelAreasSection);
    }
  }

  const unassignedSection = makeUnassignedSection(localize, config, sections, options);
  if (unassignedSection) {
    sections.push(unassignedSection);
  }

  if (sections.length > 0) {
    return sections;
  }

  // Fallback: flat list when no items match any area
  return [makeFlatFallbackSection(localize, config, options)];
};

// ---------------------------------------------------------------------------
// Device shortcut card builder (for availability device grouping)
// ---------------------------------------------------------------------------

export const makeAvailabilityDeviceCard = (
  device: MaintenanceAvailabilityDevice,
  subtitle: string,
): LovelaceCardConfig => {
  return makeShortcutCard(
    device.deviceName,
    subtitle,
    computeDomainIcon(device.entities[0].entityId),
    `/config/devices/device/${device.deviceId}`,
  );
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
