import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import { countIntegrationErrors, getGroupedIntegrationErrors } from "./integrations-data";
import { makeIntegrationsSections } from "./maintenance-integrations-sections";
import { makeViewConfig, type LovelaceViewConfig } from "./maintenance-view-helpers";
import { setupLocalize } from "./localize";
import type { HomeAssistant, MaintenanceViewStrategyConfig } from "./types";

@customElement("ll-strategy-view-maintenance-integrations")
export class MaintenanceIntegrationsViewStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceViewStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceViewConfig> {
    const localize = setupLocalize(hass);
    const grouped = await getGroupedIntegrationErrors(hass);
    const sections = await makeIntegrationsSections(localize, grouped, hass);

    return makeViewConfig(
      localize,
      config,
      "integrations",
      sections,
      countIntegrationErrors(grouped) === 0 ? { maxColumns: 1 } : undefined,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-view-maintenance-integrations": MaintenanceIntegrationsViewStrategy;
  }
}
