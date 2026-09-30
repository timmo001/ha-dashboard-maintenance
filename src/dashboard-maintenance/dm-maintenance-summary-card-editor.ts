import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { setupLocalize, type LocalizeFunc } from "./localize";
import type {
  DmMaintenanceSummaryCardConfig,
  SummaryTapAction,
} from "./dm-maintenance-summary-card";
import {
  buildDashboardSummaryPath,
  findLovelaceDashboardConfig,
} from "./lovelace-dashboard";
import {
  DEFAULT_SUMMARY_METRIC,
  isSummaryMetric,
  SUMMARY_METRICS,
  type SummaryMetric,
} from "./summary-metric";
import type { HomeAssistant } from "./types";

interface SummaryFormData {
  summary?: string;
  title?: string;
  icon?: string;
  tap_action?: SummaryTapAction;
  hold_action?: SummaryTapAction;
}

type HaFormValueChangedEvent = CustomEvent<{
  value: SummaryFormData;
}>;

const SUMMARY_LABEL_KEY: Record<
  SummaryMetric,
  | "summary_card.metric.batteries"
  | "summary_card.metric.repairs"
  | "summary_card.metric.updates"
  | "summary_card.metric.availability"
  | "summary_card.metric.stale"
> = {
  batteries: "summary_card.metric.batteries",
  repairs: "summary_card.metric.repairs",
  updates: "summary_card.metric.updates",
  availability: "summary_card.metric.availability",
  stale: "summary_card.metric.stale",
};

const cleanText = (value?: string): string | undefined => {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
};

const normalizeSummary = (value?: string): SummaryMetric =>
  isSummaryMetric(value) ? value : DEFAULT_SUMMARY_METRIC;

const isDefaultNavigateAction = (action?: SummaryTapAction): boolean =>
  !action ||
  action.action === undefined ||
  (action.action === "navigate" && !cleanText(action.navigation_path));

const normalizeTapAction = (value?: SummaryTapAction): SummaryTapAction | undefined => {
  if (!value) {
    return undefined;
  }

  if (value.action === "none") {
    return { action: "none" };
  }

  if (value.action === "navigate") {
    const path = cleanText(value.navigation_path);

    return path ? { action: "navigate", navigation_path: path } : { action: "navigate" };
  }

  return undefined;
};

const normalizeHoldAction = (value?: SummaryTapAction): SummaryTapAction | undefined => {
  const action = normalizeTapAction(value);

  if (!action || action.action === "none") {
    return undefined;
  }

  return action;
};

const DISCOVERY_RETRY_INTERVAL_MS = 15_000;

