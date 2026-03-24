import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { makeUpdatesSections } from "./maintenance-update-sections";
import {
  makeViewConfig,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import { getMaintenanceUpdates } from "./update-data";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

const VIEW_ITEM_LIMIT = 24;

@customElement("ll-strategy-view-maintenance-updates")
export class MaintenanceUpdatesViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const updates = getMaintenanceUpdates(hass);

    return makeViewConfig(
      config,
      "updates",
      makeUpdatesSections(
        updates,
        config.subview
          ? undefined
          : {
              limit: VIEW_ITEM_LIMIT,
              showMorePath: "updates-all",
            },
      ),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-updates": MaintenanceUpdatesViewStrategy;
  }
}
