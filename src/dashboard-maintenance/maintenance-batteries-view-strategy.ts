import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import {
  makeBatteryAttentionSection,
  makeBatterySections,
} from "./maintenance-battery-sections";
import {
  MAINTENANCE_COLUMN_SPAN,
  makeEmptyStateSection,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
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
    const localize = setupLocalize(hass);
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
        makeEmptyStateSection(
          localize("battery.empty_no_devices_title"),
          localize("battery.empty_no_devices_content"),
          "mdi:battery-outline",
          MAINTENANCE_COLUMN_SPAN,
        ),
      );
    } else {
      if (!config.area_id && attentionDevices.length > 0) {
        const attentionSection = makeBatteryAttentionSection(
          localize,
          batteryDevices,
          config,
          config.subview
            ? undefined
            : {
                limit: VIEW_ITEM_LIMIT,
                showMorePath: "batteries-all",
              },
        );
        if (attentionSection) {
          sections.push(attentionSection);
        }
      }

      sections.push(
        ...(await makeBatterySections(
          localize,
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
          makeEmptyStateSection(
            localize("battery.empty_no_devices_title"),
            localize("battery.empty_no_devices_content"),
            "mdi:battery-outline",
            MAINTENANCE_COLUMN_SPAN,
          ),
        );
      }
    }

    return makeViewConfig(localize, config, "batteries", sections);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-batteries": MaintenanceBatteriesViewStrategy;
  }
}
