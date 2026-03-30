# Dashboard Maintenance

> [!NOTE]
> This dashboard is mostlty a personal test. It is not supported in any way and may become archived at some point

Custom Lovelace dashboard and view strategy for Home Assistant maintenance dashboards.

## What it adds

- `custom:maintenance` dashboard strategy for full dashboards
- `custom:maintenance` view strategy for single Lovelace views
- a strategy editor with a battery attention threshold slider

The generated dashboard focuses on battery-powered devices with numeric battery sensors, orders the devices that need attention first, and opens the device page when you click a tile.

## Features

### Summary view

Shows a condensed snapshot of every enabled module in one place, with the most critical items listed first.

### Batteries view

Shows devices with numeric battery sensors, sorted so low-battery devices appear first. Devices can be browsed by area using per-area subviews.

### Repairs view

Shows all open Home Assistant repair issues.

### Updates view

Shows all pending software and firmware updates.

### Availability view

Shows entities that are currently unavailable, grouped by area with per-area subviews.

### Stale view

Shows entities whose state has not been updated within a configurable time window, grouped by area with per-area subviews.

## Install with HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=timmo001&repository=ha-dashboard-maintenance&category=dashboard)

1. Open the button above to add this repository in HACS.
2. If you add it manually, open HACS, go to the top-right menu, choose `Custom repositories`, add `https://github.com/timmo001/ha-dashboard-maintenance`, and select `Dashboard`.
3. Install the repository from HACS.
4. Open `Settings -> Dashboards -> three dots menu -> Resources`.
5. Add this Lovelace resource:

   - URL: `/hacsfiles/ha-dashboard-maintenance/ha-dashboard-maintenance.js`
   - Type: `module`

6. Reload Lovelace resources or refresh Home Assistant.

## Local development setup

The local publish flow copies the built bundle into `/config/www/community/ha-dashboard-maintenance/` over SSH with `rsync`, so your development machine needs `ssh` and `rsync`, and your Home Assistant instance needs SSH access set up first.

If you run Home Assistant OS or Supervised, you can use the SSH app:

[![Open your Home Assistant instance and show the dashboard of an add-on.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=core_ssh)

1. Install the SSH app, refer to its setup instructions, and make sure you can log in over SSH before running this script.
2. Copy `.env.example` to `.env`.
3. Set `PUBLISH_TARGET` to your Home Assistant SSH target, for example `root@homeassistant.local` or another SSH user/host that can write to `/config/www`.
4. Optionally set `PUBLISH_PORT` if your SSH service is not on port `22`.
5. Run `pnpm publish-to-local`.
6. Open `Settings -> Dashboards -> three dots menu -> Resources`.
7. Add this Lovelace resource:

   - URL: `/local/community/ha-dashboard-maintenance/ha-dashboard-maintenance.js`
   - Type: `module`

8. Reload Lovelace resources or refresh Home Assistant.

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
node --check dist/ha-dashboard-maintenance.js
```

Git commits also run `pnpm run lint` through a `pre-commit` hook, which rebuilds the bundle and checks the generated JavaScript syntax.

## Release layout

- HACS release asset: `ha-dashboard-maintenance.js`
- Local build output: `dist/ha-dashboard-maintenance.js`
- Local publish target: `/config/www/community/ha-dashboard-maintenance/ha-dashboard-maintenance.js`
- Recommended local dev resource URL: `/local/community/ha-dashboard-maintenance/ha-dashboard-maintenance.js`
