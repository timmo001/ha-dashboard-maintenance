import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import "./editor";
import { setupLocalize, type LocalizeFunc } from "./localize";
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
import { MaintenanceSystemViewStrategy } from "./maintenance-system-view-strategy";
import { hasSystemData } from "./system-data";
import type {
  AreaRegistryEntry,
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
} from "./types";
import { isModuleEnabled } from "./types";

type LovelaceConfig = Record<string, unknown>;

const compareAreas = (left: AreaRegistryEntry, right: AreaRegistryEntry): number =>
  left.name.localeCompare(right.name, undefined, { sensitivity: "base" });

const buildSummaryView = (
  config: MaintenanceDashboardStrategyConfig,
  localize: LocalizeFunc,
  hass: HomeAssistant,
): Promise<LovelaceConfig> =>
  MaintenanceSummaryViewStrategy.generate(
    {
      ...config,
      view: "summary",
      title: localize("view.summary"),
      path: "summary",
      icon: "mdi:home-heart",
      heading_navigation_path: "batteries",
    },
    hass,
  );

const buildSystemView = async (
  config: MaintenanceDashboardStrategyConfig,
  localize: LocalizeFunc,
  hass: HomeAssistant,
): Promise<LovelaceConfig[]> => {
  const icon = "mdi:server";
  return [
    await MaintenanceSystemViewStrategy.generate(
      {
        ...config,
        view: "system",
        title: localize("view.system"),
        path: "system",
        icon,
      },
      hass,
    ),
  ];
};

const buildBatteriesViews = async (
  config: MaintenanceDashboardStrategyConfig,
  localize: LocalizeFunc,
  areas: AreaRegistryEntry[],
  hass: HomeAssistant,
): Promise<LovelaceConfig[]> => {
  const icon = "mdi:battery-heart-variant";
  return [
    await MaintenanceBatteriesViewStrategy.generate(
      {
        ...config,
        view: "batteries",
        title: localize("view.batteries"),
        path: "batteries",
        icon,
      },
      hass,
    ),
    await MaintenanceBatteriesViewStrategy.generate(
      {
        ...config,
        view: "batteries",
        title: localize("view.all_batteries"),
        path: "batteries-all",
        icon,
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
            icon,
            subview: true,
          },
          hass,
        ),
      ),
    )),
  ];
};

const buildRepairsViews = async (
  config: MaintenanceDashboardStrategyConfig,
  localize: LocalizeFunc,
  hass: HomeAssistant,
): Promise<LovelaceConfig[]> => {
  const icon = "mdi:wrench";
  return [
    await MaintenanceRepairsViewStrategy.generate(
      {
        ...config,
        view: "repairs",
        title: localize("view.repairs"),
        path: "repairs",
        icon,
      },
      hass,
    ),
    await MaintenanceRepairsViewStrategy.generate(
      {
        ...config,
        view: "repairs",
        title: localize("view.all_repairs"),
        path: "repairs-all",
        icon,
        subview: true,
      },
      hass,
    ),
  ];
};

const buildUpdatesViews = async (
  config: MaintenanceDashboardStrategyConfig,
  localize: LocalizeFunc,
  hass: HomeAssistant,
): Promise<LovelaceConfig[]> => {
  const icon = "mdi:package-up";
  return [
    await MaintenanceUpdatesViewStrategy.generate(
      {
        ...config,
        view: "updates",
        title: localize("view.updates"),
        path: "updates",
        icon,
      },
      hass,
    ),
    await MaintenanceUpdatesViewStrategy.generate(
      {
        ...config,
        view: "updates",
        title: localize("view.all_updates"),
        path: "updates-all",
        icon,
        subview: true,
      },
      hass,
    ),
  ];
};

const buildAvailabilityViews = async (
  config: MaintenanceDashboardStrategyConfig,
  localize: LocalizeFunc,
  areas: AreaRegistryEntry[],
  hass: HomeAssistant,
): Promise<LovelaceConfig[]> => {
  const icon = "mdi:help-circle-outline";
  return [
    await MaintenanceAvailabilityViewStrategy.generate(
      {
        ...config,
        view: "availability",
        title: localize("view.availability"),
        path: "availability",
        icon,
      },
      hass,
    ),
    await MaintenanceAvailabilityViewStrategy.generate(
      {
        ...config,
        view: "availability",
        title: localize("view.all_availability"),
        path: "availability-all",
        icon,
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
            icon,
            subview: true,
          },
          hass,
        ),
      ),
    )),
  ];
};

const buildIntegrationsViews = async (
  config: MaintenanceDashboardStrategyConfig,
  localize: LocalizeFunc,
  hass: HomeAssistant,
): Promise<LovelaceConfig[]> => [
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
];

const buildStaleViews = async (
  config: MaintenanceDashboardStrategyConfig,
  localize: LocalizeFunc,
  areas: AreaRegistryEntry[],
  hass: HomeAssistant,
): Promise<LovelaceConfig[]> => {
  const icon = "mdi:clock-alert-outline";
  return [
    await MaintenanceStaleViewStrategy.generate(
      {
        ...config,
        view: "stale",
        title: localize("view.stale"),
        path: "stale",
        icon,
      },
      hass,
    ),
    await MaintenanceStaleViewStrategy.generate(
      {
        ...config,
        view: "stale",
        title: localize("view.all_stale"),
        path: "stale-all",
        icon,
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
            icon,
            subview: true,
          },
          hass,
        ),
      ),
    )),
  ];
};

@customElement("ll-strategy-dashboard-maintenance")
class MaintenanceDashboardStrategy extends ReactiveElement {
  public static async generate(
    config: MaintenanceDashboardStrategyConfig,
    hass: HomeAssistant,
  ): Promise<LovelaceConfig> {
    const localize = setupLocalize(hass);
    const areas = Object.values(await getMaintenanceAreas(hass)).sort(compareAreas);

    const views: LovelaceConfig[] = [
      await buildSummaryView(config, localize, hass),
    ];

    if (isModuleEnabled(config, "system") && await hasSystemData(hass)) {
      views.push(...(await buildSystemView(config, localize, hass)));
    }

    if (isModuleEnabled(config, "batteries")) {
      views.push(...(await buildBatteriesViews(config, localize, areas, hass)));
    }

    if (isModuleEnabled(config, "repairs")) {
      views.push(...(await buildRepairsViews(config, localize, hass)));
    }

    if (isModuleEnabled(config, "updates")) {
      views.push(...(await buildUpdatesViews(config, localize, hass)));
    }

    if (isModuleEnabled(config, "availability")) {
      views.push(...(await buildAvailabilityViews(config, localize, areas, hass)));
    }

    if (isModuleEnabled(config, "integrations")) {
      views.push(...(await buildIntegrationsViews(config, localize, hass)));
    }

    if (isModuleEnabled(config, "stale")) {
      views.push(...(await buildStaleViews(config, localize, areas, hass)));
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
