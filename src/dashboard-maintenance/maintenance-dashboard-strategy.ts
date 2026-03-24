import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import "./editor";
import { MaintenanceViewStrategy } from "./maintenance-view-strategy";
import type {
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
} from "./types";

type LovelaceConfig = Record<string, unknown>;

@customElement("ll-strategy-dashboard-maintenance")
export class MaintenanceDashboardStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceDashboardStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceConfig> {
    return {
      views: [
        await MaintenanceViewStrategy.generate(
          {
            ...config,
            view: "summary",
            title: "Summary",
            path: "summary",
            icon: "mdi:home-heart",
            heading_navigation_path: "batteries",
          },
          hass,
        ),
        await MaintenanceViewStrategy.generate(
          {
            ...config,
            view: "batteries",
            title: "Batteries",
            path: "batteries",
            icon: "mdi:battery-heart-variant",
          },
          hass,
        ),
      ],
    };
  }

  public static async getConfigElement(): Promise<HTMLElement> {
    return document.createElement("dashboard-maintenance-strategy-editor");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-dashboard-maintenance": MaintenanceDashboardStrategy;
  }
}
