import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import "./editor";
import { setupLocalize } from "./localize";
import { getMaintenanceAreas } from "./maintenance-data";
import { buildBatteryAreaShowMorePath } from "./maintenance-battery-sections";
import { MaintenanceBatteriesViewStrategy } from "./maintenance-batteries-view-strategy";
import { MaintenanceRepairsViewStrategy } from "./maintenance-repairs-view-strategy";
import { MaintenanceUpdatesViewStrategy } from "./maintenance-updates-view-strategy";
import { buildAvailabilityAreaShowMorePath } from "./maintenance-availability-sections";
import { MaintenanceAvailabilityViewStrategy } from "./maintenance-availability-view-strategy";
import { buildStaleAreaShowMorePath } from "./maintenance-stale-sections";
import { MaintenanceStaleViewStrategy } from "./maintenance-stale-view-strategy";
import { MaintenanceSummaryViewStrategy } from "./maintenance-summary-view-strategy";
import { MaintenanceIntegrationsViewStrategy } from "./maintenance-integrations-view-strategy";
import type {
  AreaRegistryEntry,
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
} from "./types";
import { isModuleEnabled } from "./types";

type LovelaceConfig = Record<string, unknown>;

const compareAreas = (left: AreaRegistryEntry, right: AreaRegistryEntry): number =>
  left.name.localeCompare(right.name, undefined, { sensitivity: "base" });

@customElement("ll-strategy-dashboard-maintenance")
class MaintenanceDashboardStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceDashboardStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceConfig> {
    const localize = setupLocalize(hass);
    const areas = Object.values(await getMaintenanceAreas(hass)).sort(compareAreas);

    const views: Record<string, unknown>[] = [];

    /* --- Summary (always present) --- */
    views.push(
      await MaintenanceSummaryViewStrategy.generate(
        {
          ...config,
          view: "summary",
          title: localize("view.summary"),
          path: "summary",
          icon: "mdi:home-heart",
          heading_navigation_path: "batteries",
        },
        hass,
      ),
    );

    /* --- Batteries --- */
    if (isModuleEnabled(config, "batteries")) {
      views.push(
        await MaintenanceBatteriesViewStrategy.generate(
          {
            ...config,
            view: "batteries",
            title: localize("view.batteries"),
            path: "batteries",
            icon: "mdi:battery-heart-variant",
          },
          hass,
        ),
        await MaintenanceBatteriesViewStrategy.generate(
          {
            ...config,
            view: "batteries",
            title: localize("view.all_batteries"),
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
      );
    }

    /* --- Repairs --- */
    if (isModuleEnabled(config, "repairs")) {
      views.push(
        await MaintenanceRepairsViewStrategy.generate(
          {
            ...config,
            view: "repairs",
            title: localize("view.repairs"),
            path: "repairs",
            icon: "mdi:wrench",
          },
          hass,
        ),
        await MaintenanceRepairsViewStrategy.generate(
          {
            ...config,
            view: "repairs",
            title: localize("view.all_repairs"),
            path: "repairs-all",
            icon: "mdi:wrench",
            subview: true,
          },
          hass,
        ),
      );
    }

    /* --- Updates --- */
    if (isModuleEnabled(config, "updates")) {
      views.push(
        await MaintenanceUpdatesViewStrategy.generate(
          {
            ...config,
            view: "updates",
            title: localize("view.updates"),
            path: "updates",
            icon: "mdi:package-up",
          },
          hass,
        ),
        await MaintenanceUpdatesViewStrategy.generate(
          {
            ...config,
            view: "updates",
            title: localize("view.all_updates"),
            path: "updates-all",
            icon: "mdi:package-up",
            subview: true,
          },
          hass,
        ),
      );
    }

    /* --- Availability --- */
    if (isModuleEnabled(config, "availability")) {
      views.push(
        await MaintenanceAvailabilityViewStrategy.generate(
          {
            ...config,
            view: "availability",
            title: localize("view.availability"),
            path: "availability",
            icon: "mdi:help-circle-outline",
          },
          hass,
        ),
        await MaintenanceAvailabilityViewStrategy.generate(
          {
            ...config,
            view: "availability",
            title: localize("view.all_availability"),
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
                title: localize("view.availability_area", { area: area.name }),
                path: buildAvailabilityAreaShowMorePath(area.area_id),
                icon: "mdi:help-circle-outline",
                subview: true,
              },
              hass,
            ),
          ),
        )),
      );
    }

    /* --- Integrations --- */
    if (isModuleEnabled(config, "integrations")) {
      views.push(
        await MaintenanceIntegrationsViewStrategy.generate(
          {
            ...config,
            view: "integrations",
            title: localize("view.integrations"),
            path: "integrations",
            icon: "mdi:puzzle",
          },
          hass,
        ),
      );
    }

    /* --- Stale --- */
    if (isModuleEnabled(config, "stale")) {
      views.push(
        await MaintenanceStaleViewStrategy.generate(
          {
            ...config,
            view: "stale",
            title: localize("view.stale"),
            path: "stale",
            icon: "mdi:clock-alert-outline",
          },
          hass,
        ),
        await MaintenanceStaleViewStrategy.generate(
          {
            ...config,
            view: "stale",
            title: localize("view.all_stale"),
            path: "stale-all",
            icon: "mdi:clock-alert-outline",
            subview: true,
          },
          hass,
        ),
        ...(await Promise.all(
          areas.map((area) =>
            MaintenanceStaleViewStrategy.generate(
              {
                ...config,
                area_id: area.area_id,
                view: "stale",
                title: localize("view.stale_area", { area: area.name }),
                path: buildStaleAreaShowMorePath(area.area_id),
                icon: "mdi:clock-alert-outline",
                subview: true,
              },
              hass,
            ),
          ),
        )),
      );
    }

    return { views };
  }

  /**
   * Suggested title/icon when adding a dashboard from the Home Assistant UI
   * (`loadDashboardStrategyWithCreateSuggestions` in the frontend).
   */
  public static getCreateSuggestions(hass: HomeAssistant): {
    title: string;
    icon: string;
  } {
    const localize = setupLocalize(hass);
    return {
      title: localize("dashboard.suggested_title"),
      icon: "mdi:home-heart",
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
