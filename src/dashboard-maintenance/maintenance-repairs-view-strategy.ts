import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { makeRepairsSections } from "./maintenance-repairs-sections";
import {
  makeViewConfig,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import { getMaintenanceRepairIssues } from "./repairs-data";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

const VIEW_ITEM_LIMIT = 24;

@customElement("ll-strategy-view-maintenance-repairs")
export class MaintenanceRepairsViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);
    const issues = await getMaintenanceRepairIssues(hass);

    return makeViewConfig(
      localize,
      config,
      "repairs",
      makeRepairsSections(
        localize,
        issues,
        config.subview
          ? undefined
          : {
              limit: VIEW_ITEM_LIMIT,
              showMorePath: "repairs-all",
            },
      ),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-repairs": MaintenanceRepairsViewStrategy;
  }
}
