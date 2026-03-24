"""Config flow for Dashboard Maintenance."""

from __future__ import annotations

from typing import Any

from homeassistant import config_entries

from .const import DOMAIN, ENTRY_TITLE


class DashboardMaintenanceConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Dashboard Maintenance."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Handle the initial step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            await self.async_set_unique_id(DOMAIN)
            self._abort_if_unique_id_configured()
            return self.async_create_entry(title=ENTRY_TITLE, data={})

        return self.async_show_form(step_id="user")
