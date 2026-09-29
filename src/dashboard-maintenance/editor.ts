import { LitElement, css, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { setupLocalize } from "./localize";
import { normalizeAvailabilitySafeListDeviceIds } from "./availability-data";
import {
  editorItemGroupStyles,
  renderEditorItemGroup,
  renderEditorItemRow,
} from "./editor-item-group";
import { computeDeviceName } from "./entity-helpers";
import type {
  BatteryThresholdOverride,
  BatteryTileFeature,
  ConfigEntry,
  HomeAssistant,
  MaintenanceDashboardStrategyConfig,
  MaintenanceModuleId,
} from "./types";
import {
  BATTERY_TILE_FEATURES,
  DEFAULT_BATTERY_TILE_FEATURE,
} from "./types";
import {
  DEFAULT_BATTERY_ATTENTION_THRESHOLD,
  fetchConfigEntries,
  getBatteryPreviewDevice,
  type MaintenanceBatteryDevice,
} from "./maintenance-data";
import {
  makeBatteryCard,
  type LovelaceCardConfig,
} from "./maintenance-view-helpers";
import {
  DEFAULT_STALE_THRESHOLD_HOURS,
  MAX_STALE_THRESHOLD_HOURS,
  MIN_STALE_THRESHOLD_HOURS,
} from "./stale-data";

const DEFAULT_SHOW_ATTENTION_BATTERIES_IN_AREAS = true;

const BATTERY_ENTITY_FILTER = { domain: "sensor", device_class: "battery" };

const MDI_DELETE_PATH =
  "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z";
const MDI_PENCIL_PATH =
  "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z";
const MDI_PLUS_PATH = "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z";

interface BatteryThresholdOverrideDraft {
  index: number;
  entity_id?: string;
  threshold: number;
}

const toBatteryThreshold = (value: number): number =>
  Math.min(Math.max(Math.round(value), 0), 100);

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
  descriptionKey:
    | "editor.system_description"
    | "editor.batteries_description"
    | "editor.updates_description"
    | "editor.repairs_description"
    | "editor.stale_description"
    | "editor.availability_description"
    | "editor.integrations_description";
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
    descriptionKey: "editor.system_description",
    enabledKey: "system_enabled",
  },
  {
    id: "batteries",
    icon: "mdi:battery-heart-variant",
    headerKey: "editor.batteries_header",
    descriptionKey: "editor.batteries_description",
    enabledKey: "batteries_enabled",
  },
  {
    id: "repairs",
    icon: "mdi:wrench",
    headerKey: "editor.repairs_header",
    descriptionKey: "editor.repairs_description",
    enabledKey: "repairs_enabled",
  },
  {
    id: "updates",
    icon: "mdi:package-up",
    headerKey: "editor.updates_header",
    descriptionKey: "editor.updates_description",
    enabledKey: "updates_enabled",
  },
  {
    id: "availability",
    icon: "mdi:help-circle-outline",
    headerKey: "editor.availability_header",
    descriptionKey: "editor.availability_description",
    enabledKey: "availability_enabled",
  },
  {
    id: "stale",
    icon: "mdi:clock-alert-outline",
    headerKey: "editor.stale_header",
    descriptionKey: "editor.stale_description",
    enabledKey: "stale_enabled",
  },
  {
    id: "integrations",
    icon: "mdi:puzzle",
    headerKey: "editor.integrations_header",
    descriptionKey: "editor.integrations_description",
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

  @state() private _overrideDraft?: BatteryThresholdOverrideDraft;

  @state() private _overridesExpanded = false;

  @state() private _safeListExpanded = false;

  @state() private _configEntries?: Record<string, ConfigEntry>;

  private _previewCard?: { key: string; config: LovelaceCardConfig };

  private _dialog?: { element: HTMLElement & { width?: string }; width?: string };

  private _scrollTop?: number;

  private _dialogBody(): HTMLElement | null | undefined {
    return this._dialog?.element.shadowRoot?.querySelector<HTMLElement>(
      ".body",
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    for (const tag of ["ha-entity-picker", "ha-device-picker"]) {
      if (!customElements.get(tag)) {
        customElements.whenDefined(tag).then(() => this.requestUpdate());
      }
    }

    // The strategy editor dialog is large; use the default dialog width instead.
    let node: Node | null = this;
    while (node && !(node instanceof HTMLElement && node.localName === "ha-dialog")) {
      node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null);
    }
    if (node) {
      const element = node as HTMLElement & { width?: string };
      this._dialog = { element, width: element.width };
      element.width = "medium";
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._dialog) {
      this._dialog.element.width = this._dialog.width;
      this._dialog = undefined;
    }
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (
      changedProps.has("_overrideDraft") &&
      !changedProps.get("_overrideDraft") &&
      this._overrideDraft
    ) {
      this._scrollTop = this._dialogBody()?.scrollTop;
    }

    if (
      this.hass &&
      !this._configEntries &&
      this._config?.availability_enabled !== false
    ) {
      this._configEntries = {};
      fetchConfigEntries(this.hass).then((entries) => {
        this._configEntries = entries;
      });
    }
  }

  protected async updated(changedProps: PropertyValues): Promise<void> {
    if (
      changedProps.has("_overrideDraft") &&
      !changedProps.get("_overrideDraft") !== !this._overrideDraft
    ) {
      const body = this._dialogBody();
      if (body) {
        const scrollTop = this._overrideDraft ? 0 : (this._scrollTop ?? 0);
        body.scrollTop = scrollTop;
        // Nested forms render after this update, so restore again once they have.
        requestAnimationFrame(() => {
          body.scrollTop = scrollTop;
        });
      }
    }

    // ha-device-picker does not forward add-button, so set it on its inner picker.
    const devicePicker = this.shadowRoot?.querySelector("ha-device-picker");
    if (!devicePicker) {
      return;
    }
    await (devicePicker as { updateComplete?: Promise<unknown> })
      .updateComplete;
    const innerPicker = devicePicker.shadowRoot?.querySelector(
      "ha-generic-picker",
    ) as { addButtonLabel?: string } | null | undefined;
    const label = setupLocalize(this.hass)("editor.availability_safe_list_add");
    if (innerPicker && innerPicker.addButtonLabel !== label) {
      innerPicker.addButtonLabel = label;
    }
  }

  public setConfig(config: MaintenanceDashboardStrategyConfig): void {
    this._config = config;
  }

  protected render() {
    if (!this._config) {
      return nothing;
    }

    const localize = setupLocalize(this.hass);

    if (this._overrideDraft) {
      return this._renderOverrideEditor(
        localize,
        this._config,
        this._overrideDraft,
      );
    }

    const config = this._config;
    const hasForm = Boolean(customElements.get("ha-form"));

    return MODULES.map((mod) => {
      const enabled = config[mod.enabledKey] !== false;

      return html`
        <ha-expansion-panel
          class="module"
          outlined
          expanded
          .header=${localize(mod.headerKey)}
          .secondary=${localize(mod.descriptionKey)}
        >
          <ha-icon slot="leading-icon" icon=${mod.icon}></ha-icon>
          <div class="expansion-content">
            ${hasForm
              ? this._renderModuleForm(localize, mod, enabled, config)
              : html`
                  ${this._renderEnableToggle(localize, mod, enabled)}
                  ${enabled
                    ? this._renderModuleSettings(localize, mod, config)
                    : nothing}
                `}
          </div>
        </ha-expansion-panel>
      `;
    });
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
          {
            name: "show_attention_batteries_in_areas",
            selector: { boolean: {} },
            hidden,
          },
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
    }

    if (mod.id === "batteries" && enabled) {
      return html`
        ${this._renderForm(mod, data, schema)}
        ${this._renderBatteryThresholdOverrides(
          localize,
          config.battery_threshold_overrides ?? [],
        )}
      `;
    }

    if (mod.id === "availability" && enabled) {
      return html`
        ${this._renderForm(mod, data, schema)}
        ${this._renderAvailabilitySafeList(
          localize,
          config.availability_safe_list_device_ids ?? [],
        )}
      `;
    }

    return this._renderForm(mod, data, schema);
  }

  private _renderForm(
    mod: ModuleDescriptor,
    data: Record<string, unknown>,
    schema: HaFormSchema[],
  ) {
    return html`
      <ha-form
        data-module=${mod.id}
        .hass=${this.hass}
        .data=${data}
        .schema=${schema}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._formValueChanged}
      ></ha-form>
    `;
  }

  private _renderBatteryThresholdOverrides(
    localize: ReturnType<typeof setupLocalize>,
    overrides: BatteryThresholdOverride[],
  ) {
    return renderEditorItemGroup({
      header: localize("editor.battery_overrides_label"),
      secondary: localize("editor.battery_overrides_helper"),
      icon: "mdi:battery-alert-variant-outline",
      expanded: this._overridesExpanded,
      onExpandedChanged: this._overridesExpandedChanged,
      rows: overrides.map((override, index) => {
        const stateObj = this.hass?.states[override.entity_id];
        const name =
          (this.hass &&
            getBatteryPreviewDevice(
              this.hass,
              override.entity_id,
              override.threshold,
            )?.deviceName) ||
          override.entity_id;

        return renderEditorItemRow({
          icon: stateObj
            ? html`
                <ha-state-icon
                  .hass=${this.hass}
                  .stateObj=${stateObj}
                ></ha-state-icon>
              `
            : html`<ha-icon icon="mdi:battery-unknown"></ha-icon>`,
          primary: name,
          secondary: localize("editor.battery_override_threshold_value", {
            threshold: override.threshold,
          }),
          actions: html`
            <ha-icon-button
              .label=${localize("editor.battery_override_edit")}
              .path=${MDI_PENCIL_PATH}
              data-index=${index}
              @click=${this._editOverride}
            ></ha-icon-button>
            <ha-icon-button
              .label=${localize("editor.battery_override_remove")}
              .path=${MDI_DELETE_PATH}
              data-index=${index}
              @click=${this._removeOverride}
            ></ha-icon-button>
          `,
        });
      }),
      adder: customElements.get("ha-entity-picker")
        ? html`
            <ha-entity-picker
              .hass=${this.hass}
              .includeDomains=${[BATTERY_ENTITY_FILTER.domain]}
              .includeDeviceClasses=${[BATTERY_ENTITY_FILTER.device_class]}
              .excludeEntities=${overrides.map(
                (override) => override.entity_id,
              )}
              add-button
              .addButtonLabel=${localize("editor.battery_override_add")}
              @value-changed=${this._addOverridePicked}
            ></ha-entity-picker>
          `
        : html`
            <ha-button appearance="filled" size="s" @click=${this._addOverride}>
              <ha-svg-icon .path=${MDI_PLUS_PATH} slot="start"></ha-svg-icon>
              ${localize("editor.battery_override_add")}
            </ha-button>
            <ha-selector
              hidden
              .hass=${this.hass}
              .selector=${{ entity: {} }}
            ></ha-selector>
          `,
    });
  }

  private _renderAvailabilitySafeList(
    localize: ReturnType<typeof setupLocalize>,
    deviceIds: string[],
  ) {
    const devices = this.hass?.devices ?? {};
    const areas = this.hass?.areas ?? {};

    return renderEditorItemGroup({
      header: localize("editor.availability_safe_list_label"),
      secondary: localize("editor.availability_safe_list_helper"),
      icon: "mdi:check-network-outline",
      expanded: this._safeListExpanded,
      onExpandedChanged: this._safeListExpandedChanged,
      rows: deviceIds.map((deviceId, index) => {
        const device = devices[deviceId];
        const areaId = device?.area_id;
        const domain = device?.primary_config_entry
          ? this._configEntries?.[device.primary_config_entry]?.domain
          : undefined;

        return renderEditorItemRow({
          icon: domain && customElements.get("ha-domain-icon")
            ? html`
                <ha-domain-icon
                  .hass=${this.hass}
                  .domain=${domain}
                  brand-fallback
                ></ha-domain-icon>
              `
            : html`<ha-icon icon="mdi:devices"></ha-icon>`,
          primary: computeDeviceName(device) || deviceId,
          secondary: areaId ? areas[areaId]?.name : undefined,
          actions: html`
            <ha-icon-button
              .label=${localize("editor.availability_safe_list_remove")}
              .path=${MDI_DELETE_PATH}
              data-index=${index}
              @click=${this._removeSafeListDevice}
            ></ha-icon-button>
          `,
        });
      }),
      adder: customElements.get("ha-device-picker")
        ? html`
            <ha-device-picker
              .hass=${this.hass}
              .label=${localize("editor.availability_safe_list_add")}
              .excludeDevices=${deviceIds}
              @value-changed=${this._addSafeListDevice}
            ></ha-device-picker>
          `
        : html`
            <ha-selector
              hidden
              .hass=${this.hass}
              .selector=${{ device: {} }}
            ></ha-selector>
          `,
    });
  }

  private _renderOverrideEditor(
    localize: ReturnType<typeof setupLocalize>,
    config: MaintenanceDashboardStrategyConfig,
    draft: BatteryThresholdOverrideDraft,
  ) {
    const previewDevice =
      draft.entity_id && this.hass
        ? getBatteryPreviewDevice(this.hass, draft.entity_id, draft.threshold)
        : undefined;

    return html`
      <div class="sub-editor-header">
        <ha-icon-button-prev
          .label=${localize("editor.back")}
          @click=${this._closeOverrideEditor}
        ></ha-icon-button-prev>
        <span>${localize("editor.battery_override_title")}</span>
      </div>
      <div class="sub-editor-content">
        <ha-selector
          .hass=${this.hass}
          .selector=${{
            entity: {
              filter: BATTERY_ENTITY_FILTER,
              exclude_entities: (config.battery_threshold_overrides ?? [])
                .filter((_override, index) => index !== draft.index)
                .map((override) => override.entity_id),
            },
          }}
          .label=${localize("editor.battery_override_entity")}
          .value=${draft.entity_id}
          .required=${true}
          @value-changed=${this._overrideDraftEntityChanged}
        ></ha-selector>
        <ha-selector
          .hass=${this.hass}
          .selector=${{
            number: {
              min: 0,
              max: 100,
              mode: "slider",
              slider_ticks: true,
              unit_of_measurement: "%",
            },
          }}
          .label=${localize("editor.battery_override_threshold")}
          .helper=${localize("editor.battery_override_threshold_helper")}
          .value=${draft.threshold}
          .disabled=${!draft.entity_id}
          @value-changed=${this._overrideDraftThresholdChanged}
        ></ha-selector>
      </div>
      ${previewDevice && customElements.get("hui-card")
        ? html`
            <div class="element-preview">
              <hui-card
                .hass=${this.hass}
                .config=${this._getPreviewCardConfig(
                  previewDevice,
                  config.battery_tile_feature,
                )}
                preview
              ></hui-card>
            </div>
          `
        : nothing}
    `;
  }

  private _getPreviewCardConfig(
    device: MaintenanceBatteryDevice,
    feature: BatteryTileFeature | undefined,
  ): LovelaceCardConfig {
    const key = JSON.stringify([device, feature]);
    if (this._previewCard?.key !== key) {
      this._previewCard = { key, config: makeBatteryCard(device, { feature }) };
    }
    return this._previewCard.config;
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
          <label for="battery-threshold-overrides">
            ${localize("editor.battery_overrides_label")}
          </label>
          <textarea
            id="battery-threshold-overrides"
            rows="4"
            .value=${(config.battery_threshold_overrides ?? [])
              .map((override) => `${override.entity_id}: ${override.threshold}`)
              .join("\n")}
            @change=${this._nativeBatteryOverridesChanged}
          ></textarea>
          <div class="helper">
            ${localize("editor.battery_overrides_fallback_helper")}
          </div>
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

    const moduleId =
      ev.currentTarget instanceof HTMLElement
        ? ev.currentTarget.dataset.module
        : undefined;
    const activeModule = MODULES.find((mod) => mod.id === moduleId);
    if (!activeModule) {
      return;
    }

    const data = ev.detail.value;
    const updates: Partial<MaintenanceDashboardStrategyConfig> = {};

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
    }

    this._emitConfigUpdate(updates);
  }

  /* ---- Battery threshold override handlers ---- */

  private _rowIndex(ev: Event): number | undefined {
    if (!(ev.currentTarget instanceof HTMLElement)) {
      return undefined;
    }

    const index = Number(ev.currentTarget.dataset.index);
    return Number.isInteger(index) ? index : undefined;
  }

  private _updateOverrides(overrides: BatteryThresholdOverride[]): void {
    this._emitConfigUpdate({
      battery_threshold_overrides: overrides.length > 0 ? overrides : undefined,
    });
  }

  private _overridesExpandedChanged(
    ev: CustomEvent<{ expanded: boolean }>,
  ): void {
    ev.stopPropagation();
    this._overridesExpanded = ev.detail.expanded;
  }

  private _addOverride(): void {
    this._overrideDraft = {
      index: this._config?.battery_threshold_overrides?.length ?? 0,
      threshold:
        this._config?.battery_attention_threshold ??
        DEFAULT_BATTERY_ATTENTION_THRESHOLD,
    };
  }

  private _addOverridePicked(ev: CustomEvent<{ value?: unknown }>): void {
    ev.stopPropagation();
    const entityId = ev.detail.value;
    if (typeof entityId !== "string" || !entityId) {
      return;
    }

    this._setOverrideDraft({
      index: this._config?.battery_threshold_overrides?.length ?? 0,
      entity_id: entityId,
      threshold:
        this._config?.battery_attention_threshold ??
        DEFAULT_BATTERY_ATTENTION_THRESHOLD,
    });
  }

  private _editOverride(ev: Event): void {
    const index = this._rowIndex(ev);
    const override =
      index === undefined
        ? undefined
        : this._config?.battery_threshold_overrides?.[index];
    if (index === undefined || !override) {
      return;
    }

    this._overrideDraft = { index, ...override };
  }

  private _removeOverride(ev: Event): void {
    const index = this._rowIndex(ev);
    if (index === undefined) {
      return;
    }

    this._updateOverrides(
      (this._config?.battery_threshold_overrides ?? []).filter(
        (_override, overrideIndex) => overrideIndex !== index,
      ),
    );
  }

  private _closeOverrideEditor(): void {
    this._overrideDraft = undefined;
  }

  /* ---- Availability safe list handlers ---- */

  private _updateSafeList(deviceIds: string[]): void {
    const safeListDeviceIds = normalizeAvailabilitySafeListDeviceIds(deviceIds);
    this._emitConfigUpdate({
      availability_safe_list_device_ids:
        safeListDeviceIds.length > 0 ? safeListDeviceIds : undefined,
    });
  }

  private _safeListExpandedChanged(
    ev: CustomEvent<{ expanded: boolean }>,
  ): void {
    ev.stopPropagation();
    this._safeListExpanded = ev.detail.expanded;
  }

  private _addSafeListDevice(ev: CustomEvent<{ value?: unknown }>): void {
    ev.stopPropagation();
    const deviceId = ev.detail.value;
    const picker = ev.currentTarget as { value?: string } | null;
    if (picker) {
      picker.value = undefined;
    }
    if (typeof deviceId !== "string" || !deviceId) {
      return;
    }

    this._updateSafeList([
      ...(this._config?.availability_safe_list_device_ids ?? []),
      deviceId,
    ]);
  }

  private _removeSafeListDevice(ev: Event): void {
    const index = this._rowIndex(ev);
    if (index === undefined) {
      return;
    }

    this._updateSafeList(
      (this._config?.availability_safe_list_device_ids ?? []).filter(
        (_deviceId, deviceIndex) => deviceIndex !== index,
      ),
    );
  }

  private _overrideDraftEntityChanged(
    ev: CustomEvent<{ value?: unknown }>,
  ): void {
    ev.stopPropagation();
    const entityId = ev.detail.value;
    if (!this._overrideDraft || typeof entityId !== "string" || !entityId) {
      return;
    }

    this._setOverrideDraft({ ...this._overrideDraft, entity_id: entityId });
  }

  private _overrideDraftThresholdChanged(
    ev: CustomEvent<{ value?: unknown }>,
  ): void {
    ev.stopPropagation();
    const threshold = ev.detail.value;
    if (
      !this._overrideDraft ||
      typeof threshold !== "number" ||
      Number.isNaN(threshold)
    ) {
      return;
    }

    this._setOverrideDraft({
      ...this._overrideDraft,
      threshold: toBatteryThreshold(threshold),
    });
  }

  private _setOverrideDraft(draft: BatteryThresholdOverrideDraft): void {
    this._overrideDraft = draft;
    if (!draft.entity_id) {
      return;
    }

    const overrides = [...(this._config?.battery_threshold_overrides ?? [])];
    overrides[draft.index] = {
      entity_id: draft.entity_id,
      threshold: draft.threshold,
    };
    this._updateOverrides(overrides);
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

  private _nativeBatteryOverridesChanged(ev: Event): void {
    if (!(ev.currentTarget instanceof HTMLTextAreaElement)) {
      return;
    }

    const overrides = new Map<string, number>();
    for (const line of ev.currentTarget.value.split("\n")) {
      const [entityId, rawThreshold] = line.split(":").map((part) => part.trim());
      const threshold = Number(rawThreshold);
      if (entityId && rawThreshold && Number.isFinite(threshold)) {
        overrides.set(entityId, toBatteryThreshold(threshold));
      }
    }

    this._updateOverrides(
      [...overrides].map(([entityId, threshold]) => ({
        entity_id: entityId,
        threshold,
      })),
    );
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
    editorItemGroupStyles,
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

      ha-expansion-panel.module {
        display: block;
        --expansion-panel-content-padding: 0;
        border-radius: var(--ha-border-radius-md, 12px);
        --ha-card-border-radius: var(--ha-border-radius-md, 12px);
      }

      .expansion-content {
        padding: var(--ha-space-3, 12px);
      }

      .expansion-content ha-icon {
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

      .secondary {
        color: var(--secondary-text-color);
        font-size: 0.9rem;
      }

      .sub-editor-header {
        display: flex;
        align-items: center;
        font-size: 1.125rem;
      }

      .sub-editor-content {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 12px;
      }

      .element-preview {
        margin-top: 12px;
        padding: 4px;
        background: var(--primary-background-color);
        border-radius: var(--ha-border-radius-sm, 4px);
      }

      .element-preview hui-card {
        display: block;
        box-sizing: border-box;
        width: 100%;
        max-width: 390px;
        margin: 0 auto;
        padding: 8px 4px 4px;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "dashboard-maintenance-strategy-editor": DashboardMaintenanceStrategyEditor;
  }
}
