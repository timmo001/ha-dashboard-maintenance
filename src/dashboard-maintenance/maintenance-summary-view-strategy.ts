import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import { makeBatteryAttentionSection } from "./maintenance-battery-sections";
import { makeUpdateSummarySection } from "./maintenance-update-sections";
import { makeViewConfig, type LovelaceViewConfig } from "./maintenance-view-helpers";
import { getMaintenanceUpdates } from "./update-data";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

@customElement("ll-strategy-view-maintenance-summary")
export class MaintenanceSummaryViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const [batteryDevices, updates] = await Promise.all([
      getMaintenanceBatteryDevices(hass, config.battery_attention_threshold),
      getMaintenanceUpdates(hass),
    ]);

    return makeViewConfig(config, "summary", [
      makeBatteryAttentionSection(batteryDevices, config),
      makeUpdateSummarySection(updates),
    ]);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-summary": MaintenanceSummaryViewStrategy;
  }
}
