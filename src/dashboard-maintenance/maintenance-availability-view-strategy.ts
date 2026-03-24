import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { getMaintenanceAvailabilityEntities } from "./availability-data";
import { makeAvailabilitySections } from "./maintenance-availability-sections";
import {
  limitItems,
  MAINTENANCE_COLUMN_SPAN,
  makeShowMoreSection,
  makeViewConfig,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

const VIEW_ITEM_LIMIT = 24;

@customElement("ll-strategy-view-maintenance-availability")
export class MaintenanceAvailabilityViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const allEntities = await getMaintenanceAvailabilityEntities(hass);
    const limitedEntities = config.subview
      ? { hiddenCount: 0, items: allEntities }
      : limitItems(allEntities, VIEW_ITEM_LIMIT);

    return makeViewConfig(
      config,
      "availability",
      [
        ...(await makeAvailabilitySections(hass, limitedEntities.items)),
        ...(!config.subview && limitedEntities.hiddenCount > 0
          ? [
              makeShowMoreSection(
                limitedEntities.hiddenCount,
                "availability-all",
                MAINTENANCE_COLUMN_SPAN,
              ),
            ]
          : []),
      ],
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-availability": MaintenanceAvailabilityViewStrategy;
  }
}
