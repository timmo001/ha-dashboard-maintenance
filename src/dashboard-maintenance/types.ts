export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    device_class?: string;
    friendly_name?: string;
    [key: string]: unknown;
  };
}

export interface EntityRegistryEntry {
  entity_id: string;
  device_id: string | null;
  disabled_by?: string | null;
  hidden_by?: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
  name_by_user?: string | null;
  name?: string | null;
}

export interface HomeAssistantConnection {
  sendMessagePromise<T>(message: unknown): Promise<T>;
}

export interface HomeAssistant {
  connection?: HomeAssistantConnection;
  entities?: Record<string, EntityRegistryEntry>;
  devices?: Record<string, DeviceRegistryEntry>;
  locale?: {
    language?: string;
  };
  localize?: (
    key: string,
    variables?: Record<string, string | number>,
  ) => string;
  states: Record<string, HassEntity>;
}

export interface MaintenanceStrategyConfig {
  type: "custom:maintenance";
  battery_attention_threshold?: number;
}

export type MaintenanceViewMode = "summary" | "batteries";

export interface MaintenanceViewStrategyConfig extends MaintenanceStrategyConfig {
  icon?: string;
  path?: string;
  title?: string;
  heading_navigation_path?: string;
  view?: MaintenanceViewMode;
}

export interface MaintenanceDashboardStrategyConfig extends MaintenanceStrategyConfig {}
