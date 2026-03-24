import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { filterItemsByArea } from "./entity-helpers";
import { setupLocalize } from "./localize";
import { getMaintenanceStaleEntities } from "./stale-data";
import { makeStaleSections } from "./maintenance-stale-sections";
import {
  makeViewConfig,
  viewLimitOptions,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

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
    const entities = filterItemsByArea(allEntities, config.area_id);
    const sections = await makeStaleSections(
      localize,
      hass,
      entities,
      viewLimitOptions(config, "stale-all"),
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
