import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
} from "./types";
import { DEFAULT_BATTERY_ATTENTION_THRESHOLD } from "./maintenance-data";

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

    const threshold =
      this._config.battery_attention_threshold ??
      DEFAULT_BATTERY_ATTENTION_THRESHOLD;

    if (!customElements.get("ha-form")) {
      return html`
        <div class="fallback-editor">
          <label for="battery-threshold">Battery attention threshold</label>
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
            Devices below this battery level are marked as needing attention.
          </div>
          <div class="value">${threshold}%</div>
        </div>
      `;
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${{
          battery_attention_threshold: threshold,
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
        ]}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: { name: string }): string =>
    schema.name === "battery_attention_threshold"
      ? "Battery attention threshold"
      : "";

  private _computeHelper = (schema: { name: string }): string =>
    schema.name === "battery_attention_threshold"
      ? "Devices below this battery level are marked as needing attention."
      : "";

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config) {
      return;
    }

    ev.stopPropagation();

    const threshold = ev.detail.value.battery_attention_threshold as number;
    this._emitConfigChanged(threshold);
  }

  private _nativeValueChanged(ev: Event): void {
    const threshold = Number((ev.currentTarget as HTMLInputElement).value);
    this._emitConfigChanged(threshold);
  }

  private _emitConfigChanged(threshold: number): void {
    if (!this._config) {
      return;
    }

    const config: MaintenanceDashboardStrategyConfig = {
      ...this._config,
      battery_attention_threshold:
        threshold === DEFAULT_BATTERY_ATTENTION_THRESHOLD
          ? undefined
          : threshold,
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
