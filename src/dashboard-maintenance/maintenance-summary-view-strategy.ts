import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { shouldRegenerateMaintenance } from "./strategy-regenerate";
import { makeModuleSummarySection } from "./maintenance-module-sections";
import {
  makeEmptyStateSection,
  makeViewConfig,
  type LovelaceSectionConfig,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import type {
  HomeAssistant,
  MaintenanceModuleId,
  MaintenanceViewStrategyConfig,
} from "./types";
import { isModuleEnabled } from "./types";

const SUMMARY_ITEM_LIMIT = 12;

const SUMMARY_MODULES = [
  "system",
  "batteries",
  "repairs",
  "updates",
  "availability",
  "integrations",
  "stale",
] as const satisfies readonly MaintenanceModuleId[];

@customElement("ll-strategy-view-maintenance-summary")
export class MaintenanceSummaryViewStrategy extends ReactiveElement {
  public static shouldRegenerate(
    config: MaintenanceViewStrategyConfig,
    oldHass: HomeAssistant,
    newHass: HomeAssistant,
  ): boolean {
    return shouldRegenerateMaintenance(config, oldHass, newHass, [
      "batteries",
      "availability",
      "updates",
      "stale",
    ]);
  }

  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);

    const sections: LovelaceSectionConfig[] = [];

    for (const module of SUMMARY_MODULES) {
      if (!isModuleEnabled(config, module)) {
        continue;
      }

      const section = await makeModuleSummarySection(module, localize, hass, config, {
        limit: SUMMARY_ITEM_LIMIT,
        showMorePath: module,
        navigationPath:
          module === "batteries" ? config.heading_navigation_path : module,
      });

      if (section) {
        sections.push(section);
      }
    }

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
