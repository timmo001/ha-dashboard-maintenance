export interface HassEntity {
  entity_id: string;
  last_changed?: string;
  last_updated?: string;
  state: string;
  attributes: {
    device_class?: string;
    friendly_name?: string;
    hidden?: boolean;
    in_progress?: boolean;
    latest_version?: string | null;
    skipped_version?: string | null;
    supported_features?: number;
    title?: string | null;
    visible?: boolean;
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

export interface HomeAssistantMessage {
  type: string;
  endpoint?: string;
  force?: boolean;
  method?: string;
  url_path?: string | null;
}

export interface HomeAssistantConnection {
  // These generics mirror home-assistant-js-websocket, where callers state the message type.
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
  sendMessagePromise<T>(message: HomeAssistantMessage): Promise<T>;
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters
  subscribeMessage<T>(
    callback: (message: T) => void,
    params: HomeAssistantMessage,
  ): Promise<() => void>;
}

export interface HomeAssistantPanel {
  url_path?: string;
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
  panels?: Record<string, HomeAssistantPanel>;
  states: Record<string, HassEntity>;
}

export interface CustomCardSuggestion<
  T extends { type: string } = { type: string },
> {
  label?: string;
  config: T;
}

export interface CustomCardEntry {
  type: string;
  name: string;
  description?: string;
  documentationURL?: string;
  preview?: boolean;
  getEntitySuggestion?: (
    hass: HomeAssistant,
    entityId: string,
  ) => CustomCardSuggestion | CustomCardSuggestion[] | null;
}

export const BATTERY_TILE_FEATURES = ["none", "bar", "trend"] as const;

export type BatteryTileFeature = (typeof BATTERY_TILE_FEATURES)[number];

export const DEFAULT_BATTERY_TILE_FEATURE: BatteryTileFeature = "trend";

export const MAINTENANCE_MODULE_IDS = [
  "system",
  "batteries",
  "repairs",
  "updates",
  "availability",
  "integrations",
  "stale",
] as const;

export type MaintenanceModuleId = (typeof MAINTENANCE_MODULE_IDS)[number];

export const isMaintenanceModuleId = (
  value: unknown,
): value is MaintenanceModuleId =>
  MAINTENANCE_MODULE_IDS.some((id) => id === value);

export interface BatteryThresholdOverride {
  entity_id: string;
  threshold: number;
  note?: string;
}

/** Before `modules`, each module had its own flag. Still read when `modules` is unset. */
type LegacyModuleEnabledFlags = Partial<
  Record<`${MaintenanceModuleId}_enabled`, boolean>
>;

export interface MaintenanceStrategyConfig extends LegacyModuleEnabledFlags {
  type: "custom:maintenance";
  /** The modules shown, in view order. Every module when unset. */
  modules?: MaintenanceModuleId[];
  battery_attention_threshold?: number;
  battery_threshold_overrides?: BatteryThresholdOverride[];
  show_attention_batteries_in_areas?: boolean;
  battery_tile_feature?: BatteryTileFeature;
  availability_safe_list_device_ids?: string[];
  stale_threshold_hours?: number;
}

export type MaintenanceViewMode =
  | "summary"
  | "system"
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

export interface MaintenanceSectionStrategyConfig extends MaintenanceStrategyConfig {
  module?: MaintenanceModuleId;
}

/**
 * The enabled modules, in view order. Without `modules`, every module whose
 * legacy `<module>_enabled` flag isn't false, in the default order.
 */
export const getEnabledModules = (
  config: MaintenanceStrategyConfig,
): MaintenanceModuleId[] =>
  Array.isArray(config.modules)
    ? [...new Set(config.modules.filter(isMaintenanceModuleId))]
    : MAINTENANCE_MODULE_IDS.filter((id) => config[`${id}_enabled`] !== false);

export const isModuleEnabled = (
  config: MaintenanceStrategyConfig,
  module: MaintenanceModuleId,
): boolean => getEnabledModules(config).includes(module);
