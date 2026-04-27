import { css, html, LitElement } from "lit";
import type { PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  getMaintenanceAvailabilityEntities,
  groupAvailabilityByDevice,
  normalizeAvailabilitySafeListDeviceIds,
} from "./availability-data";
import { setupLocalize } from "./localize";
import {
  buildDashboardSummaryPath,
  fetchLovelaceDashboardUrlPaths,
} from "./lovelace-dashboard";
import { getMaintenanceBatteryDevices } from "./maintenance-data";
import { getMaintenanceRepairIssues } from "./repairs-data";
import { getMaintenanceStaleEntities } from "./stale-data";
import type { HomeAssistant, MaintenanceStrategyConfig } from "./types";
import { getMaintenanceUpdates, updateCanInstall } from "./update-data";

export type SummaryMetric =
  | "batteries"
  | "repairs"
  | "updates"
  | "availability"
  | "stale";

export type SummaryTapAction = {
  action?: string;
  navigation_path?: string;
};

export interface DmMaintenanceSummaryCardConfig {
  type: string;
  summary?: SummaryMetric;
  metric?: SummaryMetric;
  tap_action?: SummaryTapAction;
  hold_action?: SummaryTapAction;
  navigation_path?: string;
  title?: string;
  icon?: string;
}

interface ActionHandlerEvent extends Event {
  detail: {
    action?: "tap" | "hold" | "double_tap";
  };
}

const SUMMARY_METRICS = [
  "batteries",
  "repairs",
  "updates",
  "availability",
  "stale",
] as const;

const SUMMARY_METRIC_VALUES = new Set<string>(SUMMARY_METRICS);

const DEFAULT_METRIC: SummaryMetric = "batteries";
const DEFAULT_NAVIGATION_PATH = "summary";
const DEFAULT_ICON = "mdi:home-heart";
const REFRESH_INTERVAL_MS = 60_000;
const INITIAL_LOAD_RETRY_MS = 1_500;

const METRIC_COLOR: Record<SummaryMetric, string> = {
  batteries: "var(--warning-color)",
  repairs: "var(--error-color)",
  updates: "var(--info-color)",
  availability: "var(--error-color)",
  stale: "var(--warning-color)",
};

const COUNT_LABEL_KEY: Record<
  SummaryMetric,
  {
    one:
      | "summary_card.count.batteries_one"
      | "summary_card.count.repairs_one"
      | "summary_card.count.updates_one"
      | "summary_card.count.availability_one"
      | "summary_card.count.stale_one";
    other:
      | "summary_card.count.batteries_other"
      | "summary_card.count.repairs_other"
      | "summary_card.count.updates_other"
      | "summary_card.count.availability_other"
      | "summary_card.count.stale_other";
  }
