import "./dashboard-maintenance/dm-maintenance-summary-card";
import "./dashboard-maintenance/dm-system-metric-card";
import "./dashboard-maintenance/editor";
import "./dashboard-maintenance/maintenance-availability-view-strategy";
import "./dashboard-maintenance/maintenance-batteries-view-strategy";
import "./dashboard-maintenance/maintenance-dashboard-strategy";
import "./dashboard-maintenance/maintenance-repairs-view-strategy";
import "./dashboard-maintenance/maintenance-stale-view-strategy";
import "./dashboard-maintenance/maintenance-summary-view-strategy";
import "./dashboard-maintenance/maintenance-system-view-strategy";
import "./dashboard-maintenance/maintenance-integrations-view-strategy";
import "./dashboard-maintenance/maintenance-section-strategy";
import "./dashboard-maintenance/maintenance-updates-view-strategy";
import { setupLocalize } from "./dashboard-maintenance/localize";
import { MAINTENANCE_DASHBOARD_IMAGES } from "./dashboard-maintenance/strategy-images";

const DOCUMENTATION_URL =
  "https://github.com/timmo001/ha-dashboard-maintenance#readme";

const localize = setupLocalize();

const STRATEGIES = [
  {
    type: "maintenance",
    strategyType: "dashboard",
    name: localize("strategy.dashboard.name"),
    description: localize("strategy.dashboard.description"),
    images: MAINTENANCE_DASHBOARD_IMAGES,
  },
  {
    type: "maintenance",
    strategyType: "section",
    name: localize("strategy.section.name"),
    description: localize("strategy.section.description"),
  },
] as const;

window.customStrategies ??= [];

for (const strategy of STRATEGIES) {
  if (
    !window.customStrategies.some(
      ({ type, strategyType }) =>
        type === strategy.type && strategyType === strategy.strategyType,
    )
  ) {
    window.customStrategies.push({
      ...strategy,
      documentationURL: DOCUMENTATION_URL,
    });
  }
}

declare global {
  interface Window {
    customStrategies?: Array<{
      type: string;
      name?: string;
      description?: string;
      documentationURL?: string;
      images?:
        | string
        | {
            dark: string;
            light: string;
          };
      strategyType: "dashboard" | "view" | "section";
    }>;
  }
}
