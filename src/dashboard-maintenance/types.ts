export interface HassEntity {
  entity_id: string;
  last_changed?: string;
  last_updated?: string;
  state: string;
  attributes: {
    device_class?: string;
    friendly_name?: string;
    [key: string]: unknown;
  };
}

export interface EntityRegistryEntry {
  entity_id: string;
  config_entry_id?: string | null;
  device_id: string | null;
  area_id?: string | null;
  hidden?: boolean;
  disabled_by?: string | null;
  hidden_by?: string | null;
  name?: string | null;
  original_name?: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
  area_id?: string | null;
  disabled_by?: string | null;
  name_by_user?: string | null;
  name?: string | null;
  picture?: string | null;
  primary_config_entry?: string | null;
  config_entries?: string[];
}

export interface AreaRegistryEntry {
  area_id: string;
  floor_id?: string | null;
  icon?: string | null;
  name: string;
}

export interface FloorRegistryEntry {
  floor_id: string;
  icon?: string | null;
  name: string;
}

export interface ConfigEntry {
  entry_id: string;
  disabled_by?: string | null;
  domain: string;
  title: string;
  state?: string;
  /** Raw error detail when `state` is an error state (may be shown in the UI). */
  reason?: string | null;
}

export interface HomeAssistantConnection {
  sendMessagePromise<T>(message: unknown): Promise<T>;
}

export interface HomeAssistant {
  connection?: HomeAssistantConnection;
  areas?: Record<string, AreaRegistryEntry>;
  entities?: Record<string, EntityRegistryEntry>;
  devices?: Record<string, DeviceRegistryEntry>;
  floors?: Record<string, FloorRegistryEntry>;
  configEntries?: {
    entries: ConfigEntry[];
  };
  locale?: {
    language?: string;
  };
  localize?: (
    key: string,
    variables?: Record<string, string | number>,
  ) => string;
  panels?: Record<string, unknown>;
  states: Record<string, HassEntity>;
}

export const BATTERY_TILE_FEATURES = ["none", "bar", "trend"] as const;
export type BatteryTileFeature = (typeof BATTERY_TILE_FEATURES)[number];

export const DEFAULT_BATTERY_TILE_FEATURE: BatteryTileFeature = "bar";

export type MaintenanceModuleId =
  | "batteries"
  | "repairs"
  | "updates"
  | "availability"
  | "stale"
  | "integrations";

export interface MaintenanceStrategyConfig {
  type: "custom:maintenance";
  batteries_enabled?: boolean;
  battery_attention_threshold?: number;
  show_attention_batteries_in_areas?: boolean;
  battery_tile_feature?: BatteryTileFeature;
  repairs_enabled?: boolean;
  updates_enabled?: boolean;
  availability_enabled?: boolean;
  availability_safe_list_device_ids?: string[];
  stale_enabled?: boolean;
  stale_threshold_hours?: number;
  integrations_enabled?: boolean;
}

export type MaintenanceViewMode =
  | "summary"
  | "batteries"
  | "repairs"
  | "updates"
  | "availability"
  | "stale"
  | "integrations";

export interface MaintenanceViewStrategyConfig extends MaintenanceStrategyConfig {
  area_id?: string;
  icon?: string;
  path?: string;
  title?: string;
  heading_navigation_path?: string;
  subview?: boolean;
  view?: MaintenanceViewMode;
}

export interface MaintenanceDashboardStrategyConfig extends MaintenanceStrategyConfig {}

/** Returns true when a module is enabled (defaults to true when unset). */
export const isModuleEnabled = (
  config: MaintenanceStrategyConfig,
  module: MaintenanceModuleId,
): boolean => config[`${module}_enabled`] !== false;
