import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { normalizeAvailabilitySafeListDeviceIds } from "./availability-data";
import type {
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
  MaintenanceModuleId,
} from "./types";
import { DEFAULT_BATTERY_ATTENTION_THRESHOLD } from "./maintenance-data";
import { DEFAULT_STALE_THRESHOLD_HOURS, MAX_STALE_THRESHOLD_HOURS, MIN_STALE_THRESHOLD_HOURS } from "./stale-data";

const DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS = true;

interface ModuleDescriptor {
  id: MaintenanceModuleId;
  icon: string;
  headerKey: "editor.batteries_header" | "editor.updates_header" | "editor.repairs_header" | "editor.stale_header" | "editor.availability_header";
  enabledKey: "batteries_enabled" | "updates_enabled" | "repairs_enabled" | "stale_enabled" | "availability_enabled";
}

const MODULES: ReadonlyArray<ModuleDescriptor> = [
  { id: "batteries", icon: "mdi:battery-heart-variant", headerKey: "editor.batteries_header", enabledKey: "batteries_enabled" },
  { id: "repairs", icon: "mdi:wrench", headerKey: "editor.repairs_header", enabledKey: "repairs_enabled" },
  { id: "updates", icon: "mdi:package-up", headerKey: "editor.updates_header", enabledKey: "updates_enabled" },
  { id: "availability", icon: "mdi:help-circle-outline", headerKey: "editor.availability_header", enabledKey: "availability_enabled" },
  { id: "stale", icon: "mdi:clock-alert-outline", headerKey: "editor.stale_header", enabledKey: "stale_enabled" },
];

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

    return html`
      ${MODULES.map((mod) => {
        const enabled = this._config![mod.enabledKey] !== false;
        return html`
          <ha-expansion-panel outlined>
            <ha-icon
              slot="leading-icon"
              icon=${mod.icon}
            ></ha-icon>
            <h3 slot="header">${localize(mod.headerKey)}</h3>
            <div class="content">
              ${this._renderEnableToggle(localize, mod, enabled)}
              ${enabled ? this._renderModuleSettings(localize, mod) : nothing}
            </div>
          </ha-expansion-panel>
        `;
      })}
    `;
  }

  private _renderEnableToggle(
    localize: ReturnType<typeof setupLocalize>,
    mod: ModuleDescriptor,
    enabled: boolean,
  ) {
    if (!customElements.get("ha-form")) {
      return html`
        <div class="fallback-editor">
          <label>
            <input
              type="checkbox"
              .checked=${enabled}
              data-module=${mod.id}
              @change=${this._nativeModuleEnabledChanged}
            />
            ${localize("editor.module_enabled_label")}
          </label>
          <div class="helper">
            ${localize("editor.module_enabled_helper")}
          </div>
        </div>
      `;
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${{ [`${mod.id}_enabled`]: enabled }}
        .schema=${[
          {
            name: `${mod.id}_enabled`,
            selector: { boolean: {} },
          },
        ]}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._moduleEnabledChanged}
      ></ha-form>
    `;
  }

  private _renderModuleSettings(
    localize: ReturnType<typeof setupLocalize>,
    mod: ModuleDescriptor,
  ) {
    switch (mod.id) {
      case "batteries":
        return this._renderBatterySettings(localize);
      case "stale":
        return this._renderStaleSettings(localize);
      case "availability":
        return this._renderAvailabilitySettings(localize);
      default:
        return nothing;
    }
  }

  private _renderAvailabilitySettings(localize: ReturnType<typeof setupLocalize>) {
    const safeListDeviceIds =
      this._config!.availability_safe_list_device_ids ?? [];

    if (!customElements.get("ha-form")) {
      return html`
        <div class="fallback-editor">
          <label for="availability-safe-list">
            ${localize("editor.availability_safe_list_label")}
          </label>
          <textarea
            id="availability-safe-list"
            rows="4"
            .value=${safeListDeviceIds.join("\n")}
            @input=${this._nativeAvailabilitySafeListChanged}
          ></textarea>
          <div class="helper">
            ${localize("editor.availability_safe_list_helper")}
          </div>
        </div>
      `;
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${{
          availability_safe_list_device_ids: safeListDeviceIds,
        }}
        .schema=${[
          {
            name: "availability_safe_list_device_ids",
            selector: {
              device: {
                multiple: true,
              },
            },
          },
        ]}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._availabilityValueChanged}
      ></ha-form>
    `;
  }

  private _renderBatterySettings(localize: ReturnType<typeof setupLocalize>) {
    const threshold =
      this._config!.battery_attention_threshold ??
      DEFAULT_BATTERY_ATTENTION_THRESHOLD;
    const showAttentionBatteriesInAreas =
      this._config!.show_attention_batteries_in_areas ??
      DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS;

    if (!customElements.get("ha-form")) {
      return html`
        <div class="fallback-editor">
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
      `;
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${{
          battery_attention_threshold: threshold,
          show_attention_batteries_in_areas: showAttentionBatteriesInAreas,
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
    `;
  }

  private _renderStaleSettings(localize: ReturnType<typeof setupLocalize>) {
    const staleThreshold =
      this._config!.stale_threshold_hours ?? DEFAULT_STALE_THRESHOLD_HOURS;

    if (!customElements.get("ha-form")) {
      return html`
        <div class="fallback-editor">
          <label for="stale-threshold">
            ${localize("editor.stale_threshold_label")}
          </label>
          <input
            id="stale-threshold"
            type="range"
            min=${MIN_STALE_THRESHOLD_HOURS}
            max=${MAX_STALE_THRESHOLD_HOURS}
            step="1"
            .value=${String(staleThreshold)}
            @input=${this._nativeStaleValueChanged}
          />
          <div class="helper">
            ${localize("editor.stale_threshold_helper")}
          </div>
          <div class="value">${staleThreshold}h</div>
        </div>
      `;
    }

    return html`
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
                min: MIN_STALE_THRESHOLD_HOURS,
                max: MAX_STALE_THRESHOLD_HOURS,
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
    `;
  }

  private _computeLabel = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);
    const labelMap: Record<string, ReturnType<typeof localize>> = {
      battery_attention_threshold: localize("editor.battery_threshold_label"),
      show_attention_batteries_in_areas: localize("editor.show_attention_in_areas_label"),
      availability_safe_list_device_ids: localize("editor.availability_safe_list_label"),
      stale_threshold_hours: localize("editor.stale_threshold_label"),
    };

    if (schema.name.endsWith("_enabled")) {
      return localize("editor.module_enabled_label");
    }

    return labelMap[schema.name] ?? "";
  };

  private _computeHelper = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);
    const helperMap: Record<string, ReturnType<typeof localize>> = {
      battery_attention_threshold: localize("editor.battery_threshold_helper"),
      show_attention_batteries_in_areas: localize("editor.show_attention_in_areas_helper"),
      availability_safe_list_device_ids: localize("editor.availability_safe_list_helper"),
      stale_threshold_hours: localize("editor.stale_threshold_helper"),
    };

    if (schema.name.endsWith("_enabled")) {
      return localize("editor.module_enabled_helper");
    }

    return helperMap[schema.name] ?? "";
  };

  /* ---- ha-form value-changed handlers ---- */

  private _moduleEnabledChanged(ev: CustomEvent): void {
    if (!this._config) {
      return;
    }
    ev.stopPropagation();

    const data = ev.detail.value as Record<string, boolean>;
    const updates: Partial<MaintenanceDashboardStrategyConfig> = {};

    for (const key of Object.keys(data)) {
      if (key.endsWith("_enabled")) {
        (updates as Record<string, boolean | undefined>)[key] =
          data[key] === true ? undefined : false;
      }
    }

    this._emitConfigUpdate(updates);
  }

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

  private _availabilityValueChanged(ev: CustomEvent): void {
    if (!this._config) {
      return;
    }

    ev.stopPropagation();

    const safeListDeviceIds = normalizeAvailabilitySafeListDeviceIds(
      ev.detail.value.availability_safe_list_device_ids as string[] | undefined,
    );
    this._emitConfigUpdate({
      availability_safe_list_device_ids:
        safeListDeviceIds.length > 0 ? safeListDeviceIds : undefined,
    });
  }

  /* ---- Native fallback handlers ---- */

  private _nativeModuleEnabledChanged(ev: Event): void {
    const input = ev.currentTarget as HTMLInputElement;
    const moduleId = input.dataset.module as MaintenanceModuleId;
    const enabled = input.checked;
    this._emitConfigUpdate({
      [`${moduleId}_enabled`]: enabled ? undefined : false,
    } as Partial<MaintenanceDashboardStrategyConfig>);
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

  private _nativeAvailabilitySafeListChanged(ev: Event): void {
    const safeListDeviceIds = normalizeAvailabilitySafeListDeviceIds(
      (ev.currentTarget as HTMLTextAreaElement).value
        .split(/[\n,]/)
        .map((value) => value.trim()),
    );
    this._emitConfigUpdate({
      availability_safe_list_device_ids:
        safeListDeviceIds.length > 0 ? safeListDeviceIds : undefined,
    });
  }

  /* ---- Config emit ---- */

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

      textarea {
        width: 100%;
        min-height: 96px;
        box-sizing: border-box;
        font: inherit;
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
