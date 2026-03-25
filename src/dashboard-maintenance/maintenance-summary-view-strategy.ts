import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import { makeBatteryAttentionSection } from "./maintenance-battery-sections";
import { makeRepairsSummarySection } from "./maintenance-repairs-sections";
import { getMaintenanceRepairIssues } from "./repairs-data";
import { makeUpdateSummarySection } from "./maintenance-update-sections";
import { getMaintenanceUpdates } from "./update-data";
import { makeAvailabilitySummarySection } from "./maintenance-availability-sections";
import { getMaintenanceAvailabilityEntities } from "./availability-data";
import { makeStaleSummarySection } from "./maintenance-stale-sections";
import { getMaintenanceStaleEntities } from "./stale-data";
import {
  makeEmptyStateSection,
  makeViewConfig,
  SUMMARY_COLUMN_SPAN,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
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

    const rawSections: (LovelaceSectionConfig | null)[] = [];

    if (isModuleEnabled(config, "batteries")) {
      const batteryDevices = await getMaintenanceBatteryDevices(
        hass,
        config.battery_attention_threshold,
      );
      rawSections.push(
        makeBatteryAttentionSection(localize, batteryDevices, config, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "batteries",
        }),
      );
    }

    if (isModuleEnabled(config, "repairs")) {
      const repairIssues = await getMaintenanceRepairIssues(hass);
      rawSections.push(
        makeRepairsSummarySection(localize, repairIssues, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "repairs",
        }),
      );
    }

    if (isModuleEnabled(config, "updates")) {
      const updates = await getMaintenanceUpdates(hass);
      rawSections.push(
        makeUpdateSummarySection(localize, updates, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "updates",
        }),
      );
    }

    if (isModuleEnabled(config, "availability")) {
      const availabilityEntities =
        await getMaintenanceAvailabilityEntities(hass);
      rawSections.push(
        await makeAvailabilitySummarySection(localize, hass, availabilityEntities, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "availability",
        }),
      );
    }

    if (isModuleEnabled(config, "stale")) {
      const staleEntities = await getMaintenanceStaleEntities(
        hass,
        config.stale_threshold_hours,
      );
      rawSections.push(
        makeStaleSummarySection(localize, staleEntities, {
          limit: SUMMARY_ITEM_LIMIT,
          showMorePath: "stale",
        }),
      );
    }

    const sections = rawSections.filter(
      (s): s is LovelaceSectionConfig => s !== null,
    );

    if (sections.length === 0) {
      sections.push(
        makeEmptyStateSection(
          localize("summary.empty_title"),
          localize("summary.empty_content"),
          "mdi:home-heart",
        ),
      );

      return makeViewConfig(localize, config, "summary", sections, {
        maxColumns: 1,
      });
    }

    return makeViewConfig(localize, config, "summary", sections);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-summary": MaintenanceSummaryViewStrategy;
  }
}
