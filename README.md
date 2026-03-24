# Dashboard Maintenance

Custom Lovelace dashboard and view strategy for Home Assistant maintenance dashboards.

## What it adds

- `custom:maintenance` dashboard strategy for full dashboards
- `custom:maintenance` view strategy for single Lovelace views
- a strategy editor with a battery attention threshold slider

The generated dashboard focuses on battery-powered devices with numeric battery sensors, orders the devices that need attention first, and opens the device page when you click a tile.

## Install with HACS

1. Install this repository as a `Dashboard` repo in HACS.
2. Open `Settings -> Dashboards -> three dots menu -> Resources`.
3. Add this Lovelace resource:

   - URL: `/hacsfiles/ha-dashboard-maintenance/dashboard-maintenance.js`
   - Type: `module`

4. Reload Lovelace resources or refresh Home Assistant.

## Local development setup

1. Copy `.env.example` to `.env`.
2. Set `PUBLISH_TARGET` to your Home Assistant SSH target.
3. Run `pnpm publish-to-local`.
4. Open `Settings -> Dashboards -> three dots menu -> Resources`.
5. Add this Lovelace resource:

   - URL: `/local/community/ha-dashboard-maintenance/dashboard-maintenance.js`
   - Type: `module`

6. Reload Lovelace resources or refresh Home Assistant.

## Strategy usage checklist

- Register the resource before trying to use `custom:maintenance`.
- Use the HACS `/hacsfiles/...` URL for installed releases.
- Use the `/local/...` URL for the default local publish flow.
- Set the resource type to `module`.

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
4. Save the dashboard.

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
- The strategy will not load until the Lovelace resource is registered.

## Development

```bash
pnpm install
pnpm run build
node --check dist/dashboard-maintenance.js
```

## Release layout

- HACS release asset: `dashboard-maintenance.js`
- Local build output: `dist/dashboard-maintenance.js`
- Local publish target: `/config/www/community/ha-dashboard-maintenance/dashboard-maintenance.js`
- Recommended local dev resource URL: `/local/community/ha-dashboard-maintenance/dashboard-maintenance.js`
