import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import {
  makeBatteryAttentionSection,
  makeBatterySections,
} from "./maintenance-battery-sections";
import {
  MAINTENANCE_COLUMN_SPAN,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  makeEmptyStateCard,
  makeSection,
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
    const batteryDevices = config.area_id
      ? allBatteryDevices.filter((device) => device.areaId === config.area_id)
      : allBatteryDevices;
    const attentionDevices = batteryDevices.filter((device) => device.needsAttention);
    const showAttentionBatteriesInAreas =
      config.show_attention_batteries_in_areas ?? true;
    const areaSectionDevices = showAttentionBatteriesInAreas
      ? batteryDevices
      : batteryDevices.filter((device) => !device.needsAttention);
    const sections: LovelaceSectionConfig[] = [];

    if (batteryDevices.length === 0) {
      sections.push(
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
      );
    } else {
      if (!config.area_id && attentionDevices.length > 0) {
        sections.push(
          makeBatteryAttentionSection(
            batteryDevices,
            config,
            config.subview
              ? undefined
              : {
                  limit: VIEW_ITEM_LIMIT,
                  showMorePath: "batteries-all",
                },
          ),
        );
      }

      sections.push(
        ...(await makeBatterySections(
          hass,
          areaSectionDevices,
          config.subview
            ? undefined
            : {
                limit: VIEW_ITEM_LIMIT,
                showMorePath: "batteries-all",
              },
        )),
      );

      if (sections.length === 0) {
        sections.push(
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
        );
      }
    }

    return makeViewConfig(config, "batteries", sections);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-batteries": MaintenanceBatteriesViewStrategy;
  }
}
