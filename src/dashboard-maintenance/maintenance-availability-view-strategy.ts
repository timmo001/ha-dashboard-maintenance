import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { getMaintenanceAvailabilityEntities } from "./availability-data";
import { makeAvailabilitySections } from "./maintenance-availability-sections";
import {
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
    const entities = await getMaintenanceAvailabilityEntities(hass);

    return makeViewConfig(
      config,
      "availability",
      await makeAvailabilitySections(
        hass,
        entities,
        config.subview
          ? undefined
          : {
              limit: VIEW_ITEM_LIMIT,
              showMorePath: "availability-all",
            },
      ),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-availability": MaintenanceAvailabilityViewStrategy;
  }
}
