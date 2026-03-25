import { normalizeAvailabilitySafeListDeviceIds } from "./availability-data";
import { setupLocalize } from "./localize";
import type { HomeAssistant } from "./types";

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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

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
    const config = this._config!;

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

    const icon = document.createElement("ha-icon");
    icon.className = "icon";
    icon.setAttribute("icon", config.icon || "mdi:exclamation-thick");

    const info = document.createElement("div");
    info.className = "info";

    const name = document.createElement("div");
    name.className = "name";

    const subtitle = document.createElement("div");
    subtitle.className = "subtitle";

    info.appendChild(name);
    info.appendChild(subtitle);

    // Show picture if available, otherwise icon
    if (config.picture) {
      picture.setAttribute("src", config.picture);
      media.appendChild(picture);
    } else {
      media.appendChild(icon);
    }
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
    this._built = true;
  }

  private _update(): void {
    const config = this._config!;

    if (this._pictureEl) {
      if (config.picture) {
        this._pictureEl.setAttribute("src", config.picture);
        this._pictureEl.style.display = "block";
      } else if (this._iconEl) {
        this._pictureEl.style.display = "none";
      }
    }
    if (this._iconEl) {
      this._iconEl.setAttribute("icon", config.icon || "mdi:exclamation-thick");
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
    if (this._subtitleEl) {
      this._subtitleEl.textContent = config.subtitle || "";
    }
  }

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
    if (!this._hass?.connection || !this._config?.device_id) {
      return;
    }

    this._savingSafeList = true;
    this._suppressNextClick = true;
    this._update();

    try {
      const urlPath = this._currentDashboardUrlPath();
      const rawConfig = await this._hass.connection.sendMessagePromise<Record<string, unknown>>({
        type: "lovelace/config",
        url_path: urlPath,
        force: false,
      });

      const strategy = rawConfig.strategy;
      if (!this._isMaintenanceDashboardStrategy(strategy)) {
        return;
      }

      const existingSafeList = normalizeAvailabilitySafeListDeviceIds(
        strategy.availability_safe_list_device_ids,
      );
      const hasDevice = existingSafeList.includes(this._config.device_id);
      const nextSafeList = hasDevice
        ? existingSafeList.filter((deviceId) => deviceId !== this._config!.device_id)
        : [...existingSafeList, this._config.device_id];

      await this._hass.connection.sendMessagePromise({
        type: "lovelace/config/save",
        url_path: urlPath,
        config: {
          ...rawConfig,
          strategy: {
            ...strategy,
            availability_safe_list_device_ids:
              nextSafeList.length > 0 ? nextSafeList : undefined,
          },
        },
      });
    } finally {
      this._savingSafeList = false;
      this._update();
    }
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
      typeof strategy === "object" &&
      strategy !== null &&
      "type" in strategy &&
      (strategy as { type?: unknown }).type === "custom:maintenance"
    );
  }
}

customElements.define("dm-availability-device-card", DmAvailabilityDeviceCard);
