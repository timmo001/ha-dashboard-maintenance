import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { filterItemsByArea } from "./entity-helpers";
import { setupLocalize } from "./localize";
import { getMaintenanceAvailabilityEntities } from "./availability-data";
import { makeAvailabilitySections } from "./maintenance-availability-sections";
import {
  makeViewConfig,
  viewLimitOptions,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

@customElement("ll-strategy-view-maintenance-availability")
export class MaintenanceAvailabilityViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);
    const allEntities = await getMaintenanceAvailabilityEntities(
      hass,
      config.availability_safe_list_device_ids,
    );
    const entities = filterItemsByArea(allEntities, config.area_id);

    const sections = await makeAvailabilitySections(
      localize,
      hass,
      entities,
      viewLimitOptions(config, "availability-all"),
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
