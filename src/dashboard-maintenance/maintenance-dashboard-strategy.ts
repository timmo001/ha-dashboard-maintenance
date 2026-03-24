import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import "./editor";
import { getMaintenanceAreas } from "./maintenance-data";
import { buildAvailabilityAreaShowMorePath } from "./maintenance-availability-sections";
import { MaintenanceAvailabilityViewStrategy } from "./maintenance-availability-view-strategy";
import { buildBatteryAreaShowMorePath } from "./maintenance-battery-sections";
import { MaintenanceBatteriesViewStrategy } from "./maintenance-batteries-view-strategy";
import { MaintenanceSummaryViewStrategy } from "./maintenance-summary-view-strategy";
import { MaintenanceUpdatesViewStrategy } from "./maintenance-updates-view-strategy";
import type {
  AreaRegistryEntry,
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
} from "./types";

type LovelaceConfig = Record<string, unknown>;

const compareAreas = (left: AreaRegistryEntry, right: AreaRegistryEntry): number =>
  left.name.localeCompare(right.name, undefined, { sensitivity: "base" });

@customElement("ll-strategy-dashboard-maintenance")
export class MaintenanceDashboardStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceDashboardStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceConfig> {
    const areas = Object.values(await getMaintenanceAreas(hass)).sort(compareAreas);

    return {
      views: [
        await MaintenanceSummaryViewStrategy.generate(
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
        await MaintenanceBatteriesViewStrategy.generate(
          {
            ...config,
            view: "batteries",
            title: "Batteries",
            path: "batteries",
            icon: "mdi:battery-heart-variant",
          },
          hass,
        ),
        await MaintenanceBatteriesViewStrategy.generate(
          {
            ...config,
            view: "batteries",
            title: "All batteries",
            path: "batteries-all",
            icon: "mdi:battery-heart-variant",
            subview: true,
          },
          hass,
        ),
        ...(await Promise.all(
          areas.map((area) =>
            MaintenanceBatteriesViewStrategy.generate(
              {
                ...config,
                area_id: area.area_id,
                view: "batteries",
                title: area.name,
                path: buildBatteryAreaShowMorePath(area.area_id),
                icon: "mdi:battery-heart-variant",
                subview: true,
              },
              hass,
            ),
          ),
        )),
        await MaintenanceUpdatesViewStrategy.generate(
          {
            ...config,
            view: "updates",
            title: "Updates",
            path: "updates",
            icon: "mdi:package-up",
          },
          hass,
        ),
        await MaintenanceUpdatesViewStrategy.generate(
          {
            ...config,
            view: "updates",
            title: "All updates",
            path: "updates-all",
            icon: "mdi:package-up",
            subview: true,
          },
          hass,
        ),
        await MaintenanceAvailabilityViewStrategy.generate(
          {
            ...config,
            view: "availability",
            title: "Availability",
            path: "availability",
            icon: "mdi:help-circle-outline",
          },
          hass,
        ),
        await MaintenanceAvailabilityViewStrategy.generate(
          {
            ...config,
            view: "availability",
            title: "All availability",
            path: "availability-all",
            icon: "mdi:help-circle-outline",
            subview: true,
          },
          hass,
        ),
        ...(await Promise.all(
          areas.map((area) =>
            MaintenanceAvailabilityViewStrategy.generate(
              {
                ...config,
                area_id: area.area_id,
                view: "availability",
                title: `Availability - ${area.name}`,
                path: buildAvailabilityAreaShowMorePath(area.area_id),
                icon: "mdi:help-circle-outline",
                subview: true,
              },
              hass,
            ),
          ),
        )),
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
