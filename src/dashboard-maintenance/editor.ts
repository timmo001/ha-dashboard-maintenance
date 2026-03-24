import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import type {
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
} from "./types";
import { DEFAULT_BATTERY_ATTENTION_THRESHOLD } from "./maintenance-data";

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

    return html`
      <ha-expansion-panel expanded outlined>
        <ha-icon
          slot="leading-icon"
          icon="mdi:battery-heart-variant"
        ></ha-icon>
        <h3 slot="header">${localize("editor.batteries_header")}</h3>
        ${settingsContent}
      </ha-expansion-panel>
    `;
  }

  private _computeLabel = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);

    return schema.name === "battery_attention_threshold"
      ? localize("editor.battery_threshold_label")
      : schema.name === "show_attention_batteries_in_areas"
        ? localize("editor.show_attention_in_areas_label")
      : "";
  };

  private _computeHelper = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);

    return schema.name === "battery_attention_threshold"
      ? localize("editor.battery_threshold_helper")
      : schema.name === "show_attention_batteries_in_areas"
        ? localize("editor.show_attention_in_areas_helper")
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
    this._emitConfigChanged(threshold, showAttentionBatteriesInAreas);
  }

  private _nativeValueChanged(ev: Event): void {
    const threshold = Number((ev.currentTarget as HTMLInputElement).value);
    const showAttentionBatteriesInAreas =
      this._config?.show_attention_batteries_in_areas ??
      DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS;
    this._emitConfigChanged(threshold, showAttentionBatteriesInAreas);
  }

  private _nativeBooleanChanged(ev: Event): void {
    const showAttentionBatteriesInAreas = (
      ev.currentTarget as HTMLInputElement
    ).checked;
    const threshold =
      this._config?.battery_attention_threshold ??
      DEFAULT_BATTERY_ATTENTION_THRESHOLD;
    this._emitConfigChanged(threshold, showAttentionBatteriesInAreas);
  }

  private _emitConfigChanged(
    threshold: number,
    showAttentionBatteriesInAreas: boolean,
  ): void {
    if (!this._config) {
      return;
    }

    const config: MaintenanceDashboardStrategyConfig = {
      ...this._config,
      battery_attention_threshold:
        threshold === DEFAULT_BATTERY_ATTENTION_THRESHOLD
          ? undefined
          : threshold,
      show_attention_batteries_in_areas:
        showAttentionBatteriesInAreas ===
        DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS
          ? undefined
          : showAttentionBatteriesInAreas,
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
