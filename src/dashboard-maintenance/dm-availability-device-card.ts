import { normalizeAvailabilitySafeListDeviceIds } from "./availability-data";
import { setupLocalize } from "./localize";
import type { HomeAssistant } from "./types";

interface LovelaceController {
  rawConfig: Record<string, unknown>;
  urlPath: string | null;
  saveConfig(newConfig: Record<string, unknown>): Promise<void>;
}

/**
 * A lightweight custom Lovelace card that displays a device with
 * availability issues. Renders a tile-like layout with:
 *   - Device name (primary)
 *   - Entity count subtitle (secondary, e.g. "3 unavailable entities")
 *   - Device picture or fallback icon
 *   - Tap navigates to the device page
 *
 * Config shape:
 * {
 *   type: "custom:dm-availability-device-card",
 *   device_name: string,
 *   subtitle: string,
 *   picture: string | null,      // URL to device picture
 *   icon: string,                // fallback icon if no picture
 *   navigation_path: string,
 * }
 */

interface DmAvailabilityDeviceCardConfig {
  type: string;
  device_id?: string;
  device_name: string;
  subtitle: string;
  subtitle_loading?: boolean;
  picture: string | null;
  icon: string;
  enable_safe_toggle?: boolean;
  navigation_path: string;
}

const CARD_STYLES = `
  :host {
    display: block;
  }
  .card {
    background: var(--ha-card-background, var(--card-background-color, #fff));
    border-radius: var(--ha-card-border-radius, 12px);
    border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
    box-shadow: var(--ha-card-box-shadow, none);
    padding: 10px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
    transition: box-shadow 180ms ease-in-out;
    box-sizing: border-box;
  }
  .card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }
  .media {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .media.safe-toggle {
    cursor: pointer;
  }
  .media.saving {
    opacity: 0.6;
  }
  .picture {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--divider-color, #e0e0e0);
  }
  .icon {
    --mdc-icon-size: 24px;
    color: var(--icon-color, var(--state-icon-color, var(--disabled-color, #bdbdbd)));
  }
  .info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .name {
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    color: var(--primary-text-color, #212121);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subtitle {
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    color: var(--secondary-text-color, #727272);
    width: 100%;
    min-height: 16px;
    display: flex;
    align-items: center;
  }
  .subtitle-content {
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subtitle-placeholder {
    width: 140px;
    max-width: 100%;
    height: 12px;
    border-radius: var(--ha-border-radius-sm);
    background: var(--ha-color-fill-neutral-normal-hover, var(--divider-color, #e0e0e0));
    animation: dm-subtitle-pulse 1200ms ease-in-out infinite;
  }
  @keyframes dm-subtitle-pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
`;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

class DmAvailabilityDeviceCard extends HTMLElement {
  private _config?: DmAvailabilityDeviceCardConfig;
  private _hass?: HomeAssistant;
  private _root: ShadowRoot;
  private _built = false;
  private _holdTimer?: number;
  private _savingSafeList = false;
  private _suppressNextClick = false;

