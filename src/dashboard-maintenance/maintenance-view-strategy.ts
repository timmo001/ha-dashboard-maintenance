import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import {
  getMaintenanceBatteryDevices,
  type MaintenanceBatteryDevice,
} from "./maintenance-data";
import type {
  HomeAssistant,
  MaintenanceViewMode,
  MaintenanceViewStrategyConfig,
} from "./types";

type LovelaceCardConfig = Record<string, unknown>;
type LovelaceViewConfig = Record<string, unknown>;
type LovelaceSectionConfig = Record<string, unknown>;

const FULL_WIDTH_COLUMN_SPAN = 3;

const VIEW_DEFAULTS: Record<
  MaintenanceViewMode,
  { icon: string; path: string; title: string }
> = {
  summary: {
    title: "Summary",
    path: "summary",
    icon: "mdi:view-dashboard-outline",
  },
  batteries: {
    title: "Batteries",
    path: "batteries",
    icon: "mdi:battery-heart-variant",
  },
};

const makeHeadingCard = (
  heading: string,
  icon: string,
  navigationPath?: string,
): LovelaceCardConfig => ({
  type: "heading",
  heading,
  heading_style: "title",
  icon,
  ...(navigationPath
    ? {
        tap_action: {
          action: "navigate",
          navigation_path: navigationPath,
        },
      }
    : {}),
});

const makeEmptyStateCard = (
  title: string,
  content: string,
): LovelaceCardConfig => ({
  type: "empty-state",
  icon: "mdi:battery-outline",
  icon_color: "primary",
  content_only: true,
  title,
  content,
});

const makeBatteryCard = (device: MaintenanceBatteryDevice): LovelaceCardConfig => ({
  type: "tile",
  entity: device.entityId,
  name: device.deviceName,
  color: device.needsAttention ? "warning" : undefined,
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

const makeSection = (
  heading: string,
  icon: string,
  cards: LovelaceCardConfig[],
  navigationPath?: string,
): LovelaceSectionConfig => ({
  type: "grid",
  column_span: FULL_WIDTH_COLUMN_SPAN,
  cards: [makeHeadingCard(heading, icon, navigationPath), ...cards],
});

@customElement("ll-strategy-view-maintenance")
export class MaintenanceViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const view = config.view || "batteries";
    const viewDefaults = VIEW_DEFAULTS[view];
    const viewTitle = config.title || viewDefaults.title;
    const viewPath = config.path || viewDefaults.path;
    const viewIcon = config.icon || viewDefaults.icon;
    const batteryDevices = await getMaintenanceBatteryDevices(
      hass,
      config.battery_attention_threshold,
    );

    const attentionDevices = batteryDevices.filter(
      (device) => device.needsAttention,
    );
    const healthyDevices = batteryDevices.filter(
      (device) => !device.needsAttention,
    );

    const contentSections: LovelaceSectionConfig[] =
      view === "summary"
        ? [
            makeSection(
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
                  : attentionDevices.map(makeBatteryCard),
              config.heading_navigation_path,
            ),
          ]
        : batteryDevices.length === 0
          ? [
              makeSection("Battery devices", "mdi:battery-heart-variant", [
                makeEmptyStateCard(
                  "No battery devices found",
                  "Home Assistant could not find any devices with numeric battery sensors.",
                ),
              ]),
            ]
          : [
              ...(attentionDevices.length > 0
                ? [
                    makeSection(
                      "Needs attention",
                      "mdi:alert",
                      attentionDevices.map(makeBatteryCard),
                    ),
                  ]
                : []),
              ...(healthyDevices.length > 0
                ? [
                    makeSection(
                      attentionDevices.length > 0
                        ? "Other batteries"
                        : "Battery devices",
                      attentionDevices.length > 0
                        ? "mdi:battery-check"
                        : "mdi:battery-heart-variant",
                      healthyDevices.map(makeBatteryCard),
                    ),
                  ]
                : []),
            ];

    return {
      type: "sections",
      title: viewTitle,
      path: viewPath,
      icon: viewIcon,
      show_icon_and_title: true,
      max_columns: FULL_WIDTH_COLUMN_SPAN,
      sections: contentSections,
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance": MaintenanceViewStrategy;
  }
}
