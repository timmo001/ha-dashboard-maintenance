import type { MaintenanceBatteryDevice } from "./maintenance-data";
import {
  availabilityIssueIcon,
  type MaintenanceAvailabilityEntity,
} from "./availability-data";
import type { MaintenanceUpdateEntity } from "./update-data";
import { updateCanInstall } from "./update-data";
import type {
  MaintenanceViewMode,
  MaintenanceViewStrategyConfig,
} from "./types";

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
];

export const ATTENTION_AVAILABILITY_NAME: EntityNameItem[] = [
  { type: "area" },
  { type: "device" },
  { type: "entity" },
];

export const VIEW_DEFAULTS: Record<
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
    columnSpan: MAINTENANCE_COLUMN_SPAN,
    title: "Batteries",
    path: "batteries",
    icon: "mdi:battery-heart-variant",
  },
  updates: {
    columnSpan: MAINTENANCE_COLUMN_SPAN,
    title: "Updates",
    path: "updates",
    icon: "mdi:package-up",
  },
  availability: {
    columnSpan: MAINTENANCE_COLUMN_SPAN,
    title: "Availability",
    path: "availability",
    icon: "mdi:help-circle-outline",
  },
};

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

export const makeBatteryCard = (
  device: MaintenanceBatteryDevice,
  options?: { name?: string | EntityNameItem[] },
): LovelaceCardConfig => ({
  type: "tile",
  entity: device.entityId,
  name: options?.name || device.deviceName,
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

export const makeShowMoreCard = (
  hiddenCount: number,
  navigationPath: string,
): LovelaceCardConfig => ({
  ...makeHeadingCard(`Show ${hiddenCount} more`, {
    headingStyle: "subtitle",
    icon: "mdi:chevron-right",
    navigationPath,
  }),
  grid_options: {
    rows: "auto",
  },
});

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

export const makeAvailabilityCard = (
  entity: MaintenanceAvailabilityEntity,
  options?: { name?: string | EntityNameItem[] },
): LovelaceCardConfig => ({
  type: "tile",
  entity: entity.entityId,
  name: options?.name || entity.displayName,
  icon: availabilityIssueIcon(entity),
  tap_action: entity.deviceId
    ? {
        action: "navigate",
        navigation_path: `/config/devices/device/${entity.deviceId}`,
      }
    : { action: "more-info" },
});

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
  hiddenCount: number,
  navigationPath: string,
  columnSpan: number,
): LovelaceSectionConfig =>
  makeGridSection([makeShowMoreCard(hiddenCount, navigationPath)], columnSpan);

export const makeViewConfig = (
  config: MaintenanceViewStrategyConfig,
  view: MaintenanceViewMode,
  sections: LovelaceSectionConfig[],
): LovelaceViewConfig => {
  const defaults = VIEW_DEFAULTS[view];

  return {
    type: "sections",
    title: config.title || defaults.title,
    path: config.path || defaults.path,
    icon: config.icon || defaults.icon,
    ...(config.subview ? { subview: true } : {}),
    show_icon_and_title: true,
    max_columns: defaults.columnSpan,
    sections,
  };
};
