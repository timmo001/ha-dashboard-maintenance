import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { getMaintenanceAvailabilityEntities } from "./availability-data";
import { makeAvailabilitySummarySection } from "./maintenance-availability-sections";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import { makeBatteryAttentionSection } from "./maintenance-battery-sections";
import { makeRepairsSummarySection } from "./maintenance-repairs-sections";
import { makeStaleSummarySection } from "./maintenance-stale-sections";
import { makeUpdateSummarySection } from "./maintenance-update-sections";
import { makeViewConfig, type LovelaceViewConfig } from "./maintenance-view-helpers";
import { getMaintenanceRepairIssues } from "./repairs-data";
import { getMaintenanceStaleEntities } from "./stale-data";
import { getMaintenanceUpdates } from "./update-data";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

const SUMMARY_ITEM_LIMIT = 12;

@customElement("ll-strategy-view-maintenance-summary")
export class MaintenanceSummaryViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);
    const [batteryDevices, availabilityEntities, updates, repairIssues, staleEntities] = await Promise.all([
      getMaintenanceBatteryDevices(hass, config.battery_attention_threshold),
      getMaintenanceAvailabilityEntities(hass),
      getMaintenanceUpdates(hass),
      getMaintenanceRepairIssues(hass),
      getMaintenanceStaleEntities(hass, config.stale_threshold_hours),
    ]);

    return makeViewConfig(localize, config, "summary", [
      makeBatteryAttentionSection(localize, batteryDevices, config, {
        limit: SUMMARY_ITEM_LIMIT,
        showMorePath: "batteries",
      }),
      makeUpdateSummarySection(localize, updates, {
        limit: SUMMARY_ITEM_LIMIT,
        showMorePath: "updates",
      }),
      makeRepairsSummarySection(localize, repairIssues, {
        limit: SUMMARY_ITEM_LIMIT,
        showMorePath: "repairs",
      }),
      makeStaleSummarySection(localize, staleEntities, {
        limit: SUMMARY_ITEM_LIMIT,
        showMorePath: "stale",
      }),
      makeAvailabilitySummarySection(localize, availabilityEntities, {
        limit: SUMMARY_ITEM_LIMIT,
        showMorePath: "availability",
      }),
    ]);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-summary": MaintenanceSummaryViewStrategy;
  }
}