@customElement("dm-maintenance-summary-card-editor")
class DmMaintenanceSummaryCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DmMaintenanceSummaryCardConfig;
  @state() private _resolvedMaintenanceSummaryPath?: string;

  private _discoveryInFlight = false;
  private _discoveryRetryTimer?: number;

  public connectedCallback(): void {
    super.connectedCallback();
    this._startDiscoveryRetryTimer();
    void this._discoverMaintenanceSummaryPath();
  }

  public disconnectedCallback(): void {
    this._clearDiscoveryRetryTimer();
    super.disconnectedCallback();
  }

  public setConfig(config: DmMaintenanceSummaryCardConfig): void {
    this._config = config;
    void this._discoverMaintenanceSummaryPath();
  }

  protected willUpdate(changedProps: PropertyValues<this>): void {
    if (changedProps.has("hass")) {
      void this._discoverMaintenanceSummaryPath();
    }
  }

  private _startDiscoveryRetryTimer(): void {
    if (this._discoveryRetryTimer !== undefined) {
      return;
    }

    this._discoveryRetryTimer = window.setInterval(() => {
      if (!this._resolvedMaintenanceSummaryPath) {
        void this._discoverMaintenanceSummaryPath();
      }
    }, DISCOVERY_RETRY_INTERVAL_MS);
  }

  private _clearDiscoveryRetryTimer(): void {
    if (this._discoveryRetryTimer !== undefined) {
      window.clearInterval(this._discoveryRetryTimer);
      this._discoveryRetryTimer = undefined;
    }
  }

  private async _discoverMaintenanceSummaryPath(): Promise<void> {
    if (this._discoveryInFlight || !this.hass?.connection) {
      return;
    }

    this._discoveryInFlight = true;

    try {
      const result = await findLovelaceDashboardConfig(
        this.hass.connection,
        (config) =>
          config?.strategy?.type === "custom:maintenance" ? config : undefined,
      );

      if (result) {
        this._resolvedMaintenanceSummaryPath = buildDashboardSummaryPath(result.urlPath);
      }
    } catch {
      // Keep fallback behavior.
    } finally {
      this._discoveryInFlight = false;
    }
  }

  private _buildFormData(config: DmMaintenanceSummaryCardConfig) {
    const summary = normalizeSummary(config.summary ?? config.metric);

    const defaultNavigationPath =
      config.navigation_path || this._resolvedMaintenanceSummaryPath || "summary";

    return {
      summary,
      title: config.title ?? "",
      icon: config.icon ?? "",
      tap_action: config.tap_action ?? {
        action: "navigate",
        navigation_path: defaultNavigationPath,
      },
      hold_action: config.hold_action ?? { action: "none" },
    };
  }

  private _buildFormSchema(localize: LocalizeFunc) {
    return [
      {
        name: "summary",
        selector: {
          select: {
            mode: "dropdown",
            options: SUMMARY_METRICS.map((value) => ({
              value,
              label: localize(SUMMARY_LABEL_KEY[value]),
            })),
          },
        },
      },
      { name: "title", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
      {
        name: "tap_action",
        selector: { ui_action: { actions: ["navigate", "none"] } },
      },
      {
        name: "hold_action",
        selector: { ui_action: { actions: ["navigate", "none"] } },
      },
    ];
  }

  protected render() {
    if (!this._config) {
      return nothing;
    }

    if (!customElements.get("ha-form")) {
      return html`<div class="fallback">ha-form is not available.</div>`;
    }

    const localize = setupLocalize(this.hass);
    const data = this._buildFormData(this._config);
    const schema = this._buildFormSchema(localize);

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${schema}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);

    switch (schema.name) {
      case "summary":
        return localize("summary_card.editor.summary_label");
      case "title":
        return localize("summary_card.editor.title_label");
      case "icon":
        return localize("summary_card.editor.icon_label");
      case "tap_action":
        return localize("summary_card.editor.tap_action_label");
      case "hold_action":
        return localize("summary_card.editor.hold_action_label");
      default:
        return "";
    }
  };

  private _computeHelper = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);

    switch (schema.name) {
      case "summary":
        return localize("summary_card.editor.summary_helper");
      case "tap_action":
        return localize("summary_card.editor.tap_action_helper");
      case "hold_action":
        return localize("summary_card.editor.hold_action_helper");
      default:
        return "";
    }
  };

  private _valueChanged = (ev: HaFormValueChangedEvent): void => {
    if (!this._config) {
      return;
    }

    ev.stopPropagation();
    const value = ev.detail.value;

    const summary = normalizeSummary(value.summary);
    const title = cleanText(value.title);
    const icon = cleanText(value.icon);

    const tapAction = normalizeTapAction(value.tap_action);
    const holdAction = normalizeHoldAction(value.hold_action);

    const nextConfig: DmMaintenanceSummaryCardConfig = {
      type: "custom:dm-maintenance-summary-card",
    };

    if (summary !== DEFAULT_SUMMARY_METRIC) {
      nextConfig.summary = summary;
    }

    if (title) {
      nextConfig.title = title;
    }

    if (icon) {
      nextConfig.icon = icon;
    }

    if (!isDefaultNavigateAction(tapAction)) {
      nextConfig.tap_action = tapAction;
    }

    if (holdAction) {
      nextConfig.hold_action = holdAction;
    }

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: nextConfig },
        bubbles: true,
        composed: true,
      }),
    );
  };

  static styles = css`
    :host {
      display: block;
    }

    .fallback {
      color: var(--error-color);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "dm-maintenance-summary-card-editor": DmMaintenanceSummaryCardEditor;
  }
}
