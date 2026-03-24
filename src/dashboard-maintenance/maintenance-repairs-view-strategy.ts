import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { makeRepairsSections } from "./maintenance-repairs-sections";
import {
  makeViewConfig,
  viewLimitOptions,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import { getMaintenanceRepairIssues } from "./repairs-data";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

@customElement("ll-strategy-view-maintenance-repairs")
export class MaintenanceRepairsViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);
    const issues = await getMaintenanceRepairIssues(hass);
    const sections = makeRepairsSections(
      localize,
      issues,
      viewLimitOptions(config, "repairs-all"),
    );

    return makeViewConfig(
      localize,
      config,
      "repairs",
      sections,
      issues.length === 0 ? { maxColumns: 1 } : undefined,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-repairs": MaintenanceRepairsViewStrategy;
  }
}
