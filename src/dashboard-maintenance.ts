import "./dashboard-maintenance/dm-maintenance-summary-card";
import "./dashboard-maintenance/editor";
import "./dashboard-maintenance/maintenance-availability-view-strategy";
import "./dashboard-maintenance/maintenance-batteries-view-strategy";
import "./dashboard-maintenance/maintenance-dashboard-strategy";
import "./dashboard-maintenance/maintenance-repairs-view-strategy";
import "./dashboard-maintenance/maintenance-stale-view-strategy";
import "./dashboard-maintenance/maintenance-summary-view-strategy";
import "./dashboard-maintenance/maintenance-integrations-view-strategy";
import "./dashboard-maintenance/maintenance-updates-view-strategy";
import { MAINTENANCE_DASHBOARD_IMAGES } from "./dashboard-maintenance/strategy-images";

window.customStrategies = window.customStrategies || [];

if (
  !window.customStrategies.some(
    (strategy) =>
      strategy.type === "maintenance" && strategy.strategyType === "dashboard",
  )
) {
  window.customStrategies.push({
    type: "maintenance",
    name: "Maintenance",
    description:
      "Home maintenance overview with batteries, repairs, updates, availability, stale data, and integrations.",
    images: MAINTENANCE_DASHBOARD_IMAGES,
    strategyType: "dashboard",
  });
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
