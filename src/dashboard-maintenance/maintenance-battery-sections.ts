import type { LocalizeFunc } from "./localize";
import type { MaintenanceBatteryDevice } from "./maintenance-data";
import {
  AREA_BATTERY_NAME,
  ATTENTION_BATTERY_NAME,
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

  return makeSection(
    localize("battery.heading_needing_attention"),
    "mdi:alert",
    limitAndMakeCards(
      localize,
      attentionDevices,
      (device) =>
        makeBatteryCard(device, {
          name: device.deviceId ? ATTENTION_BATTERY_NAME : device.deviceName,
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
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig[]> =>
  makeHierarchySections(
    localize,
    hass,
    {
      items: batteryDevices,
      makeCard: (device) =>
        makeBatteryCard(device, {
          name: device.deviceId ? AREA_BATTERY_NAME : device.deviceName,
        }),
      buildAreaShowMorePath: buildBatteryAreaShowMorePath,
      heading: localize("battery.heading_devices"),
      icon: "mdi:battery-heart-variant",
      unassignedLabel: "common.other_devices",
      unassignedFallbackLabel: "common.devices",
    },
    options,
  );
