import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { getMaintenanceStaleEntities } from "./stale-data";
import { makeStaleSections } from "./maintenance-stale-sections";
import {
  makeViewConfig,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

const VIEW_ITEM_LIMIT = 24;

@customElement("ll-strategy-view-maintenance-stale")
export class MaintenanceStaleViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);
    const allEntities = await getMaintenanceStaleEntities(
      hass,
      config.stale_threshold_hours,
    );
    const entities = config.area_id
      ? allEntities.filter((entity) => entity.areaId === config.area_id)
      : allEntities;
    const sections = await makeStaleSections(
      localize,
      hass,
      entities,
      config.subview
        ? undefined
        : {
            limit: VIEW_ITEM_LIMIT,
            showMorePath: "stale-all",
          },
    );

    return makeViewConfig(
      localize,
      config,
      "stale",
      sections,
      entities.length === 0 ? { maxColumns: 1 } : undefined,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-stale": MaintenanceStaleViewStrategy;
  }
}