> = {
  batteries: {
    one: "summary_card.count.batteries_one",
    other: "summary_card.count.batteries_other",
  },
  repairs: {
    one: "summary_card.count.repairs_one",
    other: "summary_card.count.repairs_other",
  },
  updates: {
    one: "summary_card.count.updates_one",
    other: "summary_card.count.updates_other",
  },
  availability: {
    one: "summary_card.count.availability_one",
    other: "summary_card.count.availability_other",
  },
  stale: {
    one: "summary_card.count.stale_one",
    other: "summary_card.count.stale_other",
  },
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSummaryMetric = (value: unknown): value is SummaryMetric =>
  typeof value === "string" && SUMMARY_METRIC_VALUES.has(value);

const isMaintenanceStrategyConfig = (
  value: unknown,
): value is MaintenanceStrategyConfig =>
  isObjectRecord(value) && value.type === "custom:maintenance";

const resolveMetric = (config?: DmMaintenanceSummaryCardConfig): SummaryMetric => {
  const selected = config?.summary ?? config?.metric;
  return isSummaryMetric(selected) ? selected : DEFAULT_METRIC;
};

const hasAction = (action?: SummaryTapAction): boolean =>
  action !== undefined && action.action !== "none";

const tileCardStyle = css`
  ha-card:has(ha-tile-container[focused]) {
    --shadow-default: var(--ha-card-box-shadow, 0 0 0 0 transparent);
    --shadow-focus: 0 0 0 1px var(--tile-color);
    border-color: var(--tile-color);
    box-shadow: var(--shadow-default), var(--shadow-focus);
  }

  ha-card {
    transition:
      box-shadow 180ms ease-in-out,
      border-color 180ms ease-in-out;
  }

  ha-tile-icon {
    --tile-icon-color: var(--tile-color);
  }
`;

@customElement("dm-maintenance-summary-card")
class DmMaintenanceSummaryCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DmMaintenanceSummaryCardConfig;
  @state() private _count = 0;
  @state() private _countLoaded = false;
  @state() private _hasError = false;
  @state() private _dashboardNotFound = false;
  @state() private _resolvedMaintenanceSummaryPath?: string;
  @state() private _resolvedMaintenanceStrategy?: MaintenanceStrategyConfig;

  private _refreshTimer?: number;
  private _initialLoadRetryTimer?: number;
  private _refreshInFlight = false;
  private _lastRefreshAt = 0;
  private _discoveryInFlight = false;

  public static getStubConfig(): DmMaintenanceSummaryCardConfig {
    return {
      type: "custom:dm-maintenance-summary-card",
    };
  }

  public static async getConfigElement(): Promise<HTMLElement> {
    await import("./dm-maintenance-summary-card-editor.js");
    return document.createElement("dm-maintenance-summary-card-editor");
  }

  public setConfig(config: DmMaintenanceSummaryCardConfig): void {
    if (!config || config.type !== "custom:dm-maintenance-summary-card") {
      throw new Error(
        "dm-maintenance-summary-card: type must be custom:dm-maintenance-summary-card",
      );
    }

    this._config = {
      ...config,
    };

    this._countLoaded = false;
    this._clearInitialLoadRetryTimer();

    void this._refreshCount(true);
    void this._discoverMaintenanceSummaryPath();
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._startRefreshTimer();
    void this._refreshCount(true);
    void this._discoverMaintenanceSummaryPath();
  }

  public disconnectedCallback(): void {
    this._clearRefreshTimer();
    this._clearInitialLoadRetryTimer();
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues<this>): void {
    if (changedProps.has("hass")) {
      void this._refreshCount(false);
      void this._discoverMaintenanceSummaryPath();
    }
  }

  public getCardSize(): number {
    return 1;
  }

  private _countLabel(metric: SummaryMetric): string {
    const localize = setupLocalize(this.hass);
    if (this._dashboardNotFound) {
      return localize("summary_card.error_dashboard_not_found");
    }

    if (this._hasError) {
      return localize("summary_card.error");
    }

    const keys = COUNT_LABEL_KEY[metric];
    return localize(this._count === 1 ? keys.one : keys.other, { count: this._count });
  }

  private _tapAction(): SummaryTapAction {
    if (!this._config) {
      return { action: "none" };
    }

    if (this._config.tap_action) {
      return this._config.tap_action;
    }

    return {
      action: "navigate",
      navigation_path: this._config.navigation_path || this._resolvedMaintenanceSummaryPath,
    };
  }

  private _holdAction(): SummaryTapAction | undefined {
    return this._config?.hold_action;
  }

  private _defaultNavigationPath(): string {
    return this._resolvedMaintenanceSummaryPath || DEFAULT_NAVIGATION_PATH;
  }

  private _resolveActionPath(action?: SummaryTapAction): string | undefined {
    return (
      action?.navigation_path ||
      this._config?.navigation_path ||
      this._resolvedMaintenanceSummaryPath
    );
  }

  private _maintenanceStrategyFromConfig(
    config: unknown,
  ): MaintenanceStrategyConfig | undefined {
    if (!isObjectRecord(config) || !isMaintenanceStrategyConfig(config.strategy)) {
      return undefined;
    }

    return config.strategy;
  }

  private async _discoverMaintenanceSummaryPath(): Promise<void> {
    if (this._discoveryInFlight || !this.hass?.connection) {
      return;
    }

    this._discoveryInFlight = true;
    this._dashboardNotFound = false;
    this._resolvedMaintenanceSummaryPath = undefined;
    this._resolvedMaintenanceStrategy = undefined;

    let found = false;

    try {
      const urlPaths = await fetchLovelaceDashboardUrlPaths(this.hass.connection);

      for (const urlPath of urlPaths) {
        try {
          const config = await this.hass.connection.sendMessagePromise({
            type: "lovelace/config",
            url_path: urlPath,
            force: false,
          });

          const strategy = this._maintenanceStrategyFromConfig(config);
          if (strategy) {
            this._resolvedMaintenanceSummaryPath = buildDashboardSummaryPath(urlPath);
            this._resolvedMaintenanceStrategy = {
              ...strategy,
              availability_safe_list_device_ids: normalizeAvailabilitySafeListDeviceIds(
                strategy.availability_safe_list_device_ids,
              ),
            };
            found = true;
            break;
          }
        } catch {
          // Ignore inaccessible dashboards and keep searching.
        }
      }
    } catch {
      // Keep fallback path behavior.
    } finally {
      this._discoveryInFlight = false;
      this._dashboardNotFound = !found;
      if (this._dashboardNotFound) {
        this._hasError = true;
      } else {
        void this._refreshCount(true);
      }
    }
  }

  private _navigate(path: string): void {
    history.pushState(null, "", path);
    window.dispatchEvent(
      new CustomEvent("location-changed", {
        bubbles: true,
        composed: true,
        detail: {},
      }),
    );
  }

  private _handleAction(ev: ActionHandlerEvent): void {
    const actionType = ev.detail.action;
    if (!actionType) {
      return;
    }

    const actionConfig =
      actionType === "hold" ? this._holdAction() : this._tapAction();

    if (!actionConfig || actionConfig.action === "none") {
      return;
    }

    if (actionConfig.action === "navigate") {
      const navigationPath = this._resolveActionPath(actionConfig);
      if (!navigationPath) {
        return;
      }
      this._navigate(navigationPath);
    }
  }

  private _startRefreshTimer(): void {
    if (this._refreshTimer !== undefined) {
      return;
    }

    this._refreshTimer = window.setInterval(() => {
      void this._refreshCount(false);
    }, REFRESH_INTERVAL_MS);
  }

  private _clearRefreshTimer(): void {
    if (this._refreshTimer !== undefined) {
      window.clearInterval(this._refreshTimer);
      this._refreshTimer = undefined;
    }
  }

  private _scheduleInitialLoadRetry(): void {
    if (this._initialLoadRetryTimer !== undefined) {
      return;
    }

    this._initialLoadRetryTimer = window.setTimeout(() => {
      this._initialLoadRetryTimer = undefined;
      void this._refreshCount(true);
    }, INITIAL_LOAD_RETRY_MS);
  }

  private _clearInitialLoadRetryTimer(): void {
    if (this._initialLoadRetryTimer !== undefined) {
      window.clearTimeout(this._initialLoadRetryTimer);
      this._initialLoadRetryTimer = undefined;
    }
  }

  private _hasLoadedStateData(): boolean {
    return Boolean(this.hass && Object.keys(this.hass.states).length > 0);
  }

  private async _refreshCount(force: boolean): Promise<void> {
    if (!this.hass || !this._config || this._refreshInFlight) {
      return;
    }

    if (!force && Date.now() - this._lastRefreshAt < REFRESH_INTERVAL_MS) {
      return;
    }

    this._refreshInFlight = true;
    this._lastRefreshAt = Date.now();

    try {
      if (!this._resolvedMaintenanceStrategy) {
        if (this._dashboardNotFound) {
          this._hasError = true;
          return;
        }

        await this._discoverMaintenanceSummaryPath();
        if (!this._resolvedMaintenanceStrategy) {
          return;
        }
      }

      const count = await this._computeCount();
      const hasLoadedStateData = this._hasLoadedStateData();
      const isReliableInitialCount = count > 0 || hasLoadedStateData;

      if (!this._countLoaded && !isReliableInitialCount) {
        this._count = count;
        this._countLoaded = false;
        this._scheduleInitialLoadRetry();
      } else {
        this._count = count;
        this._countLoaded = true;
        this._clearInitialLoadRetryTimer();
      }

      this._hasError = false;
    } catch {
      this._hasError = true;
    } finally {
      this._refreshInFlight = false;
    }
  }

  private async _computeCount(): Promise<number> {
    if (!this.hass || !this._config) {
      return 0;
    }

    const metric = resolveMetric(this._config);

    switch (metric) {
      case "batteries": {
        const devices = await getMaintenanceBatteryDevices(
          this.hass,
          this._resolvedMaintenanceStrategy?.battery_attention_threshold,
        );
        return devices.filter((device) => device.needsAttention).length;
      }
      case "repairs": {
        const issues = await getMaintenanceRepairIssues(this.hass);
        return issues.length;
      }
      case "updates": {
        const updates = await getMaintenanceUpdates(this.hass);
        return updates.filter(
          (update) =>
            update.inProgress || update.skippedCurrentVersion || updateCanInstall(update),
        ).length;
      }
      case "availability": {
        const entities = await getMaintenanceAvailabilityEntities(
          this.hass,
          this._resolvedMaintenanceStrategy?.availability_safe_list_device_ids,
        );
        const grouped = await groupAvailabilityByDevice(this.hass, entities);
        return grouped.devices.length + grouped.ungrouped.length;
      }
      case "stale": {
        const entities = await getMaintenanceStaleEntities(
          this.hass,
          this._resolvedMaintenanceStrategy?.stale_threshold_hours,
        );
        return entities.length;
      }
      default:
        return 0;
    }
  }

  protected render() {
    if (!this._config) {
      return html``;
    }

    const localize = setupLocalize(this.hass);
    const metric = resolveMetric(this._config);
    const icon = this._config.icon || DEFAULT_ICON;
    const title = this._config.title || localize("summary_card.title");
    const secondary = this._countLabel(metric);
    const secondaryLoading =
      !this._countLoaded && !this._hasError && !this._dashboardNotFound;
    const secondaryText = secondaryLoading ? "" : secondary;

    const tapAction = this._tapAction();
    const holdAction = this._holdAction();
    const hasTap = hasAction(tapAction);
    const hasHold = hasAction(holdAction);
    const interactive = hasTap || hasHold;

    return html`
        <ha-card
          class=${classMap({ error: this._hasError || this._dashboardNotFound })}
          aria-label=${secondaryLoading ? title : `${title}: ${secondary}`}
          style=${styleMap({ "--tile-color": METRIC_COLOR[metric] })}
        >
        <ha-tile-container
          .interactive=${interactive}
          .actionHandlerOptions=${{ hasTap, hasHold }}
          @action=${this._handleAction}
        >
          <ha-tile-icon slot="icon" .icon=${icon}></ha-tile-icon>
          <ha-tile-info
            slot="info"
            .primary=${title}
            .secondary=${secondaryText}
            .secondaryLoading=${secondaryLoading}
          ></ha-tile-info>
        </ha-tile-container>
      </ha-card>
    `;
  }

  static styles = [
    tileCardStyle,
    css`
      :host {
        --tile-color: var(--state-inactive-color);
      }

      ha-card.error {
        --tile-color: var(--warning-color);
      }

      ha-tile-info {
        --ha-tile-info-secondary-color: var(--secondary-text-color);
      }

      ha-card.error ha-tile-info {
        --ha-tile-info-secondary-color: var(--warning-color);
      }
    `,
  ];
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "dm-maintenance-summary-card")) {
  window.customCards.push({
    type: "dm-maintenance-summary-card",
    name: "Maintenance summary",
    description:
      "Home-style maintenance summary tile with configurable tap and hold actions.",
    preview: true,
  });
}

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description?: string;
      documentationURL?: string;
      preview?: boolean;
    }>;
  }

  interface HTMLElementTagNameMap {
    "dm-maintenance-summary-card": DmMaintenanceSummaryCard;
  }
}
