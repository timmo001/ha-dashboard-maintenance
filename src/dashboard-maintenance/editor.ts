import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import type {
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
} from "./types";
import { DEFAULT_BATTERY_ATTENTION_THRESHOLD } from "./maintenance-data";
import { DEFAULT_STALE_THRESHOLD_HOURS } from "./stale-data";

const DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS = true;

@customElement("dashboard-maintenance-strategy-editor")
export class DashboardMaintenanceStrategyEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: MaintenanceDashboardStrategyConfig;

  public setConfig(config: MaintenanceDashboardStrategyConfig): void {
    this._config = config;
  }

  protected render() {
    if (!this._config) {
      return nothing;
    }

    const localize = setupLocalize(this.hass);

    const threshold =
      this._config.battery_attention_threshold ??
      DEFAULT_BATTERY_ATTENTION_THRESHOLD;
    const showAttentionBatteriesInAreas =
      this._config.show_attention_batteries_in_areas ??
      DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS;
    const staleThreshold =
      this._config.stale_threshold_hours ??
      DEFAULT_STALE_THRESHOLD_HOURS;

    const settingsContent = !customElements.get("ha-form")
      ? html`
          <div class="fallback-editor content">
            <label for="battery-threshold">
              ${localize("editor.battery_threshold_label")}
            </label>
            <input
              id="battery-threshold"
              type="range"
              min="0"
              max="100"
              step="1"
              .value=${String(threshold)}
              @input=${this._nativeValueChanged}
            />
            <div class="helper">
              ${localize("editor.battery_threshold_helper")}
            </div>
            <div class="value">${threshold}%</div>
            <label for="show-attention-batteries-in-areas">
              <input
                id="show-attention-batteries-in-areas"
                type="checkbox"
                .checked=${showAttentionBatteriesInAreas}
                @change=${this._nativeBooleanChanged}
              />
              ${localize("editor.show_attention_in_areas_label")}
            </label>
            <div class="helper">
              ${localize("editor.show_attention_in_areas_helper")}
            </div>
          </div>
        `
      : html`
          <div class="content">
            <ha-form
              .hass=${this.hass}
              .data=${{
                battery_attention_threshold: threshold,
                show_attention_batteries_in_areas:
                  showAttentionBatteriesInAreas,
              }}
              .schema=${[
                {
                  name: "battery_attention_threshold",
                  selector: {
                    number: {
                      min: 0,
                      max: 100,
                      mode: "slider",
                      slider_ticks: true,
                    },
                  },
                },
                {
                  name: "show_attention_batteries_in_areas",
                  selector: {
                    boolean: {},
                  },
                },
              ]}
              .computeLabel=${this._computeLabel}
              .computeHelper=${this._computeHelper}
              @value-changed=${this._valueChanged}
            ></ha-form>
          </div>
        `;

    const staleSettingsContent = !customElements.get("ha-form")
      ? html`
          <div class="fallback-editor content">
            <label for="stale-threshold">
              ${localize("editor.stale_threshold_label")}
            </label>
            <input
              id="stale-threshold"
              type="range"
              min="1"
              max="168"
              step="1"
              .value=${String(staleThreshold)}
              @input=${this._nativeStaleValueChanged}
            />
            <div class="helper">
              ${localize("editor.stale_threshold_helper")}
            </div>
            <div class="value">${staleThreshold}h</div>
          </div>
        `
      : html`
          <div class="content">
            <ha-form
              .hass=${this.hass}
              .data=${{
                stale_threshold_hours: staleThreshold,
              }}
              .schema=${[
                {
                  name: "stale_threshold_hours",
                  selector: {
                    number: {
                      min: 1,
                      max: 168,
                      mode: "slider",
                      unit_of_measurement: "h",
                    },
                  },
                },
              ]}
              .computeLabel=${this._computeLabel}
              .computeHelper=${this._computeHelper}
              @value-changed=${this._staleValueChanged}
            ></ha-form>
          </div>
        `;

    return html`
      <ha-expansion-panel expanded outlined>
        <ha-icon
          slot="leading-icon"
          icon="mdi:battery-heart-variant"
        ></ha-icon>
        <h3 slot="header">${localize("editor.batteries_header")}</h3>
        ${settingsContent}
      </ha-expansion-panel>
      <ha-expansion-panel outlined>
        <ha-icon
          slot="leading-icon"
          icon="mdi:clock-alert-outline"
        ></ha-icon>
        <h3 slot="header">${localize("editor.stale_header")}</h3>
        ${staleSettingsContent}
      </ha-expansion-panel>
    `;
  }

  private _computeLabel = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);

    return schema.name === "battery_attention_threshold"
      ? localize("editor.battery_threshold_label")
      : schema.name === "show_attention_batteries_in_areas"
        ? localize("editor.show_attention_in_areas_label")
      : schema.name === "stale_threshold_hours"
        ? localize("editor.stale_threshold_label")
      : "";
  };

  private _computeHelper = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);

    return schema.name === "battery_attention_threshold"
      ? localize("editor.battery_threshold_helper")
      : schema.name === "show_attention_batteries_in_areas"
        ? localize("editor.show_attention_in_areas_helper")
      : schema.name === "stale_threshold_hours"
        ? localize("editor.stale_threshold_helper")
      : "";
  };

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config) {
      return;
    }

    ev.stopPropagation();

    const threshold = ev.detail.value.battery_attention_threshold as number;
    const showAttentionBatteriesInAreas =
      ev.detail.value.show_attention_batteries_in_areas as boolean;
    this._emitConfigUpdate({
      battery_attention_threshold:
        threshold === DEFAULT_BATTERY_ATTENTION_THRESHOLD
          ? undefined
          : threshold,
      show_attention_batteries_in_areas:
        showAttentionBatteriesInAreas === DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS
          ? undefined
          : showAttentionBatteriesInAreas,
    });
  }

  private _staleValueChanged(ev: CustomEvent): void {
    if (!this._config) {
      return;
    }

    ev.stopPropagation();

    const staleThreshold = ev.detail.value.stale_threshold_hours as number;
    this._emitConfigUpdate({
      stale_threshold_hours:
        staleThreshold === DEFAULT_STALE_THRESHOLD_HOURS
          ? undefined
          : staleThreshold,
    });
  }

  private _nativeValueChanged(ev: Event): void {
    const threshold = Number((ev.currentTarget as HTMLInputElement).value);
    this._emitConfigUpdate({
      battery_attention_threshold:
        threshold === DEFAULT_BATTERY_ATTENTION_THRESHOLD
          ? undefined
          : threshold,
    });
  }

  private _nativeBooleanChanged(ev: Event): void {
    const showAttentionBatteriesInAreas = (
      ev.currentTarget as HTMLInputElement
    ).checked;
    this._emitConfigUpdate({
      show_attention_batteries_in_areas:
        showAttentionBatteriesInAreas === DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS
          ? undefined
          : showAttentionBatteriesInAreas,
    });
  }

  private _nativeStaleValueChanged(ev: Event): void {
    const staleThreshold = Number((ev.currentTarget as HTMLInputElement).value);
    this._emitConfigUpdate({
      stale_threshold_hours:
        staleThreshold === DEFAULT_STALE_THRESHOLD_HOURS
          ? undefined
          : staleThreshold,
    });
  }

  private _emitConfigUpdate(
    updates: Partial<MaintenanceDashboardStrategyConfig>,
  ): void {
    if (!this._config) {
      return;
    }

    const config: MaintenanceDashboardStrategyConfig = {
      ...this._config,
      ...updates,
    };

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      }),
    );
  }

  static styles = [
    css`
      :host {
        display: grid;
        gap: 8px;
      }

      .fallback-editor {
        display: grid;
        gap: 8px;
      }

      ha-expansion-panel {
        display: block;
        --expansion-panel-content-padding: 0;
        border-radius: var(--ha-border-radius-md);
        --ha-card-border-radius: var(--ha-border-radius-md);
      }

      .content {
        padding: 12px;
      }

      h3[slot="header"] {
        margin: 0;
        font-size: inherit;
        font-weight: inherit;
      }

      label {
        font-weight: 500;
      }

      .helper,
      .value {
        color: var(--secondary-text-color);
        font-size: 0.9rem;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "dashboard-maintenance-strategy-editor": DashboardMaintenanceStrategyEditor;
  }
}
