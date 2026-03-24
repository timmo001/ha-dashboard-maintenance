import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { filterItemsByArea } from "./entity-helpers";
import { setupLocalize } from "./localize";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import {
  makeBatteryAttentionSection,
  makeBatterySections,
} from "./maintenance-battery-sections";
import {
  makeEmptyStateSection,
  viewLimitOptions,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
  makeViewConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

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
    const batteryDevices = filterItemsByArea(allBatteryDevices, config.area_id);
    const attentionDevices = batteryDevices.filter((device) => device.needsAttention);
    const showAttentionBatteriesInAreas =
      config.show_attention_batteries_in_areas ?? true;
    const areaSectionDevices = showAttentionBatteriesInAreas
      ? batteryDevices
      : batteryDevices.filter((device) => !device.needsAttention);
    const limitOpts = viewLimitOptions(config, "batteries-all");

    if (batteryDevices.length === 0) {
      return makeViewConfig(
        localize,
        config,
        "batteries",
        [
          makeEmptyStateSection(
            localize("battery.empty_no_devices_title"),
            localize("battery.empty_no_devices_content"),
            "mdi:battery-outline",
          ),
        ],
        { maxColumns: 1 },
      );
    }

    const sections: LovelaceSectionConfig[] = [];

    if (!config.area_id && attentionDevices.length > 0) {
      const attentionSection = makeBatteryAttentionSection(
        localize,
        batteryDevices,
        config,
        limitOpts,
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
        limitOpts,
      )),
    );

    if (sections.length === 0) {
      return makeViewConfig(
        localize,
        config,
        "batteries",
        [
          makeEmptyStateSection(
            localize("battery.empty_no_devices_title"),
            localize("battery.empty_no_devices_content"),
            "mdi:battery-outline",
          ),
        ],
        { maxColumns: 1 },
      );
    }

    return makeViewConfig(localize, config, "batteries", sections);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-batteries": MaintenanceBatteriesViewStrategy;
  }
}
