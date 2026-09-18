import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { normalizeAvailabilitySafeListDeviceIds } from "./availability-data";
import type {
  BatteryTileFeature,
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
  MaintenanceModuleId,
} from "./types";
import {
  BATTERY_TILE_FEATURES,
  DEFAULT_BATTERY_TILE_FEATURE,
} from "./types";
import { DEFAULT_BATTERY_ATTENTION_THRESHOLD } from "./maintenance-data";
import {
  DEFAULT_STALE_THRESHOLD_HOURS,
  MAX_STALE_THRESHOLD_HOURS,
  MIN_STALE_THRESHOLD_HOURS,
} from "./stale-data";

const DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS = true;

interface ModuleDescriptor {
  id: MaintenanceModuleId;
  icon: string;
  headerKey:
    | "editor.system_header"
    | "editor.batteries_header"
    | "editor.updates_header"
    | "editor.repairs_header"
    | "editor.stale_header"
    | "editor.availability_header"
    | "editor.integrations_header";
  enabledKey:
    | "system_enabled"
    | "batteries_enabled"
    | "updates_enabled"
    | "repairs_enabled"
    | "stale_enabled"
    | "availability_enabled"
    | "integrations_enabled";
}

const MODULES = [
  {
    id: "system",
    icon: "mdi:server",
    headerKey: "editor.system_header",
    enabledKey: "system_enabled",
  },
  {
    id: "batteries",
    icon: "mdi:battery-heart-variant",
    headerKey: "editor.batteries_header",
    enabledKey: "batteries_enabled",
  },
  {
    id: "repairs",
    icon: "mdi:wrench",
    headerKey: "editor.repairs_header",
    enabledKey: "repairs_enabled",
  },
  {
    id: "updates",
    icon: "mdi:package-up",
    headerKey: "editor.updates_header",
    enabledKey: "updates_enabled",
  },
  {
    id: "availability",
    icon: "mdi:help-circle-outline",
    headerKey: "editor.availability_header",
    enabledKey: "availability_enabled",
  },
  {
    id: "stale",
    icon: "mdi:clock-alert-outline",
    headerKey: "editor.stale_header",
    enabledKey: "stale_enabled",
  },
  {
    id: "integrations",
    icon: "mdi:puzzle",
    headerKey: "editor.integrations_header",
    enabledKey: "integrations_enabled",
  },
] as const satisfies readonly ModuleDescriptor[];

type ModuleEnabledKey = ModuleDescriptor["enabledKey"];

type HaFormValueChangedEvent<T extends Record<string, unknown>> = CustomEvent<{
  value: T;
}>;

interface HaFormSchema {
  name: string;
  selector: Record<string, unknown>;
  hidden?: {
    field: ModuleEnabledKey;
    value: false;
  };
}

const isMaintenanceModuleId = (value: string): value is MaintenanceModuleId =>
  MODULES.some((mod) => mod.id === value);

const isBatteryTileFeature = (value: string): value is BatteryTileFeature =>
  (BATTERY_TILE_FEATURES as readonly string[]).includes(value);

