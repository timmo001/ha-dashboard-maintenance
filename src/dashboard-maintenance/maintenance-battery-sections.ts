import type { LocalizeFunc } from "./localize";
import type { MaintenanceBatteryDevice } from "./maintenance-data";
import {
  batteryAreaTileName,
  batteryAttentionTileName,
  limitAndMakeCards,
  SUMMARY_COLUMN_SPAN,
  type LovelaceSectionConfig,
  makeBatteryCard,
  makeHierarchySections,
  makeSection,
} from "./maintenance-view-helpers";
import type {
  HomeAssistant,
  MaintenanceViewStrategyConfig,
} from "./types";

export const buildBatteryAreaShowMorePath = (areaId: string): string =>
  `batteries-area-${areaId}`;

const isBatteryTrendGraphEnabled = (
  config: Pick<MaintenanceViewStrategyConfig, "battery_trend_graph_enabled">,
): boolean => config.battery_trend_graph_enabled !== false;

export const makeBatteryAttentionSection = (
  localize: LocalizeFunc,
  batteryDevices: MaintenanceBatteryDevice[],
  config: MaintenanceViewStrategyConfig,
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig | null => {
  const attentionDevices = batteryDevices.filter((device) => device.needsAttention);

  if (batteryDevices.length === 0 || attentionDevices.length === 0) {
    return null;
  }

  const includeTrendGraph = isBatteryTrendGraphEnabled(config);

  return makeSection(
    localize("battery.heading_needing_attention"),
    "mdi:alert",
    limitAndMakeCards(
      localize,
      attentionDevices,
      (device) =>
        makeBatteryCard(device, {
          name: batteryAttentionTileName(device),
          includeTrendGraph,
        }),
      options,
    ),
    SUMMARY_COLUMN_SPAN,
    config.heading_navigation_path,
  );
};

export const makeBatterySections = async (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  batteryDevices: MaintenanceBatteryDevice[],
  config: Pick<MaintenanceViewStrategyConfig, "battery_trend_graph_enabled">,
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig[]> => {
  const includeTrendGraph = isBatteryTrendGraphEnabled(config);
  return makeHierarchySections(
    localize,
    hass,
    {
      items: batteryDevices,
      makeCard: (device) =>
        makeBatteryCard(device, {
          name: batteryAreaTileName(device),
          includeTrendGraph,
        }),
      buildAreaShowMorePath: buildBatteryAreaShowMorePath,
      heading: localize("battery.heading_devices"),
      icon: "mdi:battery-heart-variant",
      unassignedLabel: "common.other_devices",
      unassignedFallbackLabel: "common.devices",
    },
    options,
  );
};
