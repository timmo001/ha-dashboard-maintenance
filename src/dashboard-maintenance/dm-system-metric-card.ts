import { css, html, LitElement, nothing } from "lit";
import type { PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  fetchHostInfo,
  subscribeSystemStatus,
  type HostInfoData,
  type SystemStatusData,
} from "./system-status-subscription";
import type { HomeAssistant } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SystemMetricType =
  | "cpu"
  | "memory_percent"
  | "memory_used"
  | "disk_percent"
  | "disk_free"
  | "disk_health"
  | "uptime";

export interface DmSystemMetricCardConfig {
  type: string;
  metric: SystemMetricType;
  label?: string;
  icon?: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METRIC_ICONS: Record<SystemMetricType, string> = {
  cpu: "mdi:cpu-64-bit",
  memory_percent: "mdi:memory",
  memory_used: "mdi:memory",
  disk_percent: "mdi:harddisk",
  disk_free: "mdi:harddisk",
  disk_health: "mdi:harddisk",
  uptime: "mdi:clock-check-outline",
};

const METRIC_LABELS: Record<SystemMetricType, string> = {
  cpu: "CPU",
  memory_percent: "RAM",
  memory_used: "RAM",
  disk_percent: "Disk",
  disk_free: "Disk free",
  disk_health: "Drive health",
  uptime: "Uptime",
};

const METRIC_COLORS: Record<SystemMetricType, string> = {
  cpu: "var(--info-color)",
  memory_percent: "var(--info-color)",
  memory_used: "var(--info-color)",
  disk_percent: "var(--info-color)",
  disk_free: "var(--info-color)",
  disk_health: "var(--success-color)",
  uptime: "var(--success-color)",
};

const HOST_INFO_REFRESH_MS = 60_000;

const SYSTEM_METRIC_TYPES = new Set<string>([
  "cpu",
  "memory_percent",
  "memory_used",
  "disk_percent",
  "disk_free",
  "disk_health",
  "uptime",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isSystemMetricType = (value: unknown): value is SystemMetricType =>
  typeof value === "string" && SYSTEM_METRIC_TYPES.has(value);

const isStreamMetric = (metric: SystemMetricType): boolean =>
  metric === "cpu" || metric === "memory_percent" || metric === "memory_used";

const needsBothSources = (metric: SystemMetricType): boolean =>
  metric === "memory_percent" || metric === "disk_percent";

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const formatMemoryMb = (value: number): string => {
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} GiB`;
  }
  return `${value.toFixed(0)} MiB`;
};

const formatDiskFreeGb = (value: number): string => `${value.toFixed(1)} GB`;

const formatDiskHealth = (lifeTime: number | null): string => {
  if (lifeTime === null) {
    return "—";
  }
  // disk_life_time is percentage used (0-100), health is the inverse
  const health = Math.max(0, 100 - lifeTime);
  return `${health.toFixed(0)}%`;
};

const formatUptime = (bootDate: Date | null, language: string): string => {
  if (!bootDate) {
    return "—";
  }

  const seconds = Math.max(0, (Date.now() - bootDate.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const fmt = (value: number, unit: Intl.NumberFormatOptions["unit"]) =>
    new Intl.NumberFormat(language, {
      style: "unit",
      unit,
      unitDisplay: "long",
    }).format(value);

  if (days > 0) {
    return fmt(days, "day");
  }
  if (hours > 0) {
    return fmt(hours, "hour");
  }
  if (minutes > 0) {
    return fmt(minutes, "minute");
  }
  return `< ${fmt(1, "minute")}`;
};

const formatStreamValue = (
  metric: SystemMetricType,
  data: SystemStatusData,
): string => {
  switch (metric) {
    case "cpu":
      return formatPercent(data.cpu_percent);
    case "memory_percent":
      return formatPercent(data.memory_used_percent);
    case "memory_used":
      return formatMemoryMb(data.memory_used_mb);
    default:
      return "";
  }
};

const formatHostValue = (
  metric: SystemMetricType,
  data: HostInfoData,
  language: string,
): string => {
  switch (metric) {
    case "disk_percent": {
      if (data.disk_total <= 0) {
        return "—";
      }
      const percent = (data.disk_used / data.disk_total) * 100;
      return formatPercent(percent);
    }
    case "disk_free":
      return formatDiskFreeGb(data.disk_free);
    case "disk_health":
      return formatDiskHealth(data.disk_life_time);
    case "uptime":
      return formatUptime(data.boot_timestamp, language);
    default:
      return "";
  }
};

/**
 * Format the secondary detail line for metrics that show two values.
 * Returns empty string if no secondary value is appropriate.
 */
const formatStreamSecondary = (
  metric: SystemMetricType,
  data: SystemStatusData,
): string => {
  switch (metric) {
    case "memory_percent":
      return formatMemoryMb(data.memory_used_mb);
    default:
      return "";
  }
};

const formatHostSecondary = (
  metric: SystemMetricType,
  data: HostInfoData,
): string => {
  switch (metric) {
    case "disk_percent":
      return `${formatDiskFreeGb(data.disk_free)} free`;
    default:
      return "";
  }
};

// ---------------------------------------------------------------------------
// Card element
// ---------------------------------------------------------------------------

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

@customElement("dm-system-metric-card")
class DmSystemMetricCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: DmSystemMetricCardConfig;
  @state() private _streamValue = "";
  @state() private _streamSecondary = "";
  @state() private _hostValue = "";
  @state() private _hostSecondary = "";
  @state() private _available = false;

  private _unsubStream: (() => void) | null = null;
  private _hostRefreshTimer?: number;

  public static getStubConfig(): DmSystemMetricCardConfig {
    return {
      type: "custom:dm-system-metric-card",
      metric: "cpu",
    };
  }

  public setConfig(config: DmSystemMetricCardConfig): void {
    if (!config || !isSystemMetricType(config.metric)) {
      throw new Error("dm-system-metric-card: invalid metric");
    }

    const metricChanged = this._config?.metric !== config.metric;
    this._config = config;

    if (metricChanged) {
      this._teardown();
      this._setup();
    }
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._setup();
  }

  public disconnectedCallback(): void {
    this._teardown();
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues<this>): void {
    if (changedProps.has("hass") && this.hass && !this._available) {
      this._setup();
    }
  }

  public getCardSize(): number {
    return 1;
  }

  public getGridOptions() {
    return { columns: 6, rows: 1, min_columns: 6, min_rows: 1 };
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  private _setup(): void {
    if (!this.hass || !this._config) {
      return;
    }

    const metric = this._config.metric;

    if (isStreamMetric(metric)) {
      this._setupStream();
    }

    if (!isStreamMetric(metric) || needsBothSources(metric)) {
      this._setupHostInfo();
    }
  }

  private _setupStream(): void {
    if (this._unsubStream || !this.hass) {
      return;
    }

    this._unsubStream = subscribeSystemStatus(this.hass, (data) => {
      this._available = true;
      this._streamValue = formatStreamValue(this._config!.metric, data);
      this._streamSecondary = formatStreamSecondary(this._config!.metric, data);
    });
  }

  private _setupHostInfo(): void {
    if (!this.hass) {
      return;
    }

    void this._refreshHostInfo();
    this._startHostRefreshTimer();
  }

  private async _refreshHostInfo(): Promise<void> {
    if (!this.hass || !this._config) {
      return;
    }

    const data = await fetchHostInfo(this.hass);
    if (data) {
      this._available = true;
      const metric = this._config.metric;
      const language = this.hass.locale?.language ?? "en";
      if (!isStreamMetric(metric)) {
        this._hostValue = formatHostValue(metric, data, language);
      }
      this._hostSecondary = formatHostSecondary(metric, data);
    }
  }

  private _startHostRefreshTimer(): void {
    if (this._hostRefreshTimer !== undefined) {
      return;
    }

    this._hostRefreshTimer = window.setInterval(() => {
      void this._refreshHostInfo();
    }, HOST_INFO_REFRESH_MS);
  }

  private _teardown(): void {
    if (this._unsubStream) {
      this._unsubStream();
      this._unsubStream = null;
    }

    if (this._hostRefreshTimer !== undefined) {
      window.clearInterval(this._hostRefreshTimer);
      this._hostRefreshTimer = undefined;
    }

    this._available = false;
    this._streamValue = "";
    this._streamSecondary = "";
    this._hostValue = "";
    this._hostSecondary = "";
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    if (!this._config) {
      return nothing;
    }

    const metric = this._config.metric;
    const icon = this._config.icon || METRIC_ICONS[metric];
    const label = this._config.label || METRIC_LABELS[metric];
    const color = this._config.color || METRIC_COLORS[metric];
    const value = this._available
      ? (isStreamMetric(metric) ? this._streamValue : this._hostValue)
      : "—";
    const secondary = isStreamMetric(metric)
      ? this._streamSecondary
      : this._hostSecondary;

    return html`
      <ha-card style="--tile-color: ${color}">
        <ha-tile-container>
          <ha-tile-icon slot="icon" .icon=${icon}></ha-tile-icon>
          <ha-tile-info slot="info">
            <span slot="primary">${label}</span>
            <span slot="secondary">${value}${secondary ? html` <span class="detail">${secondary}</span>` : nothing}</span>
          </ha-tile-info>
        </ha-tile-container>
      </ha-card>
    `;
  }

  static styles = [
    tileCardStyle,
    css`
      :host {
        --tile-color: var(--info-color);
      }

      ha-tile-info {
        --ha-tile-info-secondary-color: var(--secondary-text-color);
      }

      .detail {
        opacity: 0.7;
        font-size: 0.9em;
      }

      .detail::before {
        content: "·";
        margin: 0 4px;
      }
    `,
  ];
}

// Register as a custom card
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "dm-system-metric-card")) {
  window.customCards.push({
    type: "dm-system-metric-card",
    name: "System metric",
    description: "Displays a live system metric (CPU, RAM, disk, uptime) from the HA hardware/supervisor APIs.",
    preview: false,
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
    "dm-system-metric-card": DmSystemMetricCard;
  }
}
