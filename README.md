# Dashboard Maintenance

Custom Home Assistant integration that adds a Lovelace maintenance dashboard strategy.

## What it adds

- `custom:maintenance` dashboard strategy for full dashboards
- `custom:maintenance` view strategy for single Lovelace views
- a strategy editor with a battery attention threshold slider

The generated dashboard focuses on battery-powered devices with numeric battery sensors, orders the devices that need attention first, and opens the device page when you click a tile.

## Install

1. Install this integration as a custom component.
2. Add the `Dashboard Maintenance` integration once from the integrations page.
3. Reload the frontend or refresh Home Assistant.

## Use as a full dashboard

YAML example:

```yaml
strategy:
  type: custom:maintenance
  battery_attention_threshold: 30
```

Storage dashboard flow:

1. Create an empty dashboard from `/config/lovelace/dashboards`.
2. Open raw configuration.
3. Replace the config with the strategy example above.

## Use as a view in an existing dashboard

```yaml
views:
  - strategy:
      type: custom:maintenance
      title: Maintenance
      path: maintenance
      icon: mdi:battery-heart-variant
      battery_attention_threshold: 30
```

## Current limitations

- It does not add a new built-in or system dashboard.
- It does not appear in the new dashboard template picker, because that picker is currently limited to built-in strategies.
- It does not modify the Home overview, quick search, or other built-in system dashboard navigation.
- It only includes devices with numeric battery percentage sensors. Binary low-battery entities are intentionally skipped.

## Development

```bash
pnpm install
pnpm run build
node --check www/dashboard-maintenance.js
python -m compileall __init__.py config_flow.py const.py
```
