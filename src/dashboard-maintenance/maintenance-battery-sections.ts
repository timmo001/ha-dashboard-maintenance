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
import {
  DEFAULT_BATTERY_TILE_FEATURE,
  type BatteryTileFeature,
  type HomeAssistant,
  type MaintenanceViewStrategyConfig,
} from "./types";

export const buildBatteryAreaShowMorePath = (areaId: string): string =>
  `batteries-area-${areaId}`;

const resolveBatteryFeature = (
  config: Pick<MaintenanceViewStrategyConfig, "battery_tile_feature">,
): BatteryTileFeature =>
  config.battery_tile_feature ?? DEFAULT_BATTERY_TILE_FEATURE;

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

  const feature = resolveBatteryFeature(config);

  return makeSection(
    localize("battery.heading_needing_attention"),
    "mdi:alert",
    limitAndMakeCards(
      localize,
      attentionDevices,
      (device) =>
        makeBatteryCard(device, {
          name: batteryAttentionTileName(device),
          feature,
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
  config: Pick<MaintenanceViewStrategyConfig, "battery_tile_feature">,
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig[]> => {
  const feature = resolveBatteryFeature(config);
  return makeHierarchySections(
    localize,
    hass,
    {
      items: batteryDevices,
      makeCard: (device) =>
        makeBatteryCard(device, {
          name: batteryAreaTileName(device),
          feature,
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
