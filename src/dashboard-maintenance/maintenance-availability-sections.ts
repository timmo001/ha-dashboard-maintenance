import {
  getMaintenanceAvailabilityEntities,
  groupAvailabilityByDevice,
  type MaintenanceAvailabilityDevice,
  type MaintenanceAvailabilityEntity,
} from "./availability-data";
import type { LocalizeFunc, TranslationKey } from "./localize";
import {
  ATTENTION_ENTITY_NAME,
  fetchBrandsAccessToken,
  limitItems,
  makeAvailabilityCard,
  makeAvailabilityDeviceCard,
  makeEmptyStateSection,
  makeGridSection,
  makeHeadingCard,
  makeSection,
  makeShowMoreCard,
  MAINTENANCE_COLUMN_SPAN,
  SUMMARY_COLUMN_SPAN,
  type LovelaceCardConfig,
  type LovelaceSectionConfig,
} from "./maintenance-view-helpers";
import type { HomeAssistant } from "./types";

export const buildAvailabilityAreaShowMorePath = (areaId: string): string =>
  `availability-area-${areaId}`;

export const makeAvailabilitySummarySection = (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  entities: MaintenanceAvailabilityEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig | null> => {
  if (entities.length === 0) {
    return Promise.resolve(null);
  }

  return makeAvailabilitySummarySectionContent(localize, hass, entities, options);
};

const makeAvailabilitySummarySectionContent = async (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  entities: MaintenanceAvailabilityEntity[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig> => {
  const unavailableEntities = entities.filter((entity) => entity.state === "unavailable");
  const unknownEntities = entities.filter((entity) => entity.state === "unknown");

  const [unavailableGrouped, unknownGrouped, brandsToken] = await Promise.all([
    groupAvailabilityByDevice(hass, unavailableEntities),
    groupAvailabilityByDevice(hass, unknownEntities),
    fetchBrandsAccessToken(hass),
  ]);

  const summaryCards = [
    ...unavailableGrouped.devices.map((device) =>
      makeAvailabilityDeviceCard(
        device,
        deviceSubtitle(
          localize,
          device,
          "availability.device_unavailable_one",
          "availability.device_unavailable_other",
        ),
        brandsToken,
        { enableSafeToggle: true },
      ),
    ),
    ...unknownGrouped.devices.map((device) =>
      makeAvailabilityDeviceCard(
        device,
        deviceSubtitle(
          localize,
          device,
          "availability.device_unknown_one",
          "availability.device_unknown_other",
        ),
        brandsToken,
      ),
    ),
    ...unavailableGrouped.ungrouped.map((entity) =>
      makeAvailabilityCard(entity, {
        name: entity.deviceId ? ATTENTION_ENTITY_NAME : entity.displayName,
      }),
    ),
    ...unknownGrouped.ungrouped.map((entity) =>
      makeAvailabilityCard(entity, {
        name: entity.deviceId ? ATTENTION_ENTITY_NAME : entity.displayName,
      }),
    ),
  ];

  const { items: shownCards, hiddenCount } = limitItems(summaryCards, options?.limit);
  const cards = [...shownCards];

  if (options?.showMorePath && hiddenCount > 0) {
    cards.push(makeShowMoreCard(localize, hiddenCount, options.showMorePath));
  }

  return makeSection(
    localize("availability.heading_unavailable_or_unknown"),
    "mdi:help-circle-outline",
    cards,
    SUMMARY_COLUMN_SPAN,
    "availability",
  );
};

const deviceSubtitle = (
  localize: LocalizeFunc,
  device: MaintenanceAvailabilityDevice,
  oneKey: TranslationKey,
  otherKey: TranslationKey,
): string =>
  device.unavailableCount === 1
    ? localize(oneKey, { count: device.unavailableCount })
    : localize(otherKey, { count: device.unavailableCount });

/** Build heading + device tile cards for a single state (unavailable or unknown). */
const buildDeviceCards = (
  localize: LocalizeFunc,
  heading: string,
  icon: string,
  devices: MaintenanceAvailabilityDevice[],
  subtitleOneKey: TranslationKey,
  subtitleOtherKey: TranslationKey,
  brandsToken?: string | null,
  options?: {
    enableSafeToggle?: boolean;
  },
): LovelaceCardConfig[] => {
  if (devices.length === 0) {
    return [];
  }

  const cards: LovelaceCardConfig[] = [
    makeHeadingCard(heading, { icon }),
  ];

  for (const device of devices) {
    const subtitle = deviceSubtitle(localize, device, subtitleOneKey, subtitleOtherKey);
    cards.push(makeAvailabilityDeviceCard(device, subtitle, brandsToken, options));
  }

  return cards;
};

export const makeAvailabilitySections = async (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  entities: MaintenanceAvailabilityEntity[],
  _options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig[]> => {
  if (entities.length === 0) {
    return [
      makeEmptyStateSection(
        localize("availability.empty_no_issues_title"),
        localize("availability.empty_no_issues_content"),
        "mdi:lan-connect",
      ),
    ];
  }

  const unavailableEntities = entities.filter((e) => e.state === "unavailable");
  const unknownEntities = entities.filter((e) => e.state === "unknown");

  const [unavailableGrouped, unknownGrouped, brandsToken] = await Promise.all([
    groupAvailabilityByDevice(hass, unavailableEntities),
    groupAvailabilityByDevice(hass, unknownEntities),
    fetchBrandsAccessToken(hass),
  ]);

  const cards: LovelaceCardConfig[] = [];

  cards.push(
    ...buildDeviceCards(
      localize,
      localize("availability.heading_unavailable"),
      "mdi:lan-disconnect",
      unavailableGrouped.devices,
      "availability.device_unavailable_one",
      "availability.device_unavailable_other",
      brandsToken,
      { enableSafeToggle: true },
    ),
  );

  cards.push(
    ...buildDeviceCards(
      localize,
      localize("availability.heading_unknown"),
      "mdi:help-rhombus-outline",
      unknownGrouped.devices,
      "availability.device_unknown_one",
      "availability.device_unknown_other",
      brandsToken,
    ),
  );

  const allUngrouped = [
    ...unavailableGrouped.ungrouped,
    ...unknownGrouped.ungrouped,
  ];

  if (allUngrouped.length > 0) {
    cards.push(
      makeHeadingCard(localize("availability.ungrouped_entities"), {
        headingStyle: "subtitle",
      }),
    );

    for (const entity of allUngrouped) {
      cards.push(makeAvailabilityCard(entity));
    }
  }

  return [makeGridSection(cards, MAINTENANCE_COLUMN_SPAN)];
};

export const getAvailabilitySummaryData = async (
  hass: HomeAssistant,
): Promise<MaintenanceAvailabilityEntity[]> => getMaintenanceAvailabilityEntities(hass);
