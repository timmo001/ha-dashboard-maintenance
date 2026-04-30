import { compareText } from "./entity-helpers";
import { fetchConfigEntries, fetchEntityRegistry } from "./maintenance-data";
import type { ConfigEntry, HomeAssistant } from "./types";

const SETUP_FAILURE_STATES = new Set<string>(["setup_error", "migration_error"]);

export interface GroupedIntegrationErrors {
  setupFailed: ConfigEntry[];
  failedUnload: ConfigEntry[];
  setupRetry: ConfigEntry[];
}

const groupErroredConfigEntries = (
  entries: Record<string, ConfigEntry>,
  language?: string,
): GroupedIntegrationErrors => {
  const setupFailed: ConfigEntry[] = [];
  const failedUnload: ConfigEntry[] = [];
  const setupRetry: ConfigEntry[] = [];

  for (const entry of Object.values(entries)) {
    if (entry.disabled_by) {
      continue;
    }

    const state = entry.state;
    if (!state) {
      continue;
    }

    if (SETUP_FAILURE_STATES.has(state)) {
      setupFailed.push(entry);
      continue;
    }

    if (state === "failed_unload") {
      failedUnload.push(entry);
      continue;
    }

    if (state === "setup_retry") {
      setupRetry.push(entry);
    }
  }

  const sortEntries = (left: ConfigEntry, right: ConfigEntry): number =>
    compareText(left.title || left.domain, right.title || right.domain, language);

  setupFailed.sort(sortEntries);
  failedUnload.sort(sortEntries);
  setupRetry.sort(sortEntries);

  return { setupFailed, failedUnload, setupRetry };
};

export const getGroupedIntegrationErrors = async (
  hass: HomeAssistant,
): Promise<GroupedIntegrationErrors> => {
  const entries = await fetchConfigEntries(hass);
  return groupErroredConfigEntries(entries, hass.locale?.language);
};

export const countIntegrationErrors = (grouped: GroupedIntegrationErrors): number =>
  grouped.setupFailed.length + grouped.failedUnload.length + grouped.setupRetry.length;

/** Icon for integration error tiles — same pattern as `availabilityIssueIcon` + explicit `makeTileCard` icon. */
const integrationIssueIcon = (entry: ConfigEntry): string => {
  switch (entry.state) {
    case "migration_error":
      return "mdi:database-alert";
    case "setup_error":
      return "mdi:alert-circle";
    case "failed_unload":
      return "mdi:package-variant-closed-remove";
    case "setup_retry":
      return "mdi:reload-alert";
    default:
      return "mdi:puzzle";
  }
};

export interface IntegrationRepresentativeEntity {
  entityId: string;
  deviceId?: string | null;
}

/**
 * Pick one visible entity per config entry (stable order) and its registry device id for tile hold_action (see `makeTileCard` + availability tiles).
 */
export const getRepresentativeEntityContextForConfigEntries = async (
  hass: HomeAssistant,
  configEntryIds: ReadonlySet<string>,
): Promise<Map<string, IntegrationRepresentativeEntity>> => {
  if (configEntryIds.size === 0) {
    return new Map();
  }

  const registry = await fetchEntityRegistry(hass);
  const candidates = new Map<string, string[]>();
  const lang = hass.locale?.language;

  for (const er of Object.values(registry)) {
    const cid = er.config_entry_id;
    if (!cid || !configEntryIds.has(cid)) {
      continue;
    }
    if (er.hidden_by || er.disabled_by) {
      continue;
    }
    const list = candidates.get(cid) ?? [];
    list.push(er.entity_id);
    candidates.set(cid, list);
  }

  const out = new Map<string, IntegrationRepresentativeEntity>();
  for (const [cid, ids] of candidates) {
    ids.sort((a, b) => compareText(a, b, lang));
    const entityId = ids[0];
    if (!entityId) {
      continue;
    }
    const reg = registry[entityId];
    if (!reg) {
      continue;
    }
    out.set(cid, {
      entityId,
      deviceId: reg.device_id,
    });
  }

  return out;
};
