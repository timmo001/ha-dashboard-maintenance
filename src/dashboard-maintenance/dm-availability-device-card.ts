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
  device_name: string;
  subtitle: string;
  picture: string | null;
  icon: string;
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
  .picture {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
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
  private _root: ShadowRoot;
  private _built = false;

  // Element references
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

  set hass(_hass: unknown) {
    // No reactive state needed — this card is fully config-driven.
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
    card.addEventListener("click", () => {
      this._navigate();
    });
    card.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        this._navigate();
      }
    });

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
      card.appendChild(picture);
    } else {
      card.appendChild(icon);
    }
    card.appendChild(info);

    this._root.appendChild(style);
    this._root.appendChild(card);

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
}

customElements.define("dm-availability-device-card", DmAvailabilityDeviceCard);
