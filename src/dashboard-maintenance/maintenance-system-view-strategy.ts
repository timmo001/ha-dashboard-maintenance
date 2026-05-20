import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { makeSystemSections } from "./maintenance-system-sections";
import {
  makeEmptyStateSection,
  makeViewConfig,
  type LovelaceViewConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

@customElement("ll-strategy-view-maintenance-system")
export class MaintenanceSystemViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);

    const sections = await makeSystemSections(localize, hass);

    if (sections.length === 0) {
      return makeViewConfig(localize, config, "system", [
        makeEmptyStateSection(
          localize("system.empty_title"),
          localize("system.empty_content"),
          "mdi:server",
        ),
      ], { maxColumns: 1 });
    }

    return makeViewConfig(localize, config, "system", sections);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-system": MaintenanceSystemViewStrategy;
  }
}
