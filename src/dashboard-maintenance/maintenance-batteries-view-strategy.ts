import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import { makeBatterySections } from "./maintenance-battery-sections";
import {
  MAINTENANCE_COLUMN_SPAN,
  ATTENTION_BATTERY_NAME,
  limitItems,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  makeBatteryCard,
  makeEmptyStateCard,
  makeSection,
  makeShowMoreSection,
  makeViewConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

const VIEW_ITEM_LIMIT = 24;

@customElement("ll-strategy-view-maintenance-batteries")
export class MaintenanceBatteriesViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const allBatteryDevices = await getMaintenanceBatteryDevices(
      hass,
      config.battery_attention_threshold,
    );
    const limitedBatteryDevices = config.subview
      ? { hiddenCount: 0, items: allBatteryDevices }
      : limitItems(allBatteryDevices, VIEW_ITEM_LIMIT);
    const batteryDevices = limitedBatteryDevices.items;
    const attentionDevices = batteryDevices.filter((device) => device.needsAttention);
    const showAttentionBatteriesInAreas =
      config.show_attention_batteries_in_areas ?? true;
    const areaSectionDevices = showAttentionBatteriesInAreas
      ? batteryDevices
      : batteryDevices.filter((device) => !device.needsAttention);

    const sections: LovelaceSectionConfig[] =
      batteryDevices.length === 0
        ? [
            makeSection(
              "Battery devices",
              "mdi:battery-heart-variant",
              [
                makeEmptyStateCard(
                  "No battery devices found",
                  "Home Assistant could not find any devices with numeric battery sensors.",
                ),
              ],
              MAINTENANCE_COLUMN_SPAN,
            ),
          ]
        : [
            ...(attentionDevices.length > 0
              ? [
                  makeSection(
                    "Needs attention",
                    "mdi:alert",
                    attentionDevices.map((device) =>
                      makeBatteryCard(device, {
                        name: device.deviceId
                          ? ATTENTION_BATTERY_NAME
                          : device.deviceName,
                      }),
                    ),
                    MAINTENANCE_COLUMN_SPAN,
                  ),
                ]
              : []),
            ...(await makeBatterySections(hass, areaSectionDevices)),
            ...(!config.subview && limitedBatteryDevices.hiddenCount > 0
              ? [
                  makeShowMoreSection(
                    limitedBatteryDevices.hiddenCount,
                    "batteries-all",
                    MAINTENANCE_COLUMN_SPAN,
                  ),
                ]
              : []),
          ];

    return makeViewConfig(config, "batteries", sections);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-batteries": MaintenanceBatteriesViewStrategy;
  }
}
