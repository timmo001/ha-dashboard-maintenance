import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { setupLocalize, type LocalizeFunc } from "./localize";
import type {
  DmMaintenanceSummaryCardConfig,
  SummaryMetric,
  SummaryTapAction,
} from "./dm-maintenance-summary-card";
import {
  buildDashboardSummaryPath,
  findLovelaceDashboardConfig,
} from "./lovelace-dashboard";
import type { HomeAssistant } from "./types";

const DEFAULT_SUMMARY: SummaryMetric = "batteries";

const SUMMARY_OPTIONS: SummaryMetric[] = [
  "batteries",
  "repairs",
  "updates",
  "availability",
  "stale",
];

type HaFormValueChangedEvent<T extends Record<string, unknown>> = CustomEvent<{
  value: T;
}>;

const SUMMARY_OPTION_VALUES = new Set<string>(SUMMARY_OPTIONS);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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

const cleanText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const isSummaryMetric = (value: unknown): value is SummaryMetric =>
  typeof value === "string" && SUMMARY_OPTION_VALUES.has(value);

const normalizeSummary = (value: unknown): SummaryMetric =>
  isSummaryMetric(value) ? value : DEFAULT_SUMMARY;

const isDefaultNavigateAction = (action?: SummaryTapAction): boolean =>
  !action ||
  action.action === undefined ||
  (action.action === "navigate" && !cleanText(action.navigation_path));

const normalizeTapAction = (value: unknown): SummaryTapAction | undefined => {
  if (!isObjectRecord(value)) {
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

const normalizeHoldAction = (value: unknown): SummaryTapAction | undefined => {
  const action = normalizeTapAction(value);
  if (!action || action.action === "none") {
    return undefined;
  }
  return action;
};

interface LovelaceDashboardConfig {
  strategy?: {
    type?: string;
  };
}

const isMaintenanceDashboardConfig = (
  config: unknown,
): config is LovelaceDashboardConfig =>
  isObjectRecord(config) &&
  isObjectRecord(config.strategy) &&
  config.strategy.type === "custom:maintenance";

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
        (config) => (isMaintenanceDashboardConfig(config) ? config : undefined),
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
            options: SUMMARY_OPTIONS.map((value) => ({
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
    const labels: Record<string, string> = {
      summary: localize("summary_card.editor.summary_label"),
      title: localize("summary_card.editor.title_label"),
      icon: localize("summary_card.editor.icon_label"),
      tap_action: localize("summary_card.editor.tap_action_label"),
      hold_action: localize("summary_card.editor.hold_action_label"),
    };

    return labels[schema.name] ?? "";
  };

  private _computeHelper = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);
    const helpers: Record<string, string> = {
      summary: localize("summary_card.editor.summary_helper"),
      tap_action: localize("summary_card.editor.tap_action_helper"),
      hold_action: localize("summary_card.editor.hold_action_helper"),
    };

    return helpers[schema.name] ?? "";
  };

  private _valueChanged(ev: HaFormValueChangedEvent<Record<string, unknown>>): void {
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
      ...(summary !== DEFAULT_SUMMARY ? { summary } : {}),
      ...(title ? { title } : {}),
      ...(icon ? { icon } : {}),
      ...(!isDefaultNavigateAction(tapAction) ? { tap_action: tapAction } : {}),
      ...(holdAction ? { hold_action: holdAction } : {}),
    };

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: nextConfig },
        bubbles: true,
        composed: true,
      }),
    );
  }

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
