import { getMaintenanceAvailabilityEntities } from "./availability-data";
import { getGroupedIntegrationErrors } from "./integrations-data";
import type { LocalizeFunc } from "./localize";
import { makeAvailabilitySummarySection } from "./maintenance-availability-sections";
import { makeBatteryAttentionSection } from "./maintenance-battery-sections";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import { makeIntegrationsSummarySection } from "./maintenance-integrations-sections";
import { makeRepairsSummarySection } from "./maintenance-repairs-sections";
import { makeStaleSummarySection } from "./maintenance-stale-sections";
import { makeSystemSummarySection } from "./maintenance-system-sections";
import { makeUpdateSummarySection } from "./maintenance-update-sections";
import type { LovelaceSectionConfig } from "./maintenance-view-helpers";
import { getMaintenanceRepairIssues } from "./repairs-data";
import { getMaintenanceStaleEntities } from "./stale-data";
import type {
  HomeAssistant,
  MaintenanceModuleId,
  MaintenanceStrategyConfig,
} from "./types";
import { getMaintenanceUpdates } from "./update-data";

export interface ModuleSectionOptions {
  limit?: number;
  showMorePath?: string;
  navigationPath?: string;
}

type ModuleSectionBuilder = (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  config: MaintenanceStrategyConfig,
  options: ModuleSectionOptions,
) => Promise<LovelaceSectionConfig | null>;

const MODULE_SECTIONS: Record<MaintenanceModuleId, ModuleSectionBuilder> = {
  system: (localize, hass, _config, options) =>
    makeSystemSummarySection(localize, hass, options),
  batteries: async (localize, hass, config, options) =>
    makeBatteryAttentionSection(
      localize,
      await getMaintenanceBatteryDevices(hass, config),
      { ...config, heading_navigation_path: options.navigationPath },
      options,
    ),
  repairs: async (localize, hass, _config, options) =>
    makeRepairsSummarySection(
      localize,
      await getMaintenanceRepairIssues(hass),
      options,
    ),
  updates: async (localize, hass, _config, options) =>
    makeUpdateSummarySection(localize, await getMaintenanceUpdates(hass), options),
  availability: async (localize, hass, config, options) =>
    makeAvailabilitySummarySection(
      localize,
      hass,
      await getMaintenanceAvailabilityEntities(
        hass,
        config.availability_safe_list_device_ids,
      ),
      options,
    ),
  stale: async (localize, hass, config, options) =>
    makeStaleSummarySection(
      localize,
      await getMaintenanceStaleEntities(hass, config.stale_threshold_hours),
      options,
    ),
  integrations: async (localize, hass, _config, options) =>
    makeIntegrationsSummarySection(
      localize,
      hass,
      await getGroupedIntegrationErrors(hass),
      options,
    ),
};

/**
 * One module's summary section, shared by the summary view and the section
 * strategy. Returns `null` when the module has nothing to show.
 */
export const makeModuleSummarySection = (
  module: MaintenanceModuleId,
  localize: LocalizeFunc,
  hass: HomeAssistant,
  config: MaintenanceStrategyConfig,
  options: ModuleSectionOptions = {},
): Promise<LovelaceSectionConfig | null> =>
  MODULE_SECTIONS[module](localize, hass, config, options);
