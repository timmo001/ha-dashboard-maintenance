import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
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
    const localize = setupLocalize(hass);
    const updates = getMaintenanceUpdates(hass);
    const sections = makeUpdatesSections(
      localize,
      updates,
      config.subview
        ? undefined
        : {
            limit: VIEW_ITEM_LIMIT,
            showMorePath: "updates-all",
          },
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
