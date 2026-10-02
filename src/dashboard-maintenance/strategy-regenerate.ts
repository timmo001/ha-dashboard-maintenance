import { isRelevantAvailabilityIssue } from "./availability-data";
import { isStateVisible } from "./entity-helpers";
import {
  batteryMembershipKey,
  createBatteryThresholdResolver,
} from "./maintenance-data";
import { isStaleState, staleThresholdMs } from "./stale-data";
import { updateMembershipKey } from "./update-data";
import type {
  HassEntity,
  HomeAssistant,
  MaintenanceModuleId,
  MaintenanceStrategyConfig,
} from "./types";
import { isModuleEnabled } from "./types";

const REGISTRY_DEPENDENCIES = ["entities", "devices", "areas", "floors"] as const;

/**
 * Home Assistant only regenerates strategies on registry changes by default.
 * The maintenance lists also depend on entity states, so regenerate when a
 * state change moves an entity into, out of, or between those lists. Plain
 * value changes (such as a battery level dropping by 1%) are ignored because
 * the generated cards already show live values.
 */
export const shouldRegenerateMaintenance = (
  config: MaintenanceStrategyConfig,
  oldHass: HomeAssistant,
  newHass: HomeAssistant,
  modules: readonly MaintenanceModuleId[],
): boolean => {
  if (REGISTRY_DEPENDENCIES.some((key) => oldHass[key] !== newHass[key])) {
    return true;
  }

  if (oldHass.states === newHass.states) {
    return false;
  }

  const enabled = new Set(
    modules.filter((module) => isModuleEnabled(config, module)),
  );

  const thresholdFor = createBatteryThresholdResolver(config);
  const staleMs = staleThresholdMs(config.stale_threshold_hours);
  const now = Date.now();

  const membershipKey = (stateObj: HassEntity | undefined): string => {
    if (!stateObj || !isStateVisible(stateObj)) {
      return "";
    }

    const parts = [
      enabled.has("batteries") ? batteryMembershipKey(stateObj, thresholdFor) : "",
      enabled.has("availability") && isRelevantAvailabilityIssue(stateObj),
      enabled.has("updates") ? updateMembershipKey(stateObj) : "",
      enabled.has("stale") && isStaleState(stateObj, staleMs, now),
    ];

    return parts.some(Boolean) ? JSON.stringify(parts) : "";
  };

  const changed = (entityId: string): boolean => {
    const oldState = oldHass.states[entityId];
    const newState = newHass.states[entityId];

    return (
      oldState !== newState &&
      membershipKey(oldState) !== membershipKey(newState)
    );
  };

  return (
    Object.keys(newHass.states).some(changed) ||
    Object.keys(oldHass.states).some(
      (entityId) => !(entityId in newHass.states) && changed(entityId),
    )
  );
};
