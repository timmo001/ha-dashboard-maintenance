import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { getMaintenanceAvailabilityEntities } from "./availability-data";
import { makeAvailabilitySummarySection } from "./maintenance-availability-sections";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import { makeBatteryAttentionSection } from "./maintenance-battery-sections";
import { makeUpdateSummarySection } from "./maintenance-update-sections";
import { makeViewConfig, type LovelaceViewConfig } from "./maintenance-view-helpers";
import { getMaintenanceUpdates } from "./update-data";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

const SUMMARY_ITEM_LIMIT = 12;

@customElement("ll-strategy-view-maintenance-summary")
export class MaintenanceSummaryViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const [batteryDevices, availabilityEntities, updates] = await Promise.all([
      getMaintenanceBatteryDevices(hass, config.battery_attention_threshold),
      getMaintenanceAvailabilityEntities(hass),
      getMaintenanceUpdates(hass),
    ]);

    return makeViewConfig(config, "summary", [
      makeBatteryAttentionSection(batteryDevices, config, {
        limit: SUMMARY_ITEM_LIMIT,
        showMorePath: "batteries",
      }),
      makeAvailabilitySummarySection(availabilityEntities, {
        limit: SUMMARY_ITEM_LIMIT,
        showMorePath: "availability",
      }),
      makeUpdateSummarySection(updates, {
        limit: SUMMARY_ITEM_LIMIT,
        showMorePath: "updates",
      }),
    ]);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-summary": MaintenanceSummaryViewStrategy;
  }
}
