import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { makeUpdatesSections } from "./maintenance-update-sections";
import {
  makeViewConfig,
  viewLimitOptions,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import { getMaintenanceUpdates } from "./update-data";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

@customElement("ll-strategy-view-maintenance-updates")
export class MaintenanceUpdatesViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);
    const updates = getMaintenanceUpdates(hass);
    const sections = makeUpdatesSections(
      localize,
      updates,
      viewLimitOptions(config, "updates-all"),
    );

    return makeViewConfig(
      localize,
      config,
      "updates",
      sections,
      updates.length === 0 ? { maxColumns: 1 } : undefined,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-updates": MaintenanceUpdatesViewStrategy;
  }
}
