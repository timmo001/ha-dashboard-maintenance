import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { makeUpdatesSections } from "./maintenance-update-sections";
import { makeViewConfig, type LovelaceViewConfig } from "./maintenance-view-helpers";
import { getMaintenanceUpdates } from "./update-data";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

@customElement("ll-strategy-view-maintenance-updates")
export class MaintenanceUpdatesViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    return makeViewConfig(config, "updates", makeUpdatesSections(getMaintenanceUpdates(hass)));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-updates": MaintenanceUpdatesViewStrategy;
  }
}
