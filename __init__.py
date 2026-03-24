"""Dashboard Maintenance integration."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback

from .const import (
    DATA_FRONTEND_REGISTERED,
    DATA_STATIC_REGISTERED,
    DOMAIN,
    MODULE_FILENAME,
    URL_BASE,
    VERSION,
)


@callback
def _module_url() -> str:
    """Return the frontend module URL."""
    return f"{URL_BASE}/{MODULE_FILENAME}?v={VERSION}"


async def _async_register_static_path(hass: HomeAssistant) -> None:
    """Register the integration static directory."""
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                URL_BASE,
                str(Path(__file__).parent / "www"),
                cache_headers=False,
            )
        ]
    )


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up Dashboard Maintenance."""
    hass.data.setdefault(
        DOMAIN,
        {
            DATA_FRONTEND_REGISTERED: False,
            DATA_STATIC_REGISTERED: False,
        },
    )

    if not hass.data[DOMAIN][DATA_STATIC_REGISTERED]:
        await _async_register_static_path(hass)
        hass.data[DOMAIN][DATA_STATIC_REGISTERED] = True

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Dashboard Maintenance from a config entry."""
    if not hass.data[DOMAIN][DATA_FRONTEND_REGISTERED]:
        frontend.add_extra_js_url(hass, _module_url())
        hass.data[DOMAIN][DATA_FRONTEND_REGISTERED] = True

    entry.async_on_unload(entry.add_update_listener(_async_handle_entry_update))
    return True


async def _async_handle_entry_update(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Handle config entry updates."""
    if not hass.data[DOMAIN][DATA_FRONTEND_REGISTERED]:
        frontend.add_extra_js_url(hass, _module_url())
        hass.data[DOMAIN][DATA_FRONTEND_REGISTERED] = True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload Dashboard Maintenance."""
    if hass.data[DOMAIN][DATA_FRONTEND_REGISTERED]:
        frontend.remove_extra_js_url(hass, _module_url())
        hass.data[DOMAIN][DATA_FRONTEND_REGISTERED] = False

    return True
