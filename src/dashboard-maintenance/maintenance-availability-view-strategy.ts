import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
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
    const localize = setupLocalize(hass);
    const allEntities = await getMaintenanceAvailabilityEntities(hass);
    const entities = config.area_id
      ? allEntities.filter((entity) => entity.areaId === config.area_id)
      : allEntities;

    const sections = await makeAvailabilitySections(
      localize,
      hass,
      entities,
      config.subview
        ? undefined
        : {
            limit: VIEW_ITEM_LIMIT,
            showMorePath: "availability-all",
          },
    );

    return makeViewConfig(
      localize,
      config,
      "availability",
      sections,
      entities.length === 0 ? { maxColumns: 1 } : undefined,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-availability": MaintenanceAvailabilityViewStrategy;
  }
}
