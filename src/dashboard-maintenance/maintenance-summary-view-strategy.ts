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
import { isModuleEnabled } from "./types";

const SUMMARY_ITEM_LIMIT = 12;

@customElement("ll-strategy-view-maintenance-summary")
export class MaintenanceSummaryViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);

    const sections: ReturnType<typeof makeBatteryAttentionSection>[] = [];

    if (isModuleEnabled(config, "batteries")) {
      const batteryDevices = await getMaintenanceBatteryDevices(
        hass,
        config.battery_attention_threshold,
      );
      sections.push(
        makeBatteryAttentionSection(localize, batteryDevices, config, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "batteries",
        }),
      );
    }

    if (isModuleEnabled(config, "updates")) {
      const updates = await getMaintenanceUpdates(hass);
      sections.push(
        makeUpdateSummarySection(localize, updates, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "updates",
        }),
      );
    }

    if (isModuleEnabled(config, "repairs")) {
      const repairIssues = await getMaintenanceRepairIssues(hass);
      sections.push(
        makeRepairsSummarySection(localize, repairIssues, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "repairs",
        }),
      );
    }

    if (isModuleEnabled(config, "stale")) {
      const staleEntities = await getMaintenanceStaleEntities(
        hass,
        config.stale_threshold_hours,
      );
      sections.push(
        makeStaleSummarySection(localize, staleEntities, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "stale",
        }),
      );
    }

    if (isModuleEnabled(config, "availability")) {
      const availabilityEntities =
        await getMaintenanceAvailabilityEntities(hass);
      sections.push(
        makeAvailabilitySummarySection(localize, availabilityEntities, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "availability",
        }),
      );
    }

    return makeViewConfig(localize, config, "summary", sections);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-summary": MaintenanceSummaryViewStrategy;
  }
}
