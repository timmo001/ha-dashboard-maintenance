import type { LocalizeFunc } from "./localize";
import {
  getAvailableSystemMetrics,
  getSystemEntitySensors,
  type SystemEntitySensor,
  type SystemMetricDescriptor,
} from "./system-data";
import type { SystemMetricType } from "./dm-system-metric-card";
import {
  limitItems,
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

// ---------------------------------------------------------------------------
// Card builders
// ---------------------------------------------------------------------------

const makeSystemMetricCard = (
  descriptor: SystemMetricDescriptor,
): LovelaceCardConfig => ({
  type: "custom:dm-system-metric-card",
  metric: descriptor.metric,
  ...(descriptor.label ? { label: descriptor.label } : {}),
  ...(descriptor.icon ? { icon: descriptor.icon } : {}),
  grid_options: { columns: 6, rows: 1, min_columns: 6, min_rows: 1 },
});

const makeSystemEntityTileCard = (
  sensor: SystemEntitySensor,
): LovelaceCardConfig => ({
  type: "tile",
  entity: sensor.entityId,
  name: sensor.displayName,
  tap_action: { action: "more-info" },
  grid_options: { columns: 6, rows: 1, min_columns: 6, min_rows: 1 },
});

// ---------------------------------------------------------------------------
// Summary section (for the summary view)
// ---------------------------------------------------------------------------

/**
 * Build the system summary section for the main summary view.
 * Returns `null` if no system data is available.
 */
export const makeSystemSummarySection = async (
  localize: LocalizeFunc,
  hass: HomeAssistant,
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): Promise<LovelaceSectionConfig | null> => {
  const [metrics, sensors] = await Promise.all([
    getAvailableSystemMetrics(hass),
    getSystemEntitySensors(hass),
  ]);

  if (metrics.length === 0 && sensors.length === 0) {
    return null;
  }

  const metricCards = metrics.map(makeSystemMetricCard);
  const sensorCards = sensors.map(makeSystemEntityTileCard);
  const allCards = [...metricCards, ...sensorCards];

  const { items: shownCards, hiddenCount } = limitItems(allCards, options?.limit);
  const cards = [...shownCards];

  if (options?.showMorePath && hiddenCount > 0) {
    cards.push(makeShowMoreCard(localize, hiddenCount, options.showMorePath));
  }

  return makeSection(
    localize("system.heading"),
    "mdi:server",
    cards,
    SUMMARY_COLUMN_SPAN,
    "system",
  );
};

// ---------------------------------------------------------------------------
// Full view sections
// ---------------------------------------------------------------------------

/**
 * Build sections for the full system view.
 * Returns an empty array if no system data is available.
 */
export const makeSystemSections = async (
  localize: LocalizeFunc,
  hass: HomeAssistant,
): Promise<LovelaceSectionConfig[]> => {
  const [metrics, sensors] = await Promise.all([
    getAvailableSystemMetrics(hass),
    getSystemEntitySensors(hass),
  ]);

  if (metrics.length === 0 && sensors.length === 0) {
    return [];
  }

  const cards: LovelaceCardConfig[] = [];

  // API-driven metrics first
  if (metrics.length > 0) {
    cards.push(
      makeHeadingCard(localize("system.heading_hardware"), {
        icon: "mdi:server",
      }),
    );
    cards.push(...metrics.map(makeSystemMetricCard));
  }

  // Entity-based sensors
  if (sensors.length > 0) {
    cards.push(
      makeHeadingCard(localize("system.heading_sensors"), {
        icon: "mdi:chart-line",
        headingStyle: metrics.length > 0 ? "subtitle" : "title",
      }),
    );
    cards.push(...sensors.map(makeSystemEntityTileCard));
  }

  return [makeGridSection(cards, MAINTENANCE_COLUMN_SPAN)];
};
