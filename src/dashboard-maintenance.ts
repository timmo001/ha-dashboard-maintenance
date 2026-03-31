import "./dashboard-maintenance/dm-availability-device-card";
import "./dashboard-maintenance/dm-maintenance-summary-card";
import "./dashboard-maintenance/editor";
import "./dashboard-maintenance/maintenance-availability-view-strategy";
import "./dashboard-maintenance/maintenance-batteries-view-strategy";
import "./dashboard-maintenance/maintenance-dashboard-strategy";
import "./dashboard-maintenance/maintenance-repairs-view-strategy";
import "./dashboard-maintenance/maintenance-stale-view-strategy";
import "./dashboard-maintenance/maintenance-summary-view-strategy";
import "./dashboard-maintenance/maintenance-updates-view-strategy";

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
      "Home maintenance overview with batteries, repairs, updates, availability, and stale data.",
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
      strategyType: "dashboard" | "view" | "section";
    }>;
  }
}