@customElement("dashboard-maintenance-strategy-editor")
class DashboardMaintenanceStrategyEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: MaintenanceDashboardStrategyConfig;

  @state() private _activeModule: MaintenanceModuleId = MODULES[0].id;

  public setConfig(config: MaintenanceDashboardStrategyConfig): void {
    this._config = config;
  }

  protected render() {
    if (!this._config) {
      return nothing;
    }

    const localize = setupLocalize(this.hass);
    const activeModule =
      MODULES.find((mod) => mod.id === this._activeModule) ?? MODULES[0];
    const enabled = this._config[activeModule.enabledKey] !== false;

    return html`
      <ha-tab-group @wa-tab-show=${this._moduleTabChanged}>
        ${MODULES.map(
          (mod) => html`
            <ha-tab-group-tab
              slot="nav"
              panel=${mod.id}
              .active=${activeModule.id === mod.id}
            >
              <ha-icon icon=${mod.icon}></ha-icon>
              ${localize(mod.headerKey)}
            </ha-tab-group-tab>
          `,
        )}
      </ha-tab-group>

      <div class="panel-content">
        ${customElements.get("ha-form")
          ? this._renderModuleForm(localize, activeModule, enabled, this._config)
          : html`
              ${this._renderEnableToggle(localize, activeModule, enabled)}
              ${enabled
                ? this._renderModuleSettings(
                    localize,
                    activeModule,
                    this._config,
                  )
                : nothing}
            `}
      </div>
    `;
  }

  private _moduleTabChanged(ev: CustomEvent<{ name?: string }>): void {
    const tabName = ev.detail?.name;
    if (!tabName || tabName === this._activeModule) {
      return;
    }

    const matchedModule = MODULES.find((mod) => mod.id === tabName);
    if (!matchedModule) {
      return;
    }

    this._activeModule = matchedModule.id;
  }

  private _renderEnableToggle(
    localize: ReturnType<typeof setupLocalize>,
    mod: ModuleDescriptor,
    enabled: boolean,
  ) {
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
        <div class="helper">${localize("editor.module_enabled_helper")}</div>
      </div>
    `;
  }

  private _renderModuleForm(
    localize: ReturnType<typeof setupLocalize>,
    mod: ModuleDescriptor,
    enabled: boolean,
    config: MaintenanceDashboardStrategyConfig,
  ) {
    const data: Record<string, unknown> = { [mod.enabledKey]: enabled };
    const schema: HaFormSchema[] = [
      { name: mod.enabledKey, selector: { boolean: {} } },
    ];
    const hidden = { field: mod.enabledKey, value: false } as const;

    switch (mod.id) {
      case "batteries":
        Object.assign(data, {
          battery_attention_threshold:
            config.battery_attention_threshold ??
            DEFAULT_BATTERY_ATTENTION_THRESHOLD,
          show_attention_batteries_in_areas:
            config.show_attention_batteries_in_areas ??
            DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS,
          battery_tile_feature:
            config.battery_tile_feature ?? DEFAULT_BATTERY_TILE_FEATURE,
        });
        schema.push(
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
            hidden,
          },
          {
            name: "show_attention_batteries_in_areas",
            selector: { boolean: {} },
            hidden,
          },
          {
            name: "battery_tile_feature",
            selector: {
              select: {
                mode: "list",
                options: BATTERY_TILE_FEATURES.map((option) => ({
                  value: option,
                  label: localize(
                    `editor.battery_tile_feature_option_${option}`,
                  ),
                })),
              },
            },
            hidden,
          },
        );
        break;
      case "stale":
        data.stale_threshold_hours =
          config.stale_threshold_hours ?? DEFAULT_STALE_THRESHOLD_HOURS;
        schema.push({
          name: "stale_threshold_hours",
          selector: {
            number: {
              min: MIN_STALE_THRESHOLD_HOURS,
              max: MAX_STALE_THRESHOLD_HOURS,
              mode: "slider",
              unit_of_measurement: "h",
            },
          },
          hidden,
        });
        break;
      case "availability":
        data.availability_safe_list_device_ids =
          config.availability_safe_list_device_ids ?? [];
        schema.push({
          name: "availability_safe_list_device_ids",
          selector: { device: { multiple: true } },
          hidden,
        });
        break;
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${schema}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._formValueChanged}
      ></ha-form>
    `;
  }

  private _renderModuleSettings(
    localize: ReturnType<typeof setupLocalize>,
    mod: ModuleDescriptor,
    config: MaintenanceDashboardStrategyConfig,
  ) {
    switch (mod.id) {
      case "batteries":
        return this._renderBatterySettings(localize, config);
      case "stale":
        return this._renderStaleSettings(localize, config);
      case "availability":
        return this._renderAvailabilitySettings(localize, config);
      default:
        return nothing;
    }
  }

  private _renderAvailabilitySettings(
    localize: ReturnType<typeof setupLocalize>,
    config: MaintenanceDashboardStrategyConfig,
  ) {
    const safeListDeviceIds =
      config.availability_safe_list_device_ids ?? [];

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

  private _renderBatterySettings(
    localize: ReturnType<typeof setupLocalize>,
    config: MaintenanceDashboardStrategyConfig,
  ) {
    const threshold =
      config.battery_attention_threshold ??
      DEFAULT_BATTERY_ATTENTION_THRESHOLD;
    const showAttentionBatteriesInAreas =
      config.show_attention_batteries_in_areas ??
      DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS;
    const batteryTileFeature =
      config.battery_tile_feature ?? DEFAULT_BATTERY_TILE_FEATURE;

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
          <fieldset class="radio-group">
            <legend>${localize("editor.battery_tile_feature_label")}</legend>
            ${BATTERY_TILE_FEATURES.map(
              (option) => html`
                <label>
                  <input
                    type="radio"
                    name="battery-tile-feature"
                    value=${option}
                    .checked=${batteryTileFeature === option}
                    @change=${this._nativeBatteryTileFeatureChanged}
                  />
                  ${localize(`editor.battery_tile_feature_option_${option}`)}
                </label>
              `,
            )}
            <div class="helper">
              ${localize("editor.battery_tile_feature_helper")}
            </div>
          </fieldset>
        </div>
      `;
  }

  private _renderStaleSettings(
    localize: ReturnType<typeof setupLocalize>,
    config: MaintenanceDashboardStrategyConfig,
  ) {
    const staleThreshold =
      config.stale_threshold_hours ?? DEFAULT_STALE_THRESHOLD_HOURS;

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
          <div class="helper">${localize("editor.stale_threshold_helper")}</div>
          <div class="value">${staleThreshold}h</div>
        </div>
      `;
  }

  private _computeLabel = (schema: { name: string }): string => {
    const localize = setupLocalize(this.hass);
    const labelMap: Record<string, ReturnType<typeof localize>> = {
      battery_attention_threshold: localize("editor.battery_threshold_label"),
      show_attention_batteries_in_areas: localize(
        "editor.show_attention_in_areas_label",
      ),
      battery_tile_feature: localize("editor.battery_tile_feature_label"),
      availability_safe_list_device_ids: localize(
        "editor.availability_safe_list_label",
      ),
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
      show_attention_batteries_in_areas: localize(
        "editor.show_attention_in_areas_helper",
      ),
      battery_tile_feature: localize("editor.battery_tile_feature_helper"),
      availability_safe_list_device_ids: localize(
        "editor.availability_safe_list_helper",
      ),
      stale_threshold_hours: localize("editor.stale_threshold_helper"),
    };

    if (schema.name.endsWith("_enabled")) {
      return localize("editor.module_enabled_helper");
    }

    return helperMap[schema.name] ?? "";
  };

  /* ---- ha-form value-changed handlers ---- */

  private _formValueChanged(
    ev: HaFormValueChangedEvent<Record<string, unknown>>,
  ): void {
    if (!this._config) {
      return;
    }
    ev.stopPropagation();

    const data = ev.detail.value;
    const updates: Partial<MaintenanceDashboardStrategyConfig> = {};

    const activeModule =
      MODULES.find((mod) => mod.id === this._activeModule) ?? MODULES[0];
    const enabled = data[activeModule.enabledKey];
    if (typeof enabled === "boolean") {
      updates[activeModule.enabledKey] = enabled ? undefined : false;
    }

    if (activeModule.id === "batteries") {
      const threshold = data.battery_attention_threshold;
      const showAttentionBatteriesInAreas =
        data.show_attention_batteries_in_areas;
      const batteryTileFeature = data.battery_tile_feature;
      updates.battery_attention_threshold =
        typeof threshold !== "number" ||
        threshold === DEFAULT_BATTERY_ATTENTION_THRESHOLD
          ? undefined
          : threshold;
      updates.show_attention_batteries_in_areas =
        typeof showAttentionBatteriesInAreas !== "boolean" ||
        showAttentionBatteriesInAreas ===
          DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS
          ? undefined
          : showAttentionBatteriesInAreas;
      updates.battery_tile_feature =
        typeof batteryTileFeature !== "string" ||
        !isBatteryTileFeature(batteryTileFeature) ||
        batteryTileFeature === DEFAULT_BATTERY_TILE_FEATURE
          ? undefined
          : batteryTileFeature;
    } else if (activeModule.id === "stale") {
      const staleThreshold = data.stale_threshold_hours;
      updates.stale_threshold_hours =
        typeof staleThreshold !== "number" ||
        staleThreshold === DEFAULT_STALE_THRESHOLD_HOURS
          ? undefined
          : staleThreshold;
    } else if (activeModule.id === "availability") {
      const safeListDeviceIds = normalizeAvailabilitySafeListDeviceIds(
        Array.isArray(data.availability_safe_list_device_ids)
          ? data.availability_safe_list_device_ids.filter(
              (value): value is string => typeof value === "string",
            )
          : undefined,
      );
      updates.availability_safe_list_device_ids =
        safeListDeviceIds.length > 0 ? safeListDeviceIds : undefined;
    }

    this._emitConfigUpdate(updates);
  }

  /* ---- Native fallback handlers ---- */

  private _nativeModuleEnabledChanged(ev: Event): void {
    if (!(ev.currentTarget instanceof HTMLInputElement)) {
      return;
    }

    const input = ev.currentTarget;
    const moduleId = input.dataset.module;
    if (!moduleId || !isMaintenanceModuleId(moduleId)) {
      return;
    }

    const enabled = input.checked;
    this._emitConfigUpdate({
      [`${moduleId}_enabled`]: enabled ? undefined : false,
    });
  }

  private _nativeValueChanged(ev: Event): void {
    if (!(ev.currentTarget instanceof HTMLInputElement)) {
      return;
    }

    const threshold = Number(ev.currentTarget.value);
    this._emitConfigUpdate({
      battery_attention_threshold:
        threshold === DEFAULT_BATTERY_ATTENTION_THRESHOLD
          ? undefined
          : threshold,
    });
  }

  private _nativeBooleanChanged(ev: Event): void {
    if (!(ev.currentTarget instanceof HTMLInputElement)) {
      return;
    }

    const showAttentionBatteriesInAreas = ev.currentTarget.checked;
    this._emitConfigUpdate({
      show_attention_batteries_in_areas:
        showAttentionBatteriesInAreas ===
        DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS
          ? undefined
          : showAttentionBatteriesInAreas,
    });
  }

  private _nativeBatteryTileFeatureChanged(ev: Event): void {
    if (!(ev.currentTarget instanceof HTMLInputElement)) {
      return;
    }
    if (!ev.currentTarget.checked) {
      return;
    }

    const value = ev.currentTarget.value;
    if (!isBatteryTileFeature(value)) {
      return;
    }

    this._emitConfigUpdate({
      battery_tile_feature:
        value === DEFAULT_BATTERY_TILE_FEATURE ? undefined : value,
    });
  }

  private _nativeStaleValueChanged(ev: Event): void {
    if (!(ev.currentTarget instanceof HTMLInputElement)) {
      return;
    }

    const staleThreshold = Number(ev.currentTarget.value);
    this._emitConfigUpdate({
      stale_threshold_hours:
        staleThreshold === DEFAULT_STALE_THRESHOLD_HOURS
          ? undefined
          : staleThreshold,
    });
  }

  private _nativeAvailabilitySafeListChanged(ev: Event): void {
    if (!(ev.currentTarget instanceof HTMLTextAreaElement)) {
      return;
    }

    const safeListDeviceIds = normalizeAvailabilitySafeListDeviceIds(
      ev.currentTarget.value
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
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .fallback-editor {
        display: grid;
        gap: 8px;
      }

      ha-tab-group {
        display: block;
      }

      ha-tab-group-tab {
        flex: 1;
      }

      ha-tab-group-tab::part(base) {
        width: 100%;
        justify-content: center;
      }

      .panel-content {
        padding: 12px;
      }

      ha-tab-group-tab ha-icon,
      .panel-content ha-icon {
        color: var(--secondary-text-color);
        margin-inline-end: 8px;
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