  // Element references
  private _cardEl?: HTMLDivElement;
  private _mediaEl?: HTMLDivElement;
  private _pictureEl?: HTMLImageElement;
  private _iconEl?: HTMLElement;
  private _nameEl?: HTMLElement;
  private _subtitleEl?: HTMLElement;
  private _subtitleContentEl?: HTMLElement;
  private _subtitleSkeletonEl?: HTMLElement;
  private _activePictureSrc: string | null = null;
  private _failedPictureSrc: string | null = null;

  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
  }

  setConfig(config: DmAvailabilityDeviceCardConfig): void {
    if (!config.device_name || !config.navigation_path) {
      throw new Error("dm-availability-device-card: device_name and navigation_path are required");
    }
    this._config = config;
    this._render();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this._update();
  }

  getCardSize(): number {
    return 1;
  }

  private _render(): void {
    if (!this._config) {
      return;
    }

    if (!this._built) {
      this._build();
    }

    this._update();
  }

  private _build(): void {
    const config = this._config;
    if (!config) {
      return;
    }

    const style = document.createElement("style");
    style.textContent = CARD_STYLES;

    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.addEventListener("click", (ev) => {
      if (this._suppressNextClick) {
        ev.preventDefault();
        ev.stopPropagation();
        this._suppressNextClick = false;
        return;
      }

      this._navigate();
    });
    card.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        this._navigate();
      }
    });

    const media = document.createElement("div");
    media.className = "media";
    media.addEventListener("pointerdown", this._handleHoldStart);
    media.addEventListener("pointerup", this._handleHoldEnd);
    media.addEventListener("pointerleave", this._handleHoldEnd);
    media.addEventListener("pointercancel", this._handleHoldEnd);
    media.addEventListener("contextmenu", this._handleContextMenu);

    // Use picture if available, otherwise fall back to icon
    const picture = document.createElement("img");
    picture.className = "picture";
    picture.setAttribute("loading", "lazy");
    picture.addEventListener("load", this._handlePictureLoad);
    picture.addEventListener("error", this._handlePictureError);

    const icon = document.createElement("ha-icon");
    icon.className = "icon";
    icon.setAttribute("icon", config.icon || "mdi:exclamation-thick");

    const info = document.createElement("div");
    info.className = "info";

    const name = document.createElement("div");
    name.className = "name";

    const subtitle = document.createElement("div");
    subtitle.className = "subtitle";
    subtitle.setAttribute("aria-live", "polite");

    const subtitleContent = document.createElement("span");
    subtitleContent.className = "subtitle-content";

    const subtitleSkeleton = document.createElement("div");
    subtitleSkeleton.className = "subtitle-placeholder";
    subtitleSkeleton.setAttribute("aria-hidden", "true");

    info.appendChild(name);
    subtitle.appendChild(subtitleContent);
    subtitle.appendChild(subtitleSkeleton);
    info.appendChild(subtitle);

    media.appendChild(picture);
    media.appendChild(icon);
    card.appendChild(media);
    card.appendChild(info);

    this._root.appendChild(style);
    this._root.appendChild(card);

    this._cardEl = card;
    this._mediaEl = media;
    this._pictureEl = picture;
    this._iconEl = icon;
    this._nameEl = name;
    this._subtitleEl = subtitle;
    this._subtitleContentEl = subtitleContent;
    this._subtitleSkeletonEl = subtitleSkeleton;
    this._built = true;
  }

  private _update(): void {
    const config = this._config;
    if (!config) {
      return;
    }

    const picture = config.picture;
    const shouldShowPicture = Boolean(picture) && picture !== this._failedPictureSrc;

    if (this._pictureEl) {
      if (shouldShowPicture && picture) {
        if (this._activePictureSrc !== picture) {
          this._activePictureSrc = picture;
          this._pictureEl.src = picture;
        }
        this._pictureEl.style.display = "block";
      } else {
        if (this._activePictureSrc !== null) {
          this._activePictureSrc = null;
          this._pictureEl.removeAttribute("src");
        }
        this._pictureEl.style.display = "none";
      }
    }
    if (this._iconEl) {
      this._iconEl.setAttribute("icon", config.icon || "mdi:exclamation-thick");
      this._iconEl.style.display = shouldShowPicture ? "none" : "block";
    }
    if (this._mediaEl) {
      const localize = setupLocalize(this._hass);
      const canToggleSafeList = Boolean(
        config.enable_safe_toggle && config.device_id,
      );
      this._mediaEl.classList.toggle("safe-toggle", canToggleSafeList);
      this._mediaEl.classList.toggle("saving", this._savingSafeList);
      this._mediaEl.title = canToggleSafeList
        ? localize("availability.safe_list_hold_hint")
        : "";
    }
    if (this._nameEl) {
      this._nameEl.textContent = config.device_name;
    }
    const subtitle = config.subtitle || "";
    const subtitleLoading =
      config.subtitle_loading === true || subtitle.trim().length === 0;
    if (this._subtitleEl) {
      this._subtitleEl.setAttribute("aria-busy", subtitleLoading ? "true" : "false");
    }
    if (this._subtitleContentEl) {
      this._subtitleContentEl.textContent = subtitle;
      this._subtitleContentEl.style.display = subtitleLoading ? "none" : "block";
    }
    if (this._subtitleSkeletonEl) {
      this._subtitleSkeletonEl.style.display = subtitleLoading ? "block" : "none";
    }
  }

  private _handlePictureLoad = (): void => {
    if (this._config?.picture && this._config.picture === this._activePictureSrc) {
      this._failedPictureSrc = null;
    }
  };

  private _handlePictureError = (): void => {
    if (this._activePictureSrc) {
      this._failedPictureSrc = this._activePictureSrc;
    }
    this._update();
  };

  private _navigate(): void {
    if (!this._config?.navigation_path) {
      return;
    }

    const event = new CustomEvent("location-changed", {
      bubbles: true,
      composed: true,
      detail: {},
    });

    history.pushState(null, "", this._config.navigation_path);
    window.dispatchEvent(event);
  }

  private _handleHoldStart = (_ev: PointerEvent): void => {
    if (
      !this._config?.enable_safe_toggle ||
      !this._config.device_id ||
      this._savingSafeList
    ) {
      return;
    }

    this._clearHoldTimer();
    this._holdTimer = window.setTimeout(() => {
      this._holdTimer = undefined;
      void this._toggleSafeList();
    }, 700);
  };

  private _handleHoldEnd = (): void => {
    this._clearHoldTimer();
  };

  private _handleContextMenu = (ev: Event): void => {
    if (this._config?.enable_safe_toggle) {
      ev.preventDefault();
    }
  };

  private _clearHoldTimer(): void {
    if (this._holdTimer !== undefined) {
      window.clearTimeout(this._holdTimer);
      this._holdTimer = undefined;
    }
  }

  private async _toggleSafeList(): Promise<void> {
    if (!this._config?.device_id) {
      return;
    }

    this._savingSafeList = true;
    this._suppressNextClick = true;
    this._update();

    try {
      const lovelace = this._findLovelaceController();
      const rawConfig = lovelace
        ? lovelace.rawConfig
        : await this._fetchRawConfig();

      const strategy = rawConfig.strategy;
      if (!this._isMaintenanceDashboardStrategy(strategy)) {
        return;
      }

      const existingSafeList = normalizeAvailabilitySafeListDeviceIds(
        strategy.availability_safe_list_device_ids,
      );
      const deviceId = this._config.device_id;
      const hasDevice = existingSafeList.includes(deviceId);
      const nextSafeList = hasDevice
        ? existingSafeList.filter((safeListDeviceId) => safeListDeviceId !== deviceId)
        : [...existingSafeList, deviceId];

      const nextConfig = {
        ...rawConfig,
        strategy: {
          ...strategy,
          availability_safe_list_device_ids:
            nextSafeList.length > 0 ? nextSafeList : undefined,
        },
      };

      if (lovelace) {
        await lovelace.saveConfig(nextConfig);
      } else {
        await this._saveRawConfig(nextConfig);
      }
    } finally {
      this._savingSafeList = false;
      this._update();
    }
  }

  private async _fetchRawConfig(): Promise<Record<string, unknown>> {
    if (!this._hass?.connection) {
      throw new Error("Home Assistant connection unavailable");
    }

    return this._hass.connection.sendMessagePromise<Record<string, unknown>>({
      type: "lovelace/config",
      url_path: this._currentDashboardUrlPath(),
      force: false,
    });
  }

  private async _saveRawConfig(config: Record<string, unknown>): Promise<void> {
    if (!this._hass?.connection) {
      throw new Error("Home Assistant connection unavailable");
    }

    await this._hass.connection.sendMessagePromise({
      type: "lovelace/config/save",
      url_path: this._currentDashboardUrlPath(),
      config,
    });
  }

  private _findLovelaceController(): LovelaceController | undefined {
    let node: Node | undefined = this;

    while (node) {
      const candidate = node as Node & { lovelace?: LovelaceController };
      if (
        candidate.lovelace &&
        typeof candidate.lovelace.saveConfig === "function"
      ) {
        return candidate.lovelace;
      }

      const rootNode = node.getRootNode();
      if (rootNode instanceof ShadowRoot && rootNode.host) {
        node = rootNode.host;
        continue;
      }

      node = node.parentNode ?? undefined;
    }

    return undefined;
  }

  private _currentDashboardUrlPath(): string | null {
    const [, dashboardSegment] = window.location.pathname.split("/");

    if (!dashboardSegment || dashboardSegment === "lovelace") {
      return null;
    }

    return decodeURIComponent(dashboardSegment);
  }

  private _isMaintenanceDashboardStrategy(
    strategy: unknown,
  ): strategy is {
    type: string;
    availability_safe_list_device_ids?: string[];
  } {
    return (
      isObjectRecord(strategy) &&
      strategy.type === "custom:maintenance"
    );
  }
}

customElements.define("dm-availability-device-card", DmAvailabilityDeviceCard);
