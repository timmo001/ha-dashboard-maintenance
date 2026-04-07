import type { LocalizeFunc } from "./localize";
import {
  countIntegrationErrors,
  getRepresentativeEntityContextForConfigEntries,
  type GroupedIntegrationErrors,
} from "./integrations-data";
import {
  fetchBrandsAccessToken,
  limitAndMakeCards,
  makeEmptyStateSection,
  makeIntegrationEntryCard,
  MAINTENANCE_COLUMN_SPAN,
  makeSection,
  SUMMARY_COLUMN_SPAN,
  type LovelaceSectionConfig,
} from "./maintenance-view-helpers";
import type { ConfigEntry, HomeAssistant } from "./types";

/** Single list for summary: setup failures, then unload failures, then retry (matches full-view section order). */
export const flattenGroupedIntegrationErrors = (
  grouped: GroupedIntegrationErrors,
): ConfigEntry[] => [
  ...grouped.setupFailed,
  ...grouped.failedUnload,
  ...grouped.setupRetry,
];

const collectConfigEntryIds = (grouped: GroupedIntegrationErrors): Set<string> =>
  new Set(flattenGroupedIntegrationErrors(grouped).map((e) => e.entry_id));

export const makeIntegrationsSections = async (
  localize: LocalizeFunc,
  grouped: GroupedIntegrationErrors,
  hass: HomeAssistant,
): Promise<LovelaceSectionConfig[]> => {
  if (countIntegrationErrors(grouped) === 0) {
    return [
      makeEmptyStateSection(
        localize("integration.empty_no_issues_title"),
        localize("integration.empty_no_issues_content"),
        "mdi:check-circle-outline",
      ),
    ];
  }

  const [entityByEntry, brandsToken] = await Promise.all([
    getRepresentativeEntityContextForConfigEntries(hass, collectConfigEntryIds(grouped)),
    fetchBrandsAccessToken(hass),
  ]);

  const cardFor = (entry: ConfigEntry) => {
    const ctx = entityByEntry.get(entry.entry_id);
    return makeIntegrationEntryCard(localize, entry, brandsToken, {
      representativeEntityId: ctx?.entityId,
      deviceId: ctx?.deviceId,
    });
  };

  const sections: (LovelaceSectionConfig | undefined)[] = [
    grouped.setupFailed.length > 0
      ? makeSection(
          localize("integration.heading_setup_failed"),
          "mdi:alert-circle",
          grouped.setupFailed.map(cardFor),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    grouped.failedUnload.length > 0
      ? makeSection(
          localize("integration.heading_failed_unload"),
          "mdi:alert-octagon-outline",
          grouped.failedUnload.map(cardFor),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    grouped.setupRetry.length > 0
      ? makeSection(
          localize("integration.heading_setup_retry"),
          "mdi:reload-alert",
          grouped.setupRetry.map(cardFor),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
  ];

  return sections.filter(Boolean) as LovelaceSectionConfig[];
};

export const makeIntegrationsSummarySection = async (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  grouped: GroupedIntegrationErrors,
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig | null> => {
  const entries = flattenGroupedIntegrationErrors(grouped);
  if (entries.length === 0) {
    return null;
  }

  const [entityByEntry, brandsToken] = await Promise.all([
    getRepresentativeEntityContextForConfigEntries(hass, collectConfigEntryIds(grouped)),
    fetchBrandsAccessToken(hass),
  ]);

  return makeSection(
    localize("integration.heading_summary"),
    "mdi:puzzle",
    limitAndMakeCards(
      localize,
      entries,
      (entry) => {
        const ctx = entityByEntry.get(entry.entry_id);
        return makeIntegrationEntryCard(localize, entry, brandsToken, {
          representativeEntityId: ctx?.entityId,
          deviceId: ctx?.deviceId,
        });
      },
      options,
    ),
    SUMMARY_COLUMN_SPAN,
    "integrations",
  );
};
