import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

type LovelaceCardConfig = Record<string, unknown>;
type LovelaceViewConfig = Record<string, unknown>;

const defaultTitle = "Maintenance";

const makeHeadingCard = (): LovelaceCardConfig => ({
  type: "heading",
  heading: "Devices",
  heading_style: "title",
  icon: "mdi:battery-heart-variant",
});

const makeEmptyStateCard = (): LovelaceCardConfig => ({
  type: "empty-state",
  icon: "mdi:battery-outline",
  icon_color: "primary",
  content_only: true,
  title: "No battery devices found",
  content:
    "Home Assistant could not find any devices with numeric battery sensors.",
});

@customElement("ll-strategy-view-maintenance")
export class MaintenanceViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const batteryDevices = await getMaintenanceBatteryDevices(
      hass,
      config.battery_attention_threshold,
    );

    const cards: LovelaceCardConfig[] =
      batteryDevices.length === 0
        ? [makeEmptyStateCard()]
        : [
            makeHeadingCard(),
            ...batteryDevices.map((device) => ({
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
            })),
          ];

    return {
      type: "sections",
      title: config.title || defaultTitle,
      path: config.path || "maintenance",
      icon: config.icon || "mdi:battery-heart-variant",
      max_columns: 1,
      sections: [
        {
          type: "grid",
          cards,
        },
      ],
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance": MaintenanceViewStrategy;
  }
}
