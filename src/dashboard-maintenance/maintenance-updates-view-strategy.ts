import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { makeUpdatesSections } from "./maintenance-update-sections";
import {
  limitItems,
  MAINTENANCE_COLUMN_SPAN,
  makeShowMoreSection,
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
    const allUpdates = getMaintenanceUpdates(hass);
    const limitedUpdates = config.subview
      ? { hiddenCount: 0, items: allUpdates }
      : limitItems(allUpdates, VIEW_ITEM_LIMIT);

    return makeViewConfig(config, "updates", [
      ...makeUpdatesSections(limitedUpdates.items),
      ...(!config.subview && limitedUpdates.hiddenCount > 0
        ? [
            makeShowMoreSection(
              limitedUpdates.hiddenCount,
              "updates-all",
              MAINTENANCE_COLUMN_SPAN,
            ),
          ]
        : []),
    ]);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-updates": MaintenanceUpdatesViewStrategy;
  }
}
